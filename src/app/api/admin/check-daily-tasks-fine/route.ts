import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Check if lead assignees have created tasks today before admin-configured deadline
 * Apply fines for those who haven't set daily tasks
 * This should be called daily after the configured deadline (via cron job or scheduled task)
 * Deadline time and fine amount are configured in Fine Control settings
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret header (for Vercel Cron Jobs) or admin session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;
    
    if (!isCronRequest) {
      // If not a cron request, require admin session
      const session = await getServerSession(authOptions);
      if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get fine control settings
    const fineControlSettings = await db.collection('fineControlSettings').findOne({
      type: 'default'
    });
    
    const deadlineHour = fineControlSettings?.dailyTasksDeadlineHour ?? 10;
    const deadlineMinute = fineControlSettings?.dailyTasksDeadlineMinute ?? 0;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadline = new Date(today);
    deadline.setHours(deadlineHour, deadlineMinute, 0, 0);

    // Only run if current time is after the deadline
    if (now < deadline) {
      return NextResponse.json({ 
        message: `Check can only run after ${String(deadlineHour).padStart(2, '0')}:${String(deadlineMinute).padStart(2, '0')}`,
        currentTime: now.toISOString(),
        deadline: deadline.toISOString()
      });
    }

    // Find all active projects (status: "in_progress")
    const activeProjects = await db.collection('projects').find({
      status: 'in_progress'
    }).toArray();

    const finesApplied: Array<{
      employeeId: string;
      employeeName: string;
      projectId: string;
      projectName: string;
      fineAmount: number;
    }> = [];

    const finesSkipped: Array<{
      employeeId: string;
      employeeName: string;
      projectId: string;
      projectName: string;
      reason: string;
    }> = [];

    // Process each active project
    for (const project of activeProjects) {
      // Get lead assignees (can be array or single)
      let leadAssignees: any[] = [];
      if (project.leadAssignee) {
        if (Array.isArray(project.leadAssignee)) {
          leadAssignees = project.leadAssignee;
        } else {
          leadAssignees = [project.leadAssignee];
        }
      }

      if (leadAssignees.length === 0) {
        continue; // Skip projects without lead assignees
      }

      // Check each lead assignee
      for (const leadAssignee of leadAssignees) {
        const leadId = typeof leadAssignee === 'object' && leadAssignee._id
          ? leadAssignee._id.toString()
          : leadAssignee.toString();

        // Get employee details
        const employee = await db.collection('users').findOne({
          _id: new ObjectId(leadId),
          role: 'employee'
        });

        if (!employee) {
          continue; // Skip if not an employee
        }

        // Check if employee created any tasks today before the admin-configured deadline
        // Tasks created by lead assignee for this project
        // Check tasks created by this employee (using createdBy field - can be ObjectId, string, or nested)
        const tasksCreatedByEmployee = await db.collection('tasks').find({
          projectId: project._id,
          $or: [
            { createdBy: new ObjectId(leadId) }, // Direct ObjectId
            { createdBy: leadId }, // String ID
            { 'createdBy._id': new ObjectId(leadId) } // Nested object
          ],
          createdAt: {
            $gte: today,
            $lt: deadline // Only tasks created before admin-configured deadline count
          }
        }).toArray();

        const hasCreatedTasks = tasksCreatedByEmployee.length > 0;

        // Check if employee has marked NA (Not Applicable) for today
        const naRecord = await db.collection('dailyTaskNA').findOne({
          employeeId: new ObjectId(leadId),
          projectId: project._id,
          date: { 
            $gte: today, 
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) 
          }
        });

        if (naRecord) {
          finesSkipped.push({
            employeeId: leadId,
            employeeName: employee.name || 'Unknown',
            projectId: project._id.toString(),
            projectName: project.projectName || 'Unknown',
            reason: 'Marked as NA (Not Applicable) for today'
          });
          continue;
        }

        // Check if fine was already applied today
        const existingFine = await db.collection('dailyTaskFines').findOne({
          employeeId: new ObjectId(leadId),
          projectId: project._id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        });

        if (existingFine) {
          finesSkipped.push({
            employeeId: leadId,
            employeeName: employee.name || 'Unknown',
            projectId: project._id.toString(),
            projectName: project.projectName || 'Unknown',
            reason: 'Fine already applied today'
          });
          continue;
        }

        if (!hasCreatedTasks) {
          // Use fine amount from fine control settings (already fetched at the top)
          const fineAmount = fineControlSettings?.missingDailyTasksFine || 500;

          // Record the fine
          await db.collection('dailyTaskFines').insertOne({
            employeeId: new ObjectId(leadId),
            projectId: project._id,
            projectName: project.projectName || 'Unknown',
            date: today,
            fineAmount,
            appliedAt: new Date(),
            reason: `Did not set daily tasks before ${String(deadlineHour).padStart(2, '0')}:${String(deadlineMinute).padStart(2, '0')}`
          });

          // Update or create bonus/fine record for current month
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const bonusFineRecord = await db.collection('bonusFineRecords').findOne({
            employeeId: new ObjectId(leadId),
            period: 'monthly',
            month: currentMonth,
            year: currentYear
          });

          if (bonusFineRecord) {
            // Add to existing fine
            await db.collection('bonusFineRecords').updateOne(
              {
                employeeId: new ObjectId(leadId),
                period: 'monthly',
                month: currentMonth,
                year: currentYear
              },
              {
                $inc: {
                  missingDailyTasksFine: fineAmount
                },
                $set: {
                  updatedAt: new Date()
                }
              }
            );
          } else {
            // Create new record
            await db.collection('bonusFineRecords').insertOne({
              employeeId: new ObjectId(leadId),
              period: 'monthly',
              month: currentMonth,
              year: currentYear,
              missingDailyTasksFine: fineAmount,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }

          finesApplied.push({
            employeeId: leadId,
            employeeName: employee.name || 'Unknown',
            projectId: project._id.toString(),
            projectName: project.projectName || 'Unknown',
            fineAmount
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily tasks check completed',
      date: today.toISOString(),
      finesApplied: finesApplied.length,
      finesSkipped: finesSkipped.length,
      details: {
        applied: finesApplied,
        skipped: finesSkipped
      }
    });
  } catch (error) {
    console.error('Error checking daily tasks:', error);
    return NextResponse.json(
      { error: 'Failed to check daily tasks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to manually trigger the check (for testing)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Call the POST logic
    const result = await POST(request as any);
    return result;
  } catch (error) {
    console.error('Error in GET daily tasks check:', error);
    return NextResponse.json(
      { error: 'Failed to check daily tasks' },
      { status: 500 }
    );
  }
}
