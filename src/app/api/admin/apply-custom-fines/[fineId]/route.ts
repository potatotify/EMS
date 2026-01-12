import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * POST /api/admin/apply-custom-fines/[fineId]
 * Apply a single custom fine immediately
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fineId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { fineId } = await params;
    const client = await clientPromise;
    const db = client.db('worknest');

    // Get the specific custom fine
    const customFine = await db.collection('customFines').findOne({
      _id: new ObjectId(fineId),
      isActive: true
    });

    if (!customFine) {
      return NextResponse.json({ 
        error: 'Custom fine not found or inactive' 
      }, { status: 404 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);

    // Helper function to normalize ID for comparison
    const normalizeId = (id: any): string => {
      if (!id) return '';
      if (id instanceof ObjectId) return id.toString();
      if (typeof id === 'string') return id;
      if (id && typeof id === 'object' && id._id) {
        return id._id instanceof ObjectId ? id._id.toString() : String(id._id);
      }
      return String(id);
    };

    let finesApplied = 0;
    const finesSkipped: Array<{
      employeeId: string;
      employeeName: string;
      reason: string;
    }> = [];

    // Process based on criteria
    if (customFine.criteria === 'default_fine') {
      // For default fines, apply immediately to all selected employees
      const employeeIds = customFine.employeeIds.map((id: any) => {
        if (id instanceof ObjectId) return id;
        if (typeof id === 'string') return new ObjectId(id);
        return new ObjectId(String(id));
      });

      for (const employeeIdObj of employeeIds) {
        try {
          const employeeIdStr = normalizeId(employeeIdObj);
          const employeeId = new ObjectId(employeeIdStr);

          // Get employee details
          const employee = await db.collection('users').findOne({
            _id: employeeId,
            role: 'employee'
          });

          if (!employee) {
            finesSkipped.push({
              employeeId: employeeIdStr,
              employeeName: 'Unknown',
              reason: 'Employee not found'
            });
            continue;
          }

          // Check if fine was already applied (for one-time fines) and not manually deleted
          const existingFine = await db.collection('customFineRecords').findOne({
            customFineId: customFine._id,
            employeeId: employeeId,
            manuallyDeleted: { $ne: true } // Exclude manually deleted records
          });

          if (existingFine) {
            finesSkipped.push({
              employeeId: employeeIdStr,
              employeeName: employee.name || 'Unknown',
              reason: 'Fine already applied'
            });
            continue;
          }

          // Format date as YYYY-MM-DD for bonus summary
          const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          // Record the fine in customFineRecords
          await db.collection('customFineRecords').insertOne({
            customFineId: customFine._id,
            employeeId: employeeId,
            date: today,
            finePoints: customFine.finePoints,
            fineCurrency: customFine.fineCurrency,
            criteria: customFine.criteria,
            fineType: customFine.fineType || 'one-time',
            description: customFine.description || '',
            appliedAt: new Date(),
            reason: customFine.description || 'Default fine applied'
          });

          // Update or create customBonusFine entry
          // Format entries to match CustomEntry interface: { type: 'points'|'currency', value: number, description: string }
          const fineEntries = [];
          if (customFine.finePoints > 0) {
            fineEntries.push({
              type: 'points',
              value: customFine.finePoints,
              description: customFine.description || 'Default fine'
            });
          }
          if (customFine.fineCurrency > 0) {
            fineEntries.push({
              type: 'currency',
              value: customFine.fineCurrency,
              description: customFine.description || 'Default fine'
            });
          }

          if (fineEntries.length > 0) {
            await db.collection('customBonusFine').updateOne(
              { employeeId: employeeId, date: dateKey },
              {
                $push: {
                  customFineEntries: { $each: fineEntries }
                },
                $setOnInsert: {
                  employeeId: employeeId,
                  date: dateKey,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              } as any,
              { upsert: true }
            );
          }

          // Update monthly bonusFineRecords
          const month = now.getMonth();
          const year = now.getFullYear();
          await db.collection('bonusFineRecords').updateOne(
            {
              employeeId: employeeId,
              period: 'monthly',
              month,
              year
            },
            {
              $inc: {
                customFinesPoints: customFine.finePoints,
                customFinesCurrency: customFine.fineCurrency
              },
              $setOnInsert: {
                employeeId: employeeId,
                period: 'monthly',
                month,
                year,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            },
            { upsert: true }
          );

          finesApplied++;
        } catch (error) {
          console.error(`[Apply Single Fine] Error processing employee ${employeeIdObj}:`, error);
          finesSkipped.push({
            employeeId: normalizeId(employeeIdObj),
            employeeName: 'Unknown',
            reason: 'Error processing employee'
          });
        }
      }
    } else if (customFine.criteria === 'lead_assignee_no_task_created') {
      // For lead assignee criteria, check if deadline has passed
      const deadline = new Date(today);
      deadline.setHours(customFine.timeHour, customFine.timeMinute, 0, 0);

      if (now.getTime() < deadline.getTime()) {
        return NextResponse.json({
          success: true,
          message: 'Deadline not reached yet',
          finesApplied: 0,
          finesSkipped: 1,
          details: {
            skipped: [{
              reason: `Deadline not reached yet (deadline: ${customFine.timeHour}:${String(customFine.timeMinute).padStart(2, '0')})`
            }]
          }
        });
      }

      // Apply the fine using the same logic as the main apply-custom-fines route
      // (This is a simplified version - you might want to refactor the logic)
      return NextResponse.json({
        success: true,
        message: 'Use the main apply endpoint for lead assignee fines',
        finesApplied: 0,
        finesSkipped: 0
      });
    }

    return NextResponse.json({
      success: true,
      message: `Fine applied successfully`,
      finesApplied,
      finesSkipped: finesSkipped.length,
      details: {
        skipped: finesSkipped
      }
    });
  } catch (error) {
    console.error('Error applying single custom fine:', error);
    return NextResponse.json(
      { error: 'Failed to apply fine' },
      { status: 500 }
    );
  }
}
