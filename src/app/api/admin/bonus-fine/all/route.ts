import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to calculate bonus/fine for a single employee
async function calculateEmployeeBonusFine(employeeId: string, period: string, db: any) {
  // Get employee profile
  const employeeProfile = await db.collection('employeeProfiles').findOne({
    _id: new ObjectId(employeeId)
  });

  if (!employeeProfile) {
    return null;
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

  const completedProjects = projects.filter((p: any) => p.status === 'completed');
  const approvedClientProjects = projects.filter((p: any) => 
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

  // Calculate attendance
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

  // Calculate missing daily updates - allow 3 days grace period before counting fines
  const missingDailyUpdates = Math.max(0, daysInPeriod - dailyUpdatesCount);

  // Check training period
  const joiningDate = employeeProfile.createdAt || employeeProfile.joiningDate || new Date();
  const monthsWorked = Math.floor((now.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
  const isInTraining = monthsWorked < 3;

  const productsCount = completedProjects.length;

  // Initialize calculation
  const calculation: any = {
    employeeId: employeeProfile._id.toString(),
    employeeName: employeeProfile.fullName || user?.name || 'Unknown',
    email: user?.email || '',
    productsCount,
    attendanceHours,
    absentDays,
    dailyUpdatesCount,
    missingDailyUpdates,
    missingTeamMeetings: 0,
    missingInternalMeetings: 0,
    missingClientMeetings: 0,
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
    taskBonus: 0,
    totalBonus: 0,
    missingDailyUpdatesFine: 0,
    missingTeamMeetingsFine: 0,
    missingInternalMeetingsFine: 0,
    missingClientMeetingsFine: 0,
    missingDailyTasksFine: 0,
    taskFines: 0,
    absenceFines: 0,
    totalFine: 0,
    netAmount: 0,
    noPaymentConditions: [],
    noFineConditions: []
  };

  // Calculate Bonuses
  // Base is separate (not a bonus, so not multiplied for Project Leads)
  calculation.baseBonus = 5000;
  
  // Actual bonuses (these will be multiplied for Project Leads)
  if (productsCount > 3) calculation.productsBonus = 1000;
  if (attendanceHours > 200) calculation.attendanceBonus200 = 2000;
  else if (attendanceHours > 160) calculation.attendanceBonus160 = 1000;
  else if (attendanceHours > 140) calculation.attendanceBonus140 = 500;
  if (hasDailyLoomAndGForm && dailyUpdatesCount > 0) calculation.dailyLoomGFormBonus = 1000;
  if (monthsWorked >= 6) calculation.loyaltyBonus = 2000;
  if (completedProjects.length > 0) calculation.completedProjectsBonus = 2000;

  // Apply 2x multiplier ONLY to completedProjectsBonus if employee completed projects as Lead Assignee
  // All other bonuses remain at 1x
  if (hasCompletedProjectsAsLead) {
    calculation.completedProjectsBonus = calculation.completedProjectsBonus * 2;
  }

  // Calculate total of actual bonuses (excluding base)
  // Note: taskBonus will be added after task fines calculation
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
  calculation.missingTeamMeetingsFine = calculation.missingTeamMeetings > 3 ? (calculation.missingTeamMeetings - 3) * 300 : 0;
  
  // 3.3. Missing Internal Meeting (>3 days): 200 per occurrence after 3 days
  calculation.missingInternalMeetingsFine = calculation.missingInternalMeetings > 3 ? (calculation.missingInternalMeetings - 3) * 200 : 0;
  
  // 3.4. Missing Client meetings (>1): 300 per occurrence after 1 day
  calculation.missingClientMeetingsFine = calculation.missingClientMeetings > 1 ? (calculation.missingClientMeetings - 1) * 300 : 0;
  
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
  // Reuse the 'now' variable that was already defined at the top of the function
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(today);
  deadline.setHours(deadlineHour, deadlineMinute, 0, 0);
  const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  
  // Only check pending fine if deadline has passed today
  if (now >= deadline) {
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

  // 3.6. Custom Fines (from customFineRecords)
  const customFineRecords = await db.collection('customFineRecords').find({
    employeeId: new ObjectId(userId),
    date: { $gte: startDate }
  }).toArray();
  
  const customFinesPoints = customFineRecords.reduce((sum: number, record: any) => {
    return sum + (record.finePoints || 0);
  }, 0);
  
  const customFinesCurrency = customFineRecords.reduce((sum: number, record: any) => {
    return sum + (record.fineCurrency || 0);
  }, 0);
  
  (calculation as any).customFinesPoints = customFinesPoints;
  (calculation as any).customFinesCurrency = customFinesCurrency;

  // 3.7. Task Fines (from tasks that were rejected, deadline_passed, or completed late)
  // Query tasks assigned to this employee - we'll filter by penalty event date later
  // We query all tasks assigned to the employee and then filter by when the penalty event occurred
  const userIdObj = new ObjectId(userId);
  const allTasks = await db.collection('tasks').find({
    $or: [
      { assignees: userIdObj },
      { assignedTo: userIdObj }
    ]
  }).toArray();
  
  // Filter tasks that could have penalties in this period
  // Include tasks where deadline falls within period, or task was completed/rejected in period
  const tasks = allTasks.filter((task: any) => {
    // Check if task has any date-related field in the period
    const taskCreatedAt = task.createdAt ? new Date(task.createdAt) : null;
    const taskAssignedDate = task.assignedDate ? new Date(task.assignedDate) : null;
    const taskTickedAt = task.tickedAt ? new Date(task.tickedAt) : null;
    const taskCompletedAt = task.completedAt ? new Date(task.completedAt) : null;
    const taskApprovedAt = task.approvedAt ? new Date(task.approvedAt) : null;
    
    // Check deadline date
    let deadlineDate: Date | null = null;
    if (task.deadlineDate) {
      deadlineDate = new Date(task.deadlineDate);
      if (task.deadlineTime) {
        const [h, m] = task.deadlineTime.split(':');
        deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
      }
    } else if (task.dueDate) {
      deadlineDate = new Date(task.dueDate);
      if (task.dueTime) {
        const [h, m] = task.dueTime.split(':');
        deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
      }
    }
    
    // Include if any relevant date is in period
    if (taskCreatedAt && taskCreatedAt >= startDate) return true;
    if (taskAssignedDate && taskAssignedDate >= startDate) return true;
    if (taskTickedAt && taskTickedAt >= startDate) return true;
    if (taskCompletedAt && taskCompletedAt >= startDate) return true;
    if (taskApprovedAt && taskApprovedAt >= startDate) return true;
    if (deadlineDate && deadlineDate >= startDate && deadlineDate <= nowLocal) return true;
    
    return false;
  });

  let taskFinesTotal = 0;
  const nowLocal = new Date();

  for (const task of tasks) {
    // Skip tasks marked as not applicable
    if (task.notApplicable === true) {
      continue;
    }

    // Check both penaltyCurrency and penaltyPoints
    let penaltyCurrency = typeof task.penaltyCurrency === 'number' ? task.penaltyCurrency : 0;
    const penaltyPoints = typeof task.penaltyPoints === 'number' ? task.penaltyPoints : 0;
    
    // Skip if no penalty configured at all
    if (penaltyCurrency <= 0 && penaltyPoints <= 0) {
      continue;
    }
    
    // Use penaltyCurrency for fine calculation (currency is what gets deducted)
    // If penaltyCurrency is 0 but penaltyPoints exists, use penaltyPoints as fallback
    // This handles cases where tasks have penaltyPoints but penaltyCurrency wasn't set
    if (penaltyCurrency <= 0 && penaltyPoints > 0) {
      // Use penaltyPoints as currency (1 point = 1 currency unit)
      // This ensures tasks with penaltyPoints but no penaltyCurrency still show fines
      penaltyCurrency = penaltyPoints;
    }
    
    // Skip if still no penalty amount
    if (penaltyCurrency <= 0) {
      continue;
    }

    const approvalStatus: string = task.approvalStatus || 'pending';
    let shouldGetPenalty = false;

    // For recurring tasks (daily/weekly/monthly), use today's date for deadlineDate if deadlineTime exists
    const isRecurring = ["daily", "weekly", "monthly"].includes(task.taskKind);
    
    if (approvalStatus === 'approved') {
      if (task.status === 'completed') {
        // Check if task was completed after deadline
        let deadlineDate: Date | null = null;

        if (task.deadlineTime) {
          // For recurring tasks, deadlineDate should be the date when task was assigned/completed
          if (isRecurring && task.assignedDate) {
            // Use assigned date for recurring tasks
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
          const [h, m] = task.deadlineTime.split(':');
          deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
        } else if (task.deadlineDate) {
          deadlineDate = new Date(task.deadlineDate);
          deadlineDate.setHours(23, 59, 59, 999);
        } else if (task.dueDate) {
          deadlineDate = new Date(task.dueDate);
          if (task.dueTime) {
            const [h, m] = task.dueTime.split(':');
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        }

        const completedAt = task.tickedAt || task.completedAt || task.updatedAt || nowLocal;

        if (deadlineDate && completedAt > deadlineDate) {
          shouldGetPenalty = true;
        }
      } else {
        // Not completed but approved - if deadline passed, treat as penalty
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
          const [h, m] = task.deadlineTime.split(':');
          deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
        } else if (task.deadlineDate) {
          deadlineDate = new Date(task.deadlineDate);
          deadlineDate.setHours(23, 59, 59, 999);
        } else if (task.dueDate) {
          deadlineDate = new Date(task.dueDate);
          if (task.dueTime) {
            const [h, m] = task.dueTime.split(':');
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        }
        if (deadlineDate && nowLocal > deadlineDate) {
          shouldGetPenalty = true;
        }
      }
    } else if (approvalStatus === 'rejected' || approvalStatus === 'deadline_passed') {
      // Task was rejected or deadline passed - apply penalty
      shouldGetPenalty = true;
    }

    if (shouldGetPenalty) {
      // Check if the penalty event happened within the period
      let penaltyEventDate: Date | null = null;
      let includePenalty = false;
      
      if (approvalStatus === 'rejected' || approvalStatus === 'deadline_passed') {
        // Penalty event is when task was rejected or deadline passed
        penaltyEventDate = task.approvedAt || task.updatedAt || task.createdAt;
        if (penaltyEventDate && penaltyEventDate >= startDate && penaltyEventDate <= nowLocal) {
          includePenalty = true;
        }
      } else if (task.status === 'completed') {
        // Penalty event is when task was completed late - check if completion happened in period
        penaltyEventDate = task.tickedAt || task.completedAt || task.updatedAt;
        if (penaltyEventDate && penaltyEventDate >= startDate && penaltyEventDate <= nowLocal) {
          // Also verify the deadline was in the period or before
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
              deadlineDate = new Date(penaltyEventDate);
              deadlineDate.setHours(0, 0, 0, 0);
            }
            
            // Parse deadline time
            const [h, m] = task.deadlineTime.split(':');
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          } else if (task.dueDate) {
            deadlineDate = new Date(task.dueDate);
            if (task.dueTime) {
              const [h, m] = task.dueTime.split(':');
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
          }
          // Include if completed late and completion was in period
          if (deadlineDate && penaltyEventDate > deadlineDate) {
            includePenalty = true;
          }
        }
      } else {
        // For incomplete tasks with passed deadline, check if deadline passed within the period
        let deadlineDate: Date | null = null;
        if (task.deadlineTime) {
          // For recurring tasks, use today's date or deadlineDate if set
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
          const [h, m] = task.deadlineTime.split(':');
          deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
        } else if (task.deadlineDate) {
          deadlineDate = new Date(task.deadlineDate);
          deadlineDate.setHours(23, 59, 59, 999);
        } else if (task.dueDate) {
          deadlineDate = new Date(task.dueDate);
          if (task.dueTime) {
            const [h, m] = task.dueTime.split(':');
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        }
        // Include penalty if deadline passed during the period (deadline is within period and has passed)
        if (deadlineDate && deadlineDate >= startDate && deadlineDate <= nowLocal && nowLocal > deadlineDate) {
          includePenalty = true;
        }
      }
      
      if (includePenalty) {
        taskFinesTotal += penaltyCurrency;
      }
    }
  }

  calculation.taskFines = taskFinesTotal;

  // Calculate task bonuses (from tasks that were completed on time and approved)
  let taskBonusTotal = 0;

  for (const task of tasks) {
    // Skip tasks marked as not applicable
    if (task.notApplicable === true) {
      continue;
    }

    const bonusCurrency = typeof task.bonusCurrency === 'number' ? task.bonusCurrency : 0;
    if (bonusCurrency <= 0) {
      continue; // No bonus configured for this task
    }

    const approvalStatus: string = task.approvalStatus || 'pending';
    let shouldGetReward = false;

    if (approvalStatus === 'approved' && task.status === 'completed') {
      // Check if task was completed on time (before deadline)
      let deadlineDate: Date | null = null;

      if (task.deadlineDate) {
        deadlineDate = new Date(task.deadlineDate);
        if (task.deadlineTime) {
          const [h, m] = task.deadlineTime.split(':');
          deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
        } else {
          deadlineDate.setHours(23, 59, 59, 999);
        }
      } else if (task.dueDate) {
        deadlineDate = new Date(task.dueDate);
        if (task.dueTime) {
          const [h, m] = task.dueTime.split(':');
          deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
        } else {
          deadlineDate.setHours(23, 59, 59, 999);
        }
      }

      const completedAt = task.tickedAt || task.completedAt || task.updatedAt || nowLocal;

      // Reward if completed on time (before deadline) or if no deadline
      if (!deadlineDate || completedAt <= deadlineDate) {
        shouldGetReward = true;
      }
    }

    if (shouldGetReward) {
      // Check if the reward event happened within the period
      const rewardEventDate = task.tickedAt || task.completedAt || task.updatedAt;
      if (rewardEventDate && rewardEventDate >= startDate) {
        taskBonusTotal += bonusCurrency;
      }
    }
  }

  calculation.taskBonus = taskBonusTotal;
  
  // Add task bonus to total bonus
  calculation.totalBonus += calculation.taskBonus;

  // Step 3: Sum all fines
  const sumOfAllFines = 
    calculation.missingDailyUpdatesFine +
    calculation.missingTeamMeetingsFine +
    calculation.missingInternalMeetingsFine +
    calculation.missingClientMeetingsFine +
    calculation.missingDailyTasksFine +
    calculation.taskFines +
    calculation.absenceFines +
    customFinesCurrency; // Add custom fines currency to total fine
  
  // Step 4: Check No Fine Conditions (8.1-8.2) - if met, no fines at all
  if (productsCount > 3) calculation.noFineConditions.push('Developed more than 3 products');
  if (approvedClientProjectsCount > 3) calculation.noFineConditions.push('Approved client projects > 3');
  
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
  if (attendanceHours < 100) calculation.noPaymentConditions.push('Attendance < 100 hours');
  if (absentDays > 4) calculation.noPaymentConditions.push('Absent > 4 days');
  if (productsCount === 0) calculation.noPaymentConditions.push('0 products');
  
  // Step 9: Ensure bonuses are never negative
  if (calculation.totalBonus < 0) {
    calculation.totalBonus = 0;
  }

  calculation.netAmount = calculation.totalBonus - calculation.totalFine;

  // Check for existing manual overrides
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
    if (existingRecord.adminNotes) calculation.adminNotes = existingRecord.adminNotes;
    if (existingRecord.approvedByCoreTeam !== undefined) {
      calculation.approvedByCoreTeam = existingRecord.approvedByCoreTeam;
    }
    calculation.netAmount = calculation.baseBonus + calculation.totalBonus - calculation.totalFine;
  }

  if (calculation.noPaymentConditions.length > 0 && !calculation.approvedByCoreTeam) {
    calculation.netAmount = 0;
  }

  return calculation;
}

// Calculate bonus/fine for all employees
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow both admin and employee to view (employees can view but not edit)
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'employee')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { period } = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get all approved employees
    const employees = await db.collection('employeeProfiles').find({}).toArray();

    const calculations = [];

    for (const employee of employees) {
      try {
        const calculation = await calculateEmployeeBonusFine(
          employee._id.toString(),
          period || 'monthly',
          db
        );
        if (calculation) {
          calculations.push(calculation);
        }
      } catch (error) {
        console.error(`Error calculating for employee ${employee._id}:`, error);
      }
    }

    return NextResponse.json({ calculations });
  } catch (error) {
    console.error('Error calculating bonus/fine for all:', error);
    return NextResponse.json(
      { error: 'Failed to calculate' },
      { status: 500 }
    );
  }
}

