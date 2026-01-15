import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import clientPromise, { dbConnect } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Task from '@/models/Task';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeeName = searchParams.get('employeeName');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!employeeName) {
      return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db('worknest');

    // Find employee by name
    const employee = await db.collection('users').findOne({
      name: employeeName,
      role: 'employee'
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employeeId = employee._id;

    // Build date range - match summary route logic exactly
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Parse date parameters and ensure proper time boundaries
    let startDate: Date;
    let endDate: Date;
    
    if (startDateParam) {
      // Parse the date string and set to start of day (local time)
      const parsedStart = new Date(startDateParam);
      startDate = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate());
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = today;
    }
    
    if (endDateParam) {
      // Parse the date string and set to end of day (local time)
      const parsedEnd = new Date(endDateParam);
      endDate = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate());
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = todayEnd;
    }

    console.log('=== BONUS DETAILS DEBUG ===');
    console.log('Employee ID:', employeeId.toString());
    console.log('Employee Name:', employeeName);
    console.log('Start Date:', startDate.toISOString());
    console.log('End Date:', endDate.toISOString());

    // Helper to normalize date to yyyy-mm-dd (local time)
    const toDateKey = (d: Date | string) => {
      const date = typeof d === "string" ? new Date(d) : d;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const tasksWithDetails: any[] = [];
    const checklistEntries: any[] = [];
    const projectEntries: any[] = [];
    const customBonus: any[] = [];
    const customFine: any[] = [];

    // ----------------------------
    // 1) Task-based Rewards/Fines
    // ----------------------------
    // Query all tasks - we'll filter by penalty/reward event date later
    const allTasks = await Task.find({}).lean();

    for (const task of allTasks as any[]) {
      // Check if this task is for this employee
      let isForEmployee = false;
      if (Array.isArray(task.assignees) && task.assignees.length > 0) {
        isForEmployee = task.assignees.some((id: any) => 
          id && (id.toString() === employeeId.toString())
        );
      } else if (task.assignedTo) {
        isForEmployee = task.assignedTo.toString() === employeeId.toString();
      }

      if (!isForEmployee) continue;

      const bonus = typeof task.bonusPoints === "number" ? task.bonusPoints : 0;
      const bonusCurrency = typeof task.bonusCurrency === "number" ? task.bonusCurrency : 0;
      let penalty = typeof task.penaltyPoints === "number" ? task.penaltyPoints : 0;
      let penaltyCurrency = typeof task.penaltyCurrency === "number" ? task.penaltyCurrency : 0;
      
      // If penaltyCurrency is 0 but penaltyPoints exists, use penaltyPoints as fallback
      if (penaltyCurrency <= 0 && penalty > 0) {
        penaltyCurrency = penalty;
      }

      // Skip tasks marked as not applicable
      if (task.notApplicable === true) {
        continue;
      }

      // Determine if this task resulted in reward or fine
      let baseDate: Date | null = null;
      let penaltyEventInPeriod = false;
      let rewardEventInPeriod = false;
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      const approvalStatus: string = task.approvalStatus || "pending";
      const nowLocal = new Date();

      // For recurring tasks (daily/weekly/monthly), use assigned date for deadlineDate if deadlineTime exists
      const isRecurring = ["daily", "weekly", "monthly"].includes(task.taskKind);
      
      if (approvalStatus === "approved") {
        if (task.status === "completed") {
          let deadlineDate: Date | null = null;

          if (task.deadlineTime) {
            // For recurring tasks, use assigned date
            if (isRecurring && task.assignedDate) {
              deadlineDate = new Date(task.assignedDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (task.deadlineDate) {
              deadlineDate = new Date(task.deadlineDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else {
              deadlineDate = new Date();
              deadlineDate.setHours(0, 0, 0, 0);
            }
            
            // Parse deadline time
            const [h, m] = task.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          } else if (task.dueDate) {
            deadlineDate = new Date(task.dueDate);
            if (task.dueTime) {
              const [h, m] = task.dueTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
          }

          const completedAt = task.tickedAt || task.completedAt || task.updatedAt || nowLocal;

          if (deadlineDate && completedAt > deadlineDate) {
            shouldGetPenalty = true;
            // Penalty event is when task was completed late
            baseDate = completedAt;
            const completedDate = new Date(completedAt);
            const deadlineDateObj = deadlineDate;
            
            // Normalize dates for comparison
            const completedDateNormalized = new Date(completedDate);
            completedDateNormalized.setHours(0, 0, 0, 0);
            const deadlineDateNormalized = new Date(deadlineDateObj);
            deadlineDateNormalized.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            
            // Include if completion happened in period OR deadline was in period
            if ((completedDateNormalized >= startDateNormalized && completedDateNormalized <= endDateNormalized) ||
                (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized)) {
              penaltyEventInPeriod = true;
            }
          } else if (bonus > 0 || bonusCurrency > 0) {
            shouldGetReward = true;
            // Reward event is when task was completed on time
            baseDate = completedAt;
            const completedDate = new Date(completedAt);
            completedDate.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            if (completedDate >= startDateNormalized && completedDate <= endDateNormalized) {
              rewardEventInPeriod = true;
            }
          }
          
          // Set baseDate if not set yet
          if (!baseDate) {
            baseDate = completedAt || task.assignedDate || task.createdAt;
          }
        } else {
          // Not completed but approved - if deadline passed, treat as penalty if configured
          let deadlineDate: Date | null = null;
          if (task.deadlineTime) {
            // For recurring tasks, use today's date
            if (isRecurring) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              deadlineDate = task.deadlineDate ? new Date(task.deadlineDate) : today;
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (task.deadlineDate) {
              deadlineDate = new Date(task.deadlineDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else {
              deadlineDate = new Date();
              deadlineDate.setHours(0, 0, 0, 0);
            }
            
            // Parse deadline time
            const [h, m] = task.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          } else if (task.dueDate) {
            deadlineDate = new Date(task.dueDate);
            if (task.dueTime) {
              const [h, m] = task.dueTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
          }
          if (deadlineDate && nowLocal > deadlineDate) {
            shouldGetPenalty = true;
            // Penalty event is when deadline passed
            baseDate = deadlineDate;
            // Normalize dates for comparison
            const deadlineDateNormalized = new Date(deadlineDate);
            deadlineDateNormalized.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            
            if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
              penaltyEventInPeriod = true;
            }
          }
          
          // Set baseDate if not set yet
          if (!baseDate) {
            baseDate = task.assignedDate || task.createdAt;
          }
        }
      } else if (
        approvalStatus === "rejected" ||
        approvalStatus === "deadline_passed"
      ) {
        if (penalty > 0 || penaltyCurrency > 0) {
          shouldGetPenalty = true;
          
          // For deadline_passed status, determine when the deadline actually passed
          if (approvalStatus === "deadline_passed") {
            // Calculate the deadline date that passed
            let deadlinePassedDate: Date | null = null;
            
            if (task.deadlineTime) {
              // For recurring tasks, use today's date if deadlineTime exists
              if (isRecurring) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                deadlinePassedDate = task.deadlineDate ? new Date(task.deadlineDate) : today;
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else if (task.deadlineDate) {
                deadlinePassedDate = new Date(task.deadlineDate);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else {
                deadlinePassedDate = new Date();
                deadlinePassedDate.setHours(0, 0, 0, 0);
              }
              
              // Parse deadline time
              const [h, m] = task.deadlineTime.split(":");
              deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else if (task.deadlineDate) {
              deadlinePassedDate = new Date(task.deadlineDate);
              deadlinePassedDate.setHours(23, 59, 59, 999);
            } else if (task.dueDate) {
              deadlinePassedDate = new Date(task.dueDate);
              if (task.dueTime) {
                const [h, m] = task.dueTime.split(":");
                deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
              } else {
                deadlinePassedDate.setHours(23, 59, 59, 999);
              }
            }
            
            // Use the deadline date that passed, or fallback to approval/update date
            if (deadlinePassedDate) {
              baseDate = deadlinePassedDate;
              // Normalize dates for comparison (compare dates, not times)
              const deadlineDateNormalized = new Date(deadlinePassedDate);
              deadlineDateNormalized.setHours(0, 0, 0, 0);
              const startDateNormalized = new Date(startDate);
              startDateNormalized.setHours(0, 0, 0, 0);
              const endDateNormalized = new Date(endDate);
              endDateNormalized.setHours(23, 59, 59, 999);
              
              // Check if this deadline date is within the selected period
              if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
                penaltyEventInPeriod = true;
              }
            } else {
              // Fallback to approval/update date if we can't determine deadline
              baseDate = task.approvedAt || task.updatedAt || task.createdAt;
              if (baseDate) {
                const approvedDate = new Date(baseDate);
                approvedDate.setHours(0, 0, 0, 0);
                const startDateNormalized = new Date(startDate);
                startDateNormalized.setHours(0, 0, 0, 0);
                const endDateNormalized = new Date(endDate);
                endDateNormalized.setHours(23, 59, 59, 999);
                if (approvedDate >= startDateNormalized && approvedDate <= endDateNormalized) {
                  penaltyEventInPeriod = true;
                }
              }
            }
          } else {
            // For rejected status, use approval/update date
            baseDate = task.approvedAt || task.updatedAt || task.createdAt;
            if (baseDate) {
              const approvedDate = new Date(baseDate);
              approvedDate.setHours(0, 0, 0, 0);
              const startDateNormalized = new Date(startDate);
              startDateNormalized.setHours(0, 0, 0, 0);
              const endDateNormalized = new Date(endDate);
              endDateNormalized.setHours(23, 59, 59, 999);
              if (approvedDate >= startDateNormalized && approvedDate <= endDateNormalized) {
                penaltyEventInPeriod = true;
              }
            }
          }
        }
        
        // Set baseDate if not set yet
        if (!baseDate) {
          baseDate = task.assignedDate || task.createdAt;
        }
      } else {
        // Task not approved yet - set baseDate for potential future processing
        baseDate = task.assignedDate || task.createdAt;
      }

      // Only include if penalty/reward event occurred in the period
      if (shouldGetPenalty && !penaltyEventInPeriod) {
        continue; // Skip if penalty event was outside the period
      }
      
      if (shouldGetReward && !rewardEventInPeriod) {
        continue; // Skip if reward event was outside the period
      }

      // Skip if no bonus or penalty to show
      if (!shouldGetPenalty && !shouldGetReward) {
        continue;
      }

      if (!baseDate) continue;

      // Get project name
      let projectName = 'Unknown Project';
      if (task.projectId) {
        const project = await db.collection('projects').findOne({
          _id: new ObjectId(task.projectId)
        });
        if (project) {
          projectName = project.projectName;
        }
      }

      tasksWithDetails.push({
        date: baseDate,
        taskTitle: task.title,
        projectName,
        bonusPoints: shouldGetReward ? bonus : 0,
        bonusCurrency: shouldGetReward ? bonusCurrency : 0,
        penaltyPoints: shouldGetPenalty ? penalty : 0,
        penaltyCurrency: shouldGetPenalty ? penaltyCurrency : 0
      });
    }

    // ----------------------------
    // 2) TaskCompletion Records (Historical tasks that were reset)
    // ----------------------------
    const TaskCompletion = (await import("@/models/TaskCompletion")).default;
    const taskCompletions = await TaskCompletion.find({
      approvalStatus: { $in: ["approved", "rejected", "deadline_passed"] }
    }).lean();

    for (const completion of taskCompletions as any[]) {
      // Check if completion is for this employee
      let isForEmployee = false;
      if (Array.isArray(completion.assignees) && completion.assignees.length > 0) {
        isForEmployee = completion.assignees.some((id: any) => 
          id && (id.toString() === employeeId.toString())
        );
      } else if (completion.assignedTo) {
        isForEmployee = completion.assignedTo.toString() === employeeId.toString();
      } else if (completion.completedBy) {
        isForEmployee = completion.completedBy.toString() === employeeId.toString();
      }

      if (!isForEmployee) continue;

      // Check if completion event occurred within the period
      const completionDate = completion.approvedAt || completion.tickedAt || completion.completedAt || completion.createdAt;
      if (!completionDate) continue;
      
      // Normalize dates for comparison
      const eventDate = new Date(completionDate);
      eventDate.setHours(0, 0, 0, 0);
      const startDateNormalized = new Date(startDate);
      startDateNormalized.setHours(0, 0, 0, 0);
      const endDateNormalized = new Date(endDate);
      endDateNormalized.setHours(23, 59, 59, 999);
      
      if (eventDate < startDateNormalized || eventDate > endDateNormalized) {
        continue; // Skip if outside period
      }

      const bonusCurrency = typeof completion.bonusCurrency === "number" ? completion.bonusCurrency : 0;
      const penaltyCurrency = typeof completion.penaltyCurrency === "number" ? completion.penaltyCurrency : 0;
      
      // Use penaltyPoints as fallback if penaltyCurrency is 0
      let finalPenaltyCurrency = penaltyCurrency;
      if (penaltyCurrency <= 0 && completion.penaltyPoints > 0) {
        finalPenaltyCurrency = completion.penaltyPoints;
      }

      const nowLocal = new Date();

      // Determine if this completion resulted in reward or fine
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      if (completion.approvalStatus === "approved") {
        // Check if task was completed late
        let deadlineDate: Date | null = null;
        if (completion.deadlineDate) {
          deadlineDate = new Date(completion.deadlineDate);
          if (completion.deadlineTime) {
            const [h, m] = completion.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        } else if (completion.dueDate) {
          deadlineDate = new Date(completion.dueDate);
          if (completion.dueTime) {
            const [h, m] = completion.dueTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        }

        const completedAt = completion.tickedAt || completion.completedAt || completionDate;
        if (deadlineDate && completedAt > deadlineDate) {
          shouldGetPenalty = true;
        } else if (bonusCurrency > 0 || (completion.bonusPoints && completion.bonusPoints > 0)) {
          shouldGetReward = true;
        }
      } else if (completion.approvalStatus === "rejected" || completion.approvalStatus === "deadline_passed") {
        if (finalPenaltyCurrency > 0) {
          shouldGetPenalty = true;
        }
      }

      // Skip if no bonus or penalty to show
      if (!shouldGetPenalty && !shouldGetReward) {
        continue;
      }

      // Get project name
      let projectName = 'Unknown Project';
      if (completion.projectId) {
        const project = await db.collection('projects').findOne({
          _id: new ObjectId(completion.projectId)
        });
        if (project) {
          projectName = project.projectName;
        }
      }

      tasksWithDetails.push({
        date: completionDate,
        taskTitle: completion.title || 'Task',
        projectName,
        bonusPoints: shouldGetReward ? (completion.bonusPoints || 0) : 0,
        bonusCurrency: shouldGetReward ? bonusCurrency : 0,
        penaltyPoints: shouldGetPenalty ? (completion.penaltyPoints || 0) : 0,
        penaltyCurrency: shouldGetPenalty ? finalPenaltyCurrency : 0
      });
    }

    console.log('Tasks with bonus/penalty for employee:', tasksWithDetails.length);

    // ----------------------------
    // 3) Checklist Rewards/Fines from Daily Updates
    // ----------------------------
    // Normalize dates for MongoDB query (ensure endDate includes the full day)
    const startDateForQuery = new Date(startDate);
    startDateForQuery.setHours(0, 0, 0, 0);
    const endDateForQuery = new Date(endDate);
    endDateForQuery.setHours(23, 59, 59, 999);
    
    const dailyUpdatesQuery: any = {
      employeeId: employeeId,
      adminApproved: true,
      date: { $gte: startDateForQuery, $lte: endDateForQuery }
    };

    const dailyUpdates = await db.collection('dailyUpdates').find(dailyUpdatesQuery).toArray();
    console.log('Daily updates found:', dailyUpdates.length);

    // Get checklist config to calculate rewards/fines
    const checklistConfig = await db.collection('checklistConfigs').findOne({ type: 'global' });
    const rewardMap = new Map<string, { bonus: number; bonusCurrency: number; fine: number; fineCurrency: number }>();
    
    if (checklistConfig && checklistConfig.checks) {
      for (const check of checklistConfig.checks) {
        if (typeof check === 'string') continue;
        const label = (check.text || '').toLowerCase().trim();
        if (!label) continue;
        rewardMap.set(label, {
          bonus: check.bonus || 0,
          bonusCurrency: check.bonusCurrency || 0,
          fine: check.fine || 0,
          fineCurrency: check.fineCurrency || 0
        });
      }
    }

    for (const du of dailyUpdates) {
      if (!du.checklist || !Array.isArray(du.checklist)) continue;
      
      for (const item of du.checklist) {
        const labelKey = (item.label || '').toLowerCase().trim();
        const cfg = rewardMap.get(labelKey);
        if (!cfg) continue;

        let bonusPoints = 0;
        let bonusCurrency = 0;
        let penaltyPoints = 0;
        let penaltyCurrency = 0;

        if (item.checked) {
          bonusPoints = cfg.bonus;
          bonusCurrency = cfg.bonusCurrency;
        } else {
          penaltyPoints = cfg.fine;
          penaltyCurrency = cfg.fineCurrency;
        }

        if (bonusPoints > 0 || bonusCurrency > 0 || penaltyPoints > 0 || penaltyCurrency > 0) {
          checklistEntries.push({
            date: du.date || du.createdAt,
            description: `Checklist: ${item.label}`,
            bonusPoints,
            bonusCurrency,
            penaltyPoints,
            penaltyCurrency
          });
        }
      }
    }

    console.log('Checklist entries with rewards/penalties:', checklistEntries.length);

    // ----------------------------
    // 4) Project-level Rewards/Fines
    // ----------------------------
    const projects = await db.collection('projects').find({
      leadAssignee: { $in: [employeeId, employeeId.toString()] },
      assignedAt: { $gte: startDateForQuery, $lte: endDateForQuery }
    }).toArray();

    for (const project of projects) {
      const bonusPoints = project.bonusPoints || 0;
      const bonusCurrency = project.bonusCurrency || 0;
      const penaltyPoints = project.penaltyPoints || 0;
      const penaltyCurrency = project.penaltyCurrency || 0;

      if (bonusPoints > 0 || bonusCurrency > 0 || penaltyPoints > 0 || penaltyCurrency > 0) {
        projectEntries.push({
          date: project.assignedAt || project.updatedAt || project.createdAt,
          description: `Project: ${project.projectName}`,
          projectName: project.projectName,
          bonusPoints,
          bonusCurrency,
          penaltyPoints,
          penaltyCurrency
        });
      }
    }

    console.log('Project entries with rewards/penalties:', projectEntries.length);

    // ----------------------------
    // 5) Custom Bonus/Fine Entries
    // ----------------------------
    // Use date keys (YYYY-MM-DD strings) to match summary route logic
    const startDateKey = toDateKey(startDate);
    const endDateKey = toDateKey(endDate);
    
    // Helper to normalize employeeId to string (handle both ObjectId and string)
    const normalizeEmployeeId = (id: any): string => {
      if (!id) return '';
      if (id instanceof ObjectId) return id.toString();
      if (typeof id === 'string') return id;
      if (id && typeof id === 'object' && id.toString) return id.toString();
      return String(id);
    };
    
    const normalizedEmployeeId = normalizeEmployeeId(employeeId);
    
    // Fetch custom bonus/fine data from customBonusFine collection (matching summary route)
    const customBonusFineData = await db
      .collection("customBonusFine")
      .find({
        date: { $gte: startDateKey, $lte: endDateKey }
      })
      .toArray();
    
    console.log(`[Bonus Details] Found ${customBonusFineData.length} custom bonus/fine records between ${startDateKey} and ${endDateKey}`);
    
    // Transform entries to ensure they match the expected format
    const transformEntries = (entries: any[]) => {
      const transformed: any[] = [];
      for (const entry of entries) {
        // If entry already has the correct format, add as is
        if (entry.type && entry.value !== undefined) {
          transformed.push(entry);
        } else if (entry.finePoints !== undefined || entry.fineCurrency !== undefined) {
          // If entry has finePoints/fineCurrency (old format), convert to new format
          if (entry.finePoints > 0) {
            transformed.push({
              type: 'points',
              value: entry.finePoints,
              description: entry.description || 'Custom fine'
            });
          }
          if (entry.fineCurrency > 0) {
            transformed.push({
              type: 'currency',
              value: entry.fineCurrency,
              description: entry.description || 'Custom fine'
            });
          }
        }
      }
      return transformed;
    };
    
    // Filter and process custom entries for this employee
    for (const custom of customBonusFineData) {
      const customEmployeeId = normalizeEmployeeId(custom.employeeId);
      
      // Only include entries for this employee
      if (customEmployeeId !== normalizedEmployeeId) {
        continue;
      }
      
      // Transform and add bonus entries
      const bonusEntries = transformEntries(custom.customBonusEntries || []);
      bonusEntries.forEach((entry: any) => {
        customBonus.push({
          date: custom.date,
          description: entry.description,
          type: entry.type,
          value: entry.value
        });
      });
      
      // Transform and add fine entries
      const fineEntries = transformEntries(custom.customFineEntries || []);
      fineEntries.forEach((entry: any) => {
        customFine.push({
          date: custom.date,
          description: entry.description,
          type: entry.type,
          value: entry.value
        });
      });
    }
    
    console.log(`[Bonus Details] Custom bonus entries: ${customBonus.length}, Custom fine entries: ${customFine.length}`);

    // Calculate summary
    let totalPointsEarned = 0;
    let totalCurrencyEarned = 0;
    let totalPointsPenalty = 0;
    let totalCurrencyPenalty = 0;

    // Sum from tasks
    tasksWithDetails.forEach(task => {
      totalPointsEarned += task.bonusPoints;
      totalCurrencyEarned += task.bonusCurrency;
      totalPointsPenalty += task.penaltyPoints;
      totalCurrencyPenalty += task.penaltyCurrency;
    });

    // Sum from checklists
    checklistEntries.forEach(entry => {
      totalPointsEarned += entry.bonusPoints;
      totalCurrencyEarned += entry.bonusCurrency;
      totalPointsPenalty += entry.penaltyPoints;
      totalCurrencyPenalty += entry.penaltyCurrency;
    });

    // Sum from projects
    projectEntries.forEach(entry => {
      totalPointsEarned += entry.bonusPoints;
      totalCurrencyEarned += entry.bonusCurrency;
      totalPointsPenalty += entry.penaltyPoints;
      totalCurrencyPenalty += entry.penaltyCurrency;
    });

    // Sum from custom bonus
    customBonus.forEach(entry => {
      if (entry.type === 'points') {
        totalPointsEarned += entry.value;
      } else {
        totalCurrencyEarned += entry.value;
      }
    });

    // Sum from custom fine
    customFine.forEach(entry => {
      if (entry.type === 'points') {
        totalPointsPenalty += entry.value;
      } else {
        totalCurrencyPenalty += entry.value;
      }
    });

    return NextResponse.json({
      employeeName,
      tasks: tasksWithDetails,
      checklists: checklistEntries,
      projects: projectEntries,
      customBonus,
      customFine,
      summary: {
        totalPointsEarned,
        totalCurrencyEarned,
        totalPointsPenalty,
        totalCurrencyPenalty
      }
    });
  } catch (error) {
    console.error('Error fetching employee bonus details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee bonus details' },
      { status: 500 }
    );
  }
}
