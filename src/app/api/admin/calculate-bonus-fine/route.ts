import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface BonusFineCalculation {
  employeeId: string;
  employeeName: string;
  email: string;
  
  // Metrics
  productsCount: number;
  attendanceHours: number;
  absentDays: number;
  dailyUpdatesCount: number;
  missingDailyUpdates: number;
  missingTeamMeetings: number;
  missingInternalMeetings: number;
  missingClientMeetings: number;
  completedProjects: number;
  approvedClientProjects: number;
  isProjectLead: boolean;
  isInTraining: boolean;
  monthsWorked: number;
  hasDailyLoomAndGForm: boolean;
  
  // Bonuses
  baseBonus: number;
  productsBonus: number;
  attendanceBonus140: number;
  attendanceBonus160: number;
  attendanceBonus200: number;
  dailyLoomGFormBonus: number;
  loyaltyBonus: number;
  completedProjectsBonus: number;
  hackathonBonus: number;
  fresherBonus: number;
  totalBonus: number;
  
  // Fines
  missingDailyUpdatesFine: number;
  missingTeamMeetingsFine: number;
  missingInternalMeetingsFine: number;
  missingClientMeetingsFine: number;
  missingDailyTasksFine: number;
  absenceFines: number;
  totalFine: number;
  
  // Net Amount
  netAmount: number;
  
  // Conditions
  noPaymentConditions: string[];
  noFineConditions: string[];
  
  // Manual Override
  manualBonus?: number;
  manualFine?: number;
  adminNotes?: string;
  approvedByCoreTeam?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { employeeId, period } = await request.json();
    
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get employee profile
    const employeeProfile = await db.collection('employeeProfiles').findOne({
      _id: new ObjectId(employeeId)
    });

    if (!employeeProfile) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const userId = employeeProfile.userId;
    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId)
    });

    // Calculate period dates
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day;
      startDate = new Date(now.setDate(diff));
    } else {
      // Daily - use current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    startDate.setHours(0, 0, 0, 0);

    // Get all projects where employee is lead assignee, VA Incharge, or Update Incharge
    const projects = await db.collection('projects').find({
      $or: [
        { leadAssignee: new ObjectId(userId) },
        { vaIncharge: new ObjectId(userId) },
        { updateIncharge: new ObjectId(userId) }
      ]
    }).toArray();

    const completedProjects = projects.filter(p => p.status === 'completed');
    const approvedClientProjects = projects.filter(p => 
      p.status === 'completed' && p.clientProgress === 100
    );
    const approvedClientProjectsCount = approvedClientProjects.length;

    // Check if employee is a project lead (lead assignee of any project)
    const leadProjects = await db.collection('projects').find({
      leadAssignee: new ObjectId(userId)
    }).toArray();
    const isProjectLead = leadProjects.length > 0;
    
    // Check if employee completed any projects as Lead Assignee (for 2x bonus on completed projects only)
    const completedProjectsAsLead = leadProjects.filter((p: any) => p.status === 'completed');
    const hasCompletedProjectsAsLead = completedProjectsAsLead.length > 0;

    // Calculate attendance hours from attendance records
    const attendanceRecords = await db.collection('attendance').find({
      userId: new ObjectId(userId),
      date: { $gte: startDate }
    }).toArray();

    // Calculate total attendance hours (use actual hours if available, else default to 8)
    const attendanceHours = attendanceRecords.reduce((sum: number, record: any) => {
      return sum + (record.hoursWorked || 8);
    }, 0);

    // Calculate days in the period (from start date to now)
    const daysInPeriod = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Absent days = days in period - days with attendance
    // Only count days where attendance is less than 4 hours as absent (per rule 2.2)
    const absentDays = Math.max(0, daysInPeriod - attendanceRecords.length);

    // Get daily updates - Mongoose creates 'dailyupdates' collection (lowercase, pluralized)
    const dailyUpdates = await db.collection('dailyupdates').find({
      employeeId: new ObjectId(userId),
      date: { $gte: startDate },
      adminApproved: true
    }).toArray();

    const dailyUpdatesCount = dailyUpdates.length;
    
    // Check for daily Loom and GForm updates - calculate percentage of days with both
    const loomGFormCount = dailyUpdates.filter((update: any) => 
      update.recordedLoomVideos === true && update.updatedDailyProgress === true
    ).length;
    
    // If 80% or more of updates have both Loom and GForm, consider it consistent
    const hasDailyLoomAndGForm = dailyUpdatesCount > 0 && (loomGFormCount / dailyUpdatesCount) >= 0.8;

    // Calculate missing updates - allow 3 days grace period before counting fines
    // Only count missing updates if more than 3 days are missing
    const missingDailyUpdates = Math.max(0, daysInPeriod - dailyUpdatesCount);
    
    // Calculate missing meetings (simplified - would need meeting records)
    const missingTeamMeetings = 0; // TODO: Implement meeting tracking
    const missingInternalMeetings = 0; // TODO: Implement meeting tracking
    const missingClientMeetings = 0; // TODO: Implement meeting tracking

    // Check if in training period (less than 3 months)
    const joiningDate = employeeProfile.createdAt || employeeProfile.joiningDate || new Date();
    const monthsWorked = Math.floor((now.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
    const isInTraining = monthsWorked < 3;

    // Calculate products count (completed projects count)
    const productsCount = completedProjects.length;

    // Initialize calculation
    const calculation: BonusFineCalculation = {
      employeeId: employeeProfile._id.toString(),
      employeeName: employeeProfile.fullName || user?.name || 'Unknown',
      email: user?.email || '',
      productsCount,
      attendanceHours,
      absentDays,
      dailyUpdatesCount,
      missingDailyUpdates,
      missingTeamMeetings,
      missingInternalMeetings,
      missingClientMeetings,
      completedProjects: completedProjects.length,
      approvedClientProjects: approvedClientProjectsCount,
      isProjectLead,
      isInTraining,
      monthsWorked,
      hasDailyLoomAndGForm,
      baseBonus: 0,
      productsBonus: 0,
      attendanceBonus140: 0,
      attendanceBonus160: 0,
      attendanceBonus200: 0,
      dailyLoomGFormBonus: 0,
      loyaltyBonus: 0,
      completedProjectsBonus: 0,
      hackathonBonus: 0,
      fresherBonus: 0,
      totalBonus: 0,
      missingDailyUpdatesFine: 0,
      missingTeamMeetingsFine: 0,
      missingInternalMeetingsFine: 0,
      missingClientMeetingsFine: 0,
      missingDailyTasksFine: 0,
      absenceFines: 0,
      totalFine: 0,
      netAmount: 0,
      noPaymentConditions: [],
      noFineConditions: []
    };

    // Calculate Bonuses
    // Base is separate (not a bonus, so not multiplied for Project Leads)
    // 1.6. Base: 5000
    calculation.baseBonus = 5000;

    // Actual bonuses (these will be multiplied for Project Leads)
    // 1.1. More than 3 products: 1000
    if (productsCount > 3) {
      calculation.productsBonus = 1000;
    }

    // 1.2-1.4. Attendance bonuses
    if (attendanceHours > 200) {
      calculation.attendanceBonus200 = 2000;
    } else if (attendanceHours > 160) {
      calculation.attendanceBonus160 = 1000;
    } else if (attendanceHours > 140) {
      calculation.attendanceBonus140 = 500;
    }

    // 1.5. Daily Loom and GForm Update: 1000
    if (hasDailyLoomAndGForm && dailyUpdatesCount > 0) {
      calculation.dailyLoomGFormBonus = 1000;
    }

    // 6.1. Loyalty bonus after 6 months: 2000
    if (monthsWorked >= 6) {
      calculation.loyaltyBonus = 2000;
    }

    // 6.2. Completed projects bonus: 2000
    if (completedProjects.length > 0) {
      calculation.completedProjectsBonus = 2000;
    }

    // Apply 2x multiplier ONLY to completedProjectsBonus if employee completed projects as Lead Assignee
    // All other bonuses remain at 1x
    if (hasCompletedProjectsAsLead) {
      calculation.completedProjectsBonus = calculation.completedProjectsBonus * 2;
    }

    // Calculate total of actual bonuses (excluding base)
    calculation.totalBonus = 
      calculation.productsBonus +
      calculation.attendanceBonus140 +
      calculation.attendanceBonus160 +
      calculation.attendanceBonus200 +
      calculation.dailyLoomGFormBonus +
      calculation.loyaltyBonus +
      calculation.completedProjectsBonus +
      calculation.hackathonBonus +
      calculation.fresherBonus;

    // ============================================
    // CALCULATE FINES - SIMPLIFIED LOGIC
    // ============================================
    
    // Step 1: Calculate individual fines
    // 3.1. Missing Daily Updates (>3 days): 200 per day after 3-day grace
    calculation.missingDailyUpdatesFine = missingDailyUpdates > 3 ? (missingDailyUpdates - 3) * 200 : 0;
    
    // 3.2. Missing Team Meeting (>3 days): 300 per occurrence after 3 days
    calculation.missingTeamMeetingsFine = missingTeamMeetings > 3 ? (missingTeamMeetings - 3) * 300 : 0;
    
    // 3.3. Missing Internal Meeting (>3 days): 200 per occurrence after 3 days
    calculation.missingInternalMeetingsFine = missingInternalMeetings > 3 ? (missingInternalMeetings - 3) * 200 : 0;
    
    // 3.4. Missing Client meetings (>1): 300 per occurrence after 1 day
    calculation.missingClientMeetingsFine = missingClientMeetings > 1 ? (missingClientMeetings - 1) * 300 : 0;
    
    // Step 2: Calculate absence fine based on absent days
    // 4. Daily Fines Based on Absence (tiered system)
    if (absentDays >= 14) {
      calculation.absenceFines = -500; // 14+ days: -500 deduction from total fine
    } else if (absentDays >= 7) {
      calculation.absenceFines = 1000; // 7-13 days: 1000
    } else if (absentDays >= 5) {
      calculation.absenceFines = 1500; // 5-6 days: 1500
    } else if (absentDays >= 3) {
      calculation.absenceFines = 2000; // 3-4 days: 2000
    } else if (absentDays >= 2) {
      calculation.absenceFines = 2500; // 2 days: 2500
    } else if (absentDays >= 1) {
      calculation.absenceFines = 3000; // 1 day: 3000
    } else {
      calculation.absenceFines = 0; // 0 days: no fine
    }
    
    // 3.5. Missing Daily Tasks Fine (for lead assignees who didn't set tasks before admin-configured deadline)
    // Get fines from dailyTaskFines collection for this period
    const dailyTaskFines = await db.collection('dailyTaskFines').find({
      employeeId: new ObjectId(userId),
      date: { $gte: startDate }
    }).toArray();
    
    calculation.missingDailyTasksFine = dailyTaskFines.reduce((sum: number, fine: any) => {
      return sum + (fine.fineAmount || 0);
    }, 0);

    // Get fine control settings to show deadline info and check for pending fines
    const fineControlSettings = await db.collection('fineControlSettings').findOne({
      type: 'default'
    });
    const deadlineHour = fineControlSettings?.dailyTasksDeadlineHour ?? 10;
    const deadlineMinute = fineControlSettings?.dailyTasksDeadlineMinute ?? 0;
    const fineAmount = fineControlSettings?.missingDailyTasksFine || 500;
    const deadlineTime = `${String(deadlineHour).padStart(2, '0')}:${String(deadlineMinute).padStart(2, '0')}`;
    
    // Check for pending fine for today (if deadline has passed but fine not yet applied)
    const currentTime = new Date();
    const today = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(today);
    deadline.setHours(deadlineHour, deadlineMinute, 0, 0);
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    // Only check pending fine if deadline has passed today
    if (currentTime >= deadline) {
      // Check if user is a lead assignee of any active project
      // Handle both single ObjectId and array of ObjectIds for leadAssignee
      const userIdObj = new ObjectId(userId);
      const allProjects = await db.collection('projects').find({
        status: 'in_progress'
      }).toArray();
      
      // Filter projects where user is a lead assignee
      const activeProjects = allProjects.filter((project: any) => {
        if (!project.leadAssignee) return false;
        if (Array.isArray(project.leadAssignee)) {
          return project.leadAssignee.some((lead: any) => {
            const leadId = lead instanceof ObjectId ? lead : (lead._id ? lead._id : new ObjectId(lead));
            return leadId.equals(userIdObj);
          });
        } else {
          const leadId = project.leadAssignee instanceof ObjectId 
            ? project.leadAssignee 
            : (project.leadAssignee._id ? project.leadAssignee._id : new ObjectId(project.leadAssignee));
          return leadId.equals(userIdObj);
        }
      });
      
      if (activeProjects.length > 0) {
        // Check if fine was already applied today
        const todayFine = await db.collection('dailyTaskFines').findOne({
          employeeId: userIdObj,
          date: { 
            $gte: today, 
            $lt: todayEnd
          }
        });
        
        // Check if marked NA for any active project today
        let isMarkedNA = false;
        for (const project of activeProjects) {
          const todayNA = await db.collection('dailyTaskNA').findOne({
            employeeId: userIdObj,
            projectId: project._id,
            date: { 
              $gte: today, 
              $lt: todayEnd
            }
          });
          if (todayNA) {
            isMarkedNA = true;
            break;
          }
        }
        
        // Check if any tasks were created today before deadline for any active project
        let hasCreatedTasksToday = false;
        for (const project of activeProjects) {
          const tasksCreatedToday = await db.collection('tasks').find({
            projectId: project._id,
            createdBy: userIdObj,
            createdAt: {
              $gte: today,
              $lt: deadline
            }
          }).toArray();
          
          if (tasksCreatedToday.length > 0) {
            hasCreatedTasksToday = true;
            break;
          }
        }
        
        // If deadline passed, no tasks created, not NA, and no fine applied yet - show pending fine
        if (!todayFine && !isMarkedNA && !hasCreatedTasksToday) {
          calculation.missingDailyTasksFine += fineAmount;
          (calculation as any).missingDailyTasksFineDetails = `Deadline: ${deadlineTime} - Includes pending fine for today (will be applied automatically)`;
        } else if (calculation.missingDailyTasksFine > 0) {
          (calculation as any).missingDailyTasksFineDetails = `Deadline: ${deadlineTime} - Applied for days when no tasks were created before this time`;
        }
      } else if (calculation.missingDailyTasksFine > 0) {
        (calculation as any).missingDailyTasksFineDetails = `Deadline: ${deadlineTime} - Applied for days when no tasks were created before this time`;
      }
    } else if (calculation.missingDailyTasksFine > 0) {
      (calculation as any).missingDailyTasksFineDetails = `Deadline: ${deadlineTime} - Applied for days when no tasks were created before this time`;
    }

    // Step 3: Sum all fines
    const sumOfAllFines = 
      calculation.missingDailyUpdatesFine +
      calculation.missingTeamMeetingsFine +
      calculation.missingInternalMeetingsFine +
      calculation.missingClientMeetingsFine +
      calculation.missingDailyTasksFine +
      calculation.absenceFines;
    
    // Step 4: Check No Fine Conditions (8.1-8.2) - if met, no fines at all
    if (productsCount > 3) {
      calculation.noFineConditions.push('Developed more than 3 products');
    }
    if (approvedClientProjectsCount > 3) {
      calculation.noFineConditions.push('Approved client projects > 3');
    }
    
    if (calculation.noFineConditions.length > 0) {
      calculation.totalFine = 0;
    } else {
      calculation.totalFine = sumOfAllFines;
    }
    
    // Step 5: Training period - no fines
    if (isInTraining) {
      calculation.totalFine = 0;
    }
    
    // Step 6: Apply Project Lead 2x multiplier to fines (only if totalFine > 0)
    if (isProjectLead && calculation.totalFine > 0) {
      calculation.totalFine = calculation.totalFine * 2;
    }
    
    // Step 7: Ensure totalFine is never negative (minimum is 0)
    if (calculation.totalFine < 0) {
      calculation.totalFine = 0;
    }
    
    // Step 8: Check No Payment Conditions (2.1-2.4)
    if (attendanceHours < 100) {
      calculation.noPaymentConditions.push('Attendance < 100 hours');
    }
    if (absentDays > 4) {
      calculation.noPaymentConditions.push('Absent > 4 days');
    }
    if (productsCount === 0) {
      calculation.noPaymentConditions.push('0 products');
    }
    
    // Step 9: Ensure bonuses are never negative
    if (calculation.totalBonus < 0) {
      calculation.totalBonus = 0;
    }

    // Calculate net amount (base + bonuses - fines)
    calculation.netAmount = calculation.baseBonus + calculation.totalBonus - calculation.totalFine;

    // If no payment conditions exist and not approved by core team, set net to 0
    if (calculation.noPaymentConditions.length > 0 && !calculation.approvedByCoreTeam) {
      calculation.netAmount = 0;
    }

    // Check for existing record
    const existingRecord = await db.collection('bonusFineRecords').findOne({
      employeeId: new ObjectId(employeeId),
      period: period || 'monthly',
      month: now.getMonth(),
      year: now.getFullYear()
    });

    if (existingRecord) {
      // Only apply manual overrides if they are valid (non-negative for bonus, can be any for fine)
      if (existingRecord.manualBonus !== undefined && existingRecord.manualBonus !== null) {
        calculation.manualBonus = Math.max(0, existingRecord.manualBonus); // Ensure bonus is never negative
        calculation.totalBonus = calculation.manualBonus;
      }
      if (existingRecord.manualFine !== undefined && existingRecord.manualFine !== null) {
        calculation.manualFine = existingRecord.manualFine;
        calculation.totalFine = Math.max(0, existingRecord.manualFine); // Ensure fine is never negative
      }
      if (existingRecord.adminNotes) {
        calculation.adminNotes = existingRecord.adminNotes;
      }
      if (existingRecord.approvedByCoreTeam !== undefined) {
        calculation.approvedByCoreTeam = existingRecord.approvedByCoreTeam;
      }
      calculation.netAmount = calculation.baseBonus + calculation.totalBonus - calculation.totalFine;
    }

    return NextResponse.json({ calculation });
  } catch (error) {
    console.error('Error calculating bonus/fine:', error);
    return NextResponse.json(
      { error: 'Failed to calculate bonus/fine' },
      { status: 500 }
    );
  }
}

