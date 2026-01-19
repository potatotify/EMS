import { ObjectId } from "mongodb";
import clientPromise from "./mongodb";
import TaskCompletion from "@/models/TaskCompletion";
import SubtaskCompletion from "@/models/SubtaskCompletion";
import { dbConnect } from "./mongodb";

export interface RecurringTaskCheck {
  shouldReset: boolean;
  nextResetDate?: Date;
  message?: string;
}

/**
 * Check if a recurring task should be reset based on its type and last completion date
 */
export function shouldResetRecurringTask(
  taskKind: string,
  lastCompletedAt?: Date,
  recurringPattern?: any
): RecurringTaskCheck {
  if (!lastCompletedAt) {
    return { shouldReset: false, message: "Task has never been completed" };
  }

  const now = new Date();
  const lastCompleted = new Date(lastCompletedAt);

  switch (taskKind) {
    case "one-time":
      // One-time tasks never reset
      return { shouldReset: false, message: "One-time tasks do not reset" };

    case "daily":
      // Reset if last completion was on a different day
      const lastCompletedDay = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), lastCompleted.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (today > lastCompletedDay) {
        return {
          shouldReset: true,
          nextResetDate: today,
          message: "Daily task reset - new day"
        };
      }
      return { shouldReset: false };

    case "weekly":
      // Reset if last completion was in a different week
      // Week starts on Sunday (0) in JavaScript
      const lastCompletedWeekStart = getWeekStart(lastCompleted);
      const currentWeekStart = getWeekStart(now);
      
      if (currentWeekStart > lastCompletedWeekStart) {
        return {
          shouldReset: true,
          nextResetDate: currentWeekStart,
          message: "Weekly task reset - new week"
        };
      }
      return { shouldReset: false };

    case "monthly":
      // Reset if last completion was in a different month
      const lastCompletedMonth = new Date(lastCompleted.getFullYear(), lastCompleted.getMonth(), 1);
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      if (currentMonth > lastCompletedMonth) {
        return {
          shouldReset: true,
          nextResetDate: currentMonth,
          message: "Monthly task reset - new month"
        };
      }
      return { shouldReset: false };

    case "recurring":
      // Use custom recurring pattern
      if (!recurringPattern || !recurringPattern.frequency || !recurringPattern.interval) {
        return { shouldReset: false, message: "Invalid recurring pattern" };
      }

      const daysSinceCompletion = Math.floor((now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24));

      switch (recurringPattern.frequency) {
        case "daily":
          if (daysSinceCompletion >= recurringPattern.interval) {
            return {
              shouldReset: true,
              message: `Recurring daily task reset - ${recurringPattern.interval} day(s) passed`
            };
          }
          break;

        case "weekly":
          const weeksSinceCompletion = Math.floor(daysSinceCompletion / 7);
          if (weeksSinceCompletion >= recurringPattern.interval) {
            // If specific days of week are set, check if today matches
            if (recurringPattern.daysOfWeek && recurringPattern.daysOfWeek.length > 0) {
              const currentDayOfWeek = now.getDay(); // 0-6
              if (recurringPattern.daysOfWeek.includes(currentDayOfWeek)) {
                return {
                  shouldReset: true,
                  message: `Recurring weekly task reset - ${recurringPattern.interval} week(s) and matching day`
                };
              }
            } else {
              return {
                shouldReset: true,
                message: `Recurring weekly task reset - ${recurringPattern.interval} week(s) passed`
              };
            }
          }
          break;

        case "monthly":
          const monthsSinceCompletion = (now.getFullYear() - lastCompleted.getFullYear()) * 12 + 
                                        (now.getMonth() - lastCompleted.getMonth());
          if (monthsSinceCompletion >= recurringPattern.interval) {
            // If specific day of month is set, check if today matches
            if (recurringPattern.dayOfMonth) {
              if (now.getDate() >= recurringPattern.dayOfMonth) {
                return {
                  shouldReset: true,
                  message: `Recurring monthly task reset - ${recurringPattern.interval} month(s) and matching day`
                };
              }
            } else {
              return {
                shouldReset: true,
                message: `Recurring monthly task reset - ${recurringPattern.interval} month(s) passed`
              };
            }
          }
          break;
      }
      return { shouldReset: false };

    case "custom":
      // Custom tasks with custom recurrence settings
      // customRecurrence is passed as part of recurringPattern: { customRecurrence: {...} }
      const customRecurrence = (recurringPattern as any)?.customRecurrence || recurringPattern;
      if (!customRecurrence || (!customRecurrence.daysOfWeek && !customRecurrence.daysOfMonth)) {
        return { shouldReset: false, message: "Custom tasks require custom recurrence configuration" };
      }

      const customToday = new Date();
      customToday.setHours(0, 0, 0, 0);
      const customLastCompleted = new Date(lastCompleted);
      customLastCompleted.setHours(0, 0, 0, 0);

      // Check if it's a new day
      if (customToday.getTime() === customLastCompleted.getTime()) {
        return { shouldReset: false, message: "Already completed today" };
      }

      if (customRecurrence.type === "daysOfWeek") {
        // Days of week mode
        if (!customRecurrence.daysOfWeek || customRecurrence.daysOfWeek.length === 0) {
          return { shouldReset: false, message: "No days configured" };
        }

        const currentDayOfWeek = customToday.getDay(); // 0-6 (Sunday-Saturday)
        const matchesDay = customRecurrence.daysOfWeek.includes(currentDayOfWeek);

        if (customRecurrence.recurring) {
          // Recurring weekly - reset if today's day matches and it's a new day
          if (matchesDay && customToday > customLastCompleted) {
            return {
              shouldReset: true,
              message: `Custom recurring weekday matched (day ${currentDayOfWeek})`
            };
          }
        } else {
          // One-time for specific days of week - check if today is one of them this week
          const lastWeek = Math.floor(customLastCompleted.getTime() / (7 * 24 * 60 * 60 * 1000));
          const currentWeek = Math.floor(customToday.getTime() / (7 * 24 * 60 * 60 * 1000));
          
          if (matchesDay && currentWeek > lastWeek) {
            return {
              shouldReset: true,
              message: `Custom weekday matched (day ${currentDayOfWeek})`
            };
          }
        }
      } else if (customRecurrence.type === "daysOfMonth") {
        // Days of month mode
        if (!customRecurrence.daysOfMonth || customRecurrence.daysOfMonth.length === 0) {
          return { shouldReset: false, message: "No days configured" };
        }

        const currentDay = customToday.getDate();
        const matchesDay = customRecurrence.daysOfMonth.includes(currentDay);

        if (customRecurrence.recurring) {
          // Recurring monthly - reset if today's day matches and it's a new day
          if (matchesDay && customToday > customLastCompleted) {
            return {
              shouldReset: true,
              message: `Custom recurring day ${currentDay} of month matched`
            };
          }
        } else {
          // One-time this month - reset only if it's one of the configured days
          const lastMonth = customLastCompleted.getMonth();
          const currentMonth = customToday.getMonth();
          const lastYear = customLastCompleted.getFullYear();
          const currentYear = customToday.getFullYear();
          const isDifferentMonth = currentYear !== lastYear || currentMonth !== lastMonth;
          
          if (matchesDay && (isDifferentMonth || customToday > customLastCompleted)) {
            return {
              shouldReset: true,
              message: `Custom day ${currentDay} matched`
            };
          }
        }
      }
      
      return { shouldReset: false, message: "Custom recurrence date/day not matched" };

    default:
      return { shouldReset: false, message: "Unknown task kind" };
  }
}

/**
 * Get the start of the week (Sunday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sunday) to 6 (Saturday)
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
}

/**
 * Save task completion to history before resetting
 */
async function saveTaskCompletionHistory(task: any): Promise<void> {
  try {
    await dbConnect();
    
    // Get user name for completedBy
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");
    
    let completedByName = "Unknown";
    if (task.completedBy) {
      const user = await usersCollection.findOne(
        { _id: task.completedBy instanceof ObjectId ? task.completedBy : new ObjectId(task.completedBy) },
        { projection: { name: 1 } }
      );
      if (user) {
        completedByName = user.name || "Unknown";
      }
    }
    
    // Get approvedBy name if exists
    let approvedByName = undefined;
    if (task.approvedBy) {
      const user = await usersCollection.findOne(
        { _id: task.approvedBy instanceof ObjectId ? task.approvedBy : new ObjectId(task.approvedBy) },
        { projection: { name: 1 } }
      );
      if (user) {
        approvedByName = user.name;
      }
    }
    
    // Create completion history record
    // For recurring tasks, use assignedDate/assignedTime (which is updated on reset)
    // For non-recurring tasks, use assignedDate or createdAt
    const isRecurring = ["daily", "weekly", "monthly", "recurring", "custom"].includes(task.taskKind);
    const assignedDate = isRecurring 
      ? (task.assignedDate || task.createdAt || undefined)
      : (task.assignedDate || task.createdAt || undefined);
    const assignedTime = task.assignedTime || undefined;
    
    const completionData = {
      taskId: task._id,
      taskTitle: task.title,
      taskKind: task.taskKind,
      projectId: task.projectId,
      projectName: task.projectName,
      section: task.section || "No Section",
      assignedTo: task.assignedTo || undefined,
      assignedToName: task.assignedToName || undefined,
      assignees: task.assignees || undefined,
      assigneeNames: task.assigneeNames || undefined,
      completedBy: task.completedBy || undefined, // Can be null for unticked tasks
      completedByName: completedByName || "Not Ticked", // Show "Not Ticked" if not completed
      tickedAt: task.tickedAt || task.completedAt || undefined, // Can be null for unticked tasks
      completedAt: task.completedAt || undefined, // Can be null for unticked tasks
      assignedDate: assignedDate, // Store assigned date (reset date for recurring tasks)
      assignedTime: assignedTime, // Store assigned time (reset time for recurring tasks)
      dueDate: task.dueDate || undefined,
      dueTime: task.dueTime || undefined,
      deadlineDate: task.deadlineDate || undefined,
      deadlineTime: task.deadlineTime || undefined,
      bonusPoints: task.bonusPoints || 0,
      bonusCurrency: task.bonusCurrency || 0,
      penaltyPoints: task.penaltyPoints || 0,
      penaltyCurrency: task.penaltyCurrency || 0,
      approvedBy: task.approvedBy || undefined,
      approvedByName: approvedByName,
      approvedAt: task.approvedAt || undefined,
      approvalStatus: task.approvalStatus || "pending",
      customFields: task.customFields || undefined,
      customFieldValues: task.customFieldValues || undefined,
      priority: task.priority || 2,
      notTicked: !task.tickedAt && !task.completedAt, // Flag to indicate task was not ticked
    };
    
    await TaskCompletion.create(completionData);
    console.log(`[Task History] Saved completion history for task ${task._id}`);
  } catch (error) {
    console.error("[Task History] Error saving completion history:", error);
    // Don't throw - we still want to reset the task even if history save fails
  }
}

/**
 * Save subtask completion to history before resetting
 */
async function saveSubtaskCompletionHistory(subtask: any, task: any): Promise<void> {
  try {
    await dbConnect();
    
    // Get user names for assignees and completedBy
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");
    
    // Get assignee names
    let assigneeNames: string[] = [];
    if (subtask.assignees && Array.isArray(subtask.assignees)) {
      assigneeNames = await Promise.all(
        subtask.assignees.map(async (assigneeId: any) => {
          try {
            const user = await usersCollection.findOne(
              { _id: assigneeId instanceof ObjectId ? assigneeId : new ObjectId(assigneeId) },
              { projection: { name: 1 } }
            );
            return user?.name || "Unknown";
          } catch (e) {
            return "Unknown";
          }
        })
      );
    }
    
    // Get completedBy name
    let completedByName = "Unknown";
    if (subtask.completedBy) {
      const user = await usersCollection.findOne(
        { _id: subtask.completedBy instanceof ObjectId ? subtask.completedBy : new ObjectId(subtask.completedBy) },
        { projection: { name: 1 } }
      );
      if (user) {
        completedByName = user.name || "Unknown";
      }
    }
    
    // Get bonus/fine from subtask (inherited from parent task)
    const subtaskAny = subtask as any;
    const parentTaskAny = task as any;
    
    // Subtasks inherit deadline from main task if not set
    const deadlineDate = subtaskAny.deadlineDate || parentTaskAny.deadlineDate || undefined;
    const deadlineTime = subtaskAny.deadlineTime || parentTaskAny.deadlineTime || undefined;
    
    // Create completion history record
    const completionData = {
      subtaskId: subtask._id,
      taskId: subtask.taskId,
      subtaskTitle: subtask.title,
      parentTaskTitle: task.title,
      taskKind: task.taskKind,
      projectId: task.projectId,
      projectName: task.projectName,
      section: task.section || "No Section",
      assignees: subtask.assignees || (subtask.assignee ? [subtask.assignee] : []),
      assigneeNames: assigneeNames,
      completedBy: subtask.completedBy,
      completedByName: completedByName,
      tickedAt: subtask.tickedAt || subtask.completedAt,
      completedAt: subtask.completedAt,
      // Include bonus/fine from parent task (subtasks inherit from main task)
      bonusPoints: typeof parentTaskAny.bonusPoints === "number" ? parentTaskAny.bonusPoints : (typeof subtaskAny.bonusPoints === "number" ? subtaskAny.bonusPoints : undefined),
      bonusCurrency: typeof parentTaskAny.bonusCurrency === "number" ? parentTaskAny.bonusCurrency : (typeof subtaskAny.bonusCurrency === "number" ? subtaskAny.bonusCurrency : undefined),
      penaltyPoints: typeof parentTaskAny.penaltyPoints === "number" ? parentTaskAny.penaltyPoints : (typeof subtaskAny.penaltyPoints === "number" ? subtaskAny.penaltyPoints : undefined),
      penaltyCurrency: typeof parentTaskAny.penaltyCurrency === "number" ? parentTaskAny.penaltyCurrency : (typeof subtaskAny.penaltyCurrency === "number" ? subtaskAny.penaltyCurrency : undefined),
      // Include approval status
      approvalStatus: subtaskAny.approvalStatus || parentTaskAny.approvalStatus || "pending",
      // Include deadline info (inherited from parent task)
      deadlineDate: deadlineDate,
      deadlineTime: deadlineTime,
      dueDate: subtaskAny.dueDate || parentTaskAny.dueDate || undefined,
      dueTime: subtaskAny.dueTime || parentTaskAny.dueTime || undefined,
      // Include assigned date/time from parent task for recurring tasks
      assignedDate: parentTaskAny.assignedDate || undefined,
      assignedTime: parentTaskAny.assignedTime || undefined,
    };
    
    await SubtaskCompletion.create(completionData);
    console.log(`[Subtask History] Saved completion history for subtask ${subtask._id}`);
  } catch (error) {
    console.error("[Subtask History] Error saving completion history:", error);
    // Don't throw - we still want to reset the subtask even if history save fails
  }
}

/**
 * Reset recurring tasks that need to be reset
 * This should be called periodically (e.g., when user logs in or loads tasks)
 */
export async function resetRecurringTasksForProject(projectId: string): Promise<number> {
  try {
    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");
    const subtasksCollection = db.collection("subtasks");

    // Find all recurring tasks for this project (both completed and pending)
    const tasks = await tasksCollection.find({
      projectId: new ObjectId(projectId),
      taskKind: { $in: ["daily", "weekly", "monthly", "recurring", "custom"] }
    }).toArray();

    let resetCount = 0;
    const now = new Date();

    for (const task of tasks) {
      const isCompleted = task.status === "completed";
      
      // For custom tasks, pass customRecurrence as part of recurringPattern
      const patternToUse = task.taskKind === "custom" && task.customRecurrence
        ? { customRecurrence: task.customRecurrence }
        : task.recurringPattern;
      
      // Check if task should be reset (only for completed tasks)
      let shouldReset = false;
      if (isCompleted) {
        const check = shouldResetRecurringTask(
          task.taskKind as string,
          task.completedAt || task.tickedAt,
          patternToUse
        );
        shouldReset = check.shouldReset;
      }
      
      // For incomplete recurring tasks, check if deadline has passed and auto-tick
      if (!isCompleted && task.status === "pending") {
        // Check if deadline has passed based on deadlineTime
        let deadlinePassed = false;
        if (task.deadlineTime) {
          // For recurring tasks, calculate the actual deadline date
          // For daily tasks, if cron runs at midnight, deadline was yesterday
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Calculate deadline date - use today's date for fine attribution
          let deadlineDate: Date;
          if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(0, 0, 0, 0);
          } else {
            // Use today's date for all recurring tasks
            deadlineDate = new Date(today);
            deadlineDate.setHours(0, 0, 0, 0);
          }
          
          // Parse deadline time
          const [hours, minutes] = task.deadlineTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          // Check if deadline has passed
          deadlinePassed = now > deadlineDate;
          
          // Also check if task should be reset (deadline was yesterday or earlier for daily/weekly/monthly)
          if (["daily", "weekly", "monthly"].includes(task.taskKind)) {
            const check = shouldResetRecurringTask(
              task.taskKind as string,
              deadlineDate, // Use deadline date as reference
              patternToUse
            );
            if (check.shouldReset && deadlinePassed) {
              // Auto-tick the task and mark as deadline_passed
              const assignedTo = task.assignedTo || (task.assignees && task.assignees.length > 0 ? task.assignees[0] : null);
              
              // Use today's date for fine attribution (the day the cron runs)
              const actualDeadlineDate = new Date(today);
              const [h, m] = task.deadlineTime.split(":");
              actualDeadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
              
              // Save as TaskCompletion record before resetting
              await saveTaskCompletionHistory({
                ...task,
                status: "completed",
                tickedAt: actualDeadlineDate, // Set to today's deadline time
                completedAt: actualDeadlineDate,
                completedBy: assignedTo,
                approvalStatus: "deadline_passed",
                approvedAt: now,
                deadlineDate: actualDeadlineDate, // Store today's date for fine attribution
              });
              
              // Reset the task for next cycle
              await tasksCollection.updateOne(
                { _id: task._id },
                {
                  $set: {
                    status: "pending",
                    approvalStatus: "pending",
                    // Update deadlineDate to today for recurring tasks
                    deadlineDate: today
                  },
                  $unset: {
                    completedAt: "",
                    completedBy: "",
                    tickedAt: "",
                    approvedBy: "",
                    approvedAt: "",
                    customFieldValues: ""
                  }
                }
              );
              
              resetCount++;
              console.log(`[Task Recurrence] Auto-ticked incomplete recurring task ${task._id} (${task.taskKind}) - deadline passed, marked as deadline_passed. Fine attributed to: ${actualDeadlineDate.toISOString()}`);
              continue; // Skip to next task
            }
          }
        }
      }

      if (shouldReset) {
        // Save completion history before resetting
        await saveTaskCompletionHistory(task);
        
        // For recurring tasks (daily/weekly/monthly), update deadlineDate to today if deadlineTime exists
        const updateFields: any = {
          status: "pending",
          approvalStatus: "pending"
        };
        
        // If task has deadlineTime but is recurring, set deadlineDate to today in IST
        if (task.deadlineTime && ["daily", "weekly", "monthly"].includes(task.taskKind)) {
          // For daily tasks, ALWAYS use today's date in IST
          // For weekly/monthly tasks, also use today in IST
          const now = new Date();
          const istFormatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const todayISTString = istFormatter.format(now); // Returns YYYY-MM-DD in IST
          const today = new Date(todayISTString + "T00:00:00");
          updateFields.deadlineDate = today;
        }
        
        // Reset the task
        await tasksCollection.updateOne(
          { _id: task._id },
          {
            $set: updateFields,
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: "",
              approvedBy: "",
              approvedAt: "",
              customFieldValues: ""
            }
          }
        );
        
        // Get all completed subtasks for this task and save their history
        const completedSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "completed"
        }).toArray();
        
        for (const subtask of completedSubtasks) {
          await saveSubtaskCompletionHistory(subtask, task);
        }
        
        // Get all incomplete/pending subtasks for this task
        // These need to be saved as deadline_passed before reset so fines are applied
        const incompleteSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "pending"
        }).toArray();
        
        // Calculate deadline date for incomplete subtasks
        const taskAny = task as any;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get deadline date from task (for daily tasks, use today's date in IST)
        let baseDeadlineDate: Date;
        if (taskAny.deadlineDate) {
          baseDeadlineDate = new Date(taskAny.deadlineDate);
          baseDeadlineDate.setHours(0, 0, 0, 0);
        } else {
          baseDeadlineDate = new Date(today);
          baseDeadlineDate.setHours(0, 0, 0, 0);
        }
        
        // Get deadline time (from subtask or parent task)
        const deadlineTime = taskAny.deadlineTime || "23:59";
        const [deadlineHours, deadlineMinutes] = deadlineTime.split(":");
        baseDeadlineDate.setHours(parseInt(deadlineHours), parseInt(deadlineMinutes), 0, 0);
        
        // Save all incomplete subtasks as deadline_passed before resetting
        for (const subtask of incompleteSubtasks) {
          const subtaskAny = subtask as any;
          
          // Use subtask's deadline if available, otherwise use parent task's deadline
          let subtaskDeadlineDate: Date;
          const subtaskDeadlineTime = subtaskAny.deadlineTime || deadlineTime;
          
          if (subtaskAny.deadlineDate) {
            subtaskDeadlineDate = new Date(subtaskAny.deadlineDate);
            subtaskDeadlineDate.setHours(0, 0, 0, 0);
          } else {
            subtaskDeadlineDate = new Date(baseDeadlineDate);
            subtaskDeadlineDate.setHours(0, 0, 0, 0);
          }
          
          const [h, m] = subtaskDeadlineTime.split(":");
          subtaskDeadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          
          // Save as SubtaskCompletion record with deadline_passed status
          // This ensures fines are applied to employees who didn't complete their subtasks
          await saveSubtaskCompletionHistory({
            ...subtask,
            status: "pending", // Keep as pending (not completed)
            tickedAt: null, // Not ticked
            completedAt: null, // Not completed
            completedBy: subtaskAny.assignee || null,
            approvalStatus: "deadline_passed", // Mark as deadline passed for fine
            deadlineDate: subtaskDeadlineDate,
            deadlineTime: subtaskDeadlineTime,
          }, task);
          
          console.log(`[Task Recurrence] Saved incomplete subtask ${subtask._id} as deadline_passed before reset. Fine will be applied.`);
        }
        
        // Reset all subtasks for this task - uncheck all completed ones
        // Ensure taskId is properly formatted as ObjectId for matching
        const taskIdObj = task._id instanceof ObjectId ? task._id : new ObjectId(task._id);
        
        // CRITICAL: Also reset the 'ticked' boolean field which indicates if subtask is checked
        const subtaskResetResult = await subtasksCollection.updateMany(
          { taskId: taskIdObj },
          {
            $set: {
              status: "pending",
              ticked: false, // CRITICAL: Reset the ticked boolean field
              approvalStatus: "pending"
            },
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: "",
              timeSpent: ""
            }
          }
        );
        
        // Log the reset result for debugging
        if (subtaskResetResult.modifiedCount > 0) {
          console.log(`[Task Recurrence] Reset ${subtaskResetResult.modifiedCount} subtask(s) for task ${task._id} (matched: ${subtaskResetResult.matchedCount})`);
        } else if (subtaskResetResult.matchedCount > 0) {
          console.log(`[Task Recurrence] Warning: Matched ${subtaskResetResult.matchedCount} subtask(s) but modified 0 for task ${task._id}`);
        }
        
        resetCount++;
        console.log(`[Task Recurrence] Reset task ${task._id} and its subtasks (${task.taskKind})`);
      }
    }

    return resetCount;
  } catch (error) {
    console.error("[Task Recurrence] Error resetting recurring tasks:", error);
    throw error;
  }
}

/**
 * Reset recurring tasks for a specific user across all their projects
 */
export async function resetRecurringTasksForUser(userId: string): Promise<number> {
  try {
    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");
    const subtasksCollection = db.collection("subtasks");
    const userIdObj = new ObjectId(userId);

    // Find all recurring tasks assigned to this user (both completed and pending)
    const tasks = await tasksCollection.find({
      $or: [
        { assignedTo: userIdObj },
        { assignees: userIdObj }
      ],
      taskKind: { $in: ["daily", "weekly", "monthly", "recurring", "custom"] }
    }).toArray();

    let resetCount = 0;
    const now = new Date();

    for (const task of tasks) {
      const isCompleted = task.status === "completed";
      
      // For custom tasks, pass customRecurrence as part of recurringPattern
      const patternToUse = task.taskKind === "custom" && task.customRecurrence
        ? { customRecurrence: task.customRecurrence }
        : task.recurringPattern;
      
      // Check if task should be reset (only for completed tasks)
      let shouldReset = false;
      if (isCompleted) {
        const check = shouldResetRecurringTask(
          task.taskKind as string,
          task.completedAt || task.tickedAt,
          patternToUse
        );
        shouldReset = check.shouldReset;
      }
      
      // For incomplete recurring tasks, check if deadline has passed and auto-tick
      if (!isCompleted && task.status === "pending") {
        // Check if deadline has passed based on deadlineTime
        let deadlinePassed = false;
        if (task.deadlineTime) {
          // For recurring tasks, calculate the actual deadline date
          // For daily tasks, if cron runs at midnight, deadline was yesterday
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Calculate deadline date - use today's date for fine attribution
          let deadlineDate: Date;
          if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(0, 0, 0, 0);
          } else {
            // Use today's date for all recurring tasks
            deadlineDate = new Date(today);
            deadlineDate.setHours(0, 0, 0, 0);
          }
          
          // Parse deadline time
          const [hours, minutes] = task.deadlineTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          // Check if deadline has passed
          deadlinePassed = now > deadlineDate;
          
          // Also check if task should be reset (deadline was yesterday or earlier for daily/weekly/monthly)
          if (["daily", "weekly", "monthly"].includes(task.taskKind)) {
            const check = shouldResetRecurringTask(
              task.taskKind as string,
              deadlineDate, // Use deadline date as reference
              patternToUse
            );
            if (check.shouldReset && deadlinePassed) {
              // Auto-tick the task and mark as deadline_passed
              const assignedTo = task.assignedTo || (task.assignees && task.assignees.length > 0 ? task.assignees[0] : null);
              
              // Use today's date for fine attribution (the day the cron runs)
              const actualDeadlineDate = new Date(today);
              const [h, m] = task.deadlineTime.split(":");
              actualDeadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
              
              // Save as TaskCompletion record before resetting
              await saveTaskCompletionHistory({
                ...task,
                status: "completed",
                tickedAt: actualDeadlineDate, // Set to today's deadline time
                completedAt: actualDeadlineDate,
                completedBy: assignedTo,
                approvalStatus: "deadline_passed",
                approvedAt: now,
                deadlineDate: actualDeadlineDate, // Store today's date for fine attribution
              });
              
              // Reset the task for next cycle
              await tasksCollection.updateOne(
                { _id: task._id },
                {
                  $set: {
                    status: "pending",
                    approvalStatus: "pending",
                    // Update deadlineDate to today for recurring tasks
                    deadlineDate: today
                  },
                  $unset: {
                    completedAt: "",
                    completedBy: "",
                    tickedAt: "",
                    approvedBy: "",
                    approvedAt: "",
                    customFieldValues: ""
                  }
                }
              );
              
              resetCount++;
              console.log(`[Task Recurrence] Auto-ticked incomplete recurring task ${task._id} (${task.taskKind}) - deadline passed, marked as deadline_passed. Fine attributed to: ${actualDeadlineDate.toISOString()}`);
              continue; // Skip to next task
            }
          }
        }
      }

      if (shouldReset) {
        // Save completion history before resetting
        await saveTaskCompletionHistory(task);
        
        // For recurring tasks (daily/weekly/monthly), update deadlineDate to today if deadlineTime exists
        const updateFields: any = {
          status: "pending",
          approvalStatus: "pending"
        };
        
        // If task has deadlineTime but is recurring, set deadlineDate to today in IST
        if (task.deadlineTime && ["daily", "weekly", "monthly"].includes(task.taskKind)) {
          // For daily tasks, ALWAYS use today's date in IST
          // For weekly/monthly tasks, also use today in IST
          const now = new Date();
          const istFormatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const todayISTString = istFormatter.format(now); // Returns YYYY-MM-DD in IST
          const today = new Date(todayISTString + "T00:00:00");
          updateFields.deadlineDate = today;
        }
        
        // Reset the task
        await tasksCollection.updateOne(
          { _id: task._id },
          {
            $set: updateFields,
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: "",
              approvedBy: "",
              approvedAt: "",
              customFieldValues: ""
            }
          }
        );
        
        // Get all completed subtasks for this task and save their history
        const completedSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "completed"
        }).toArray();
        
        for (const subtask of completedSubtasks) {
          await saveSubtaskCompletionHistory(subtask, task);
        }
        
        // Get all incomplete/pending subtasks for this task
        // These need to be saved as deadline_passed before reset so fines are applied
        const incompleteSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "pending"
        }).toArray();
        
        // Calculate deadline date for incomplete subtasks
        const taskAny = task as any;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get deadline date from task (for daily tasks, use today's date in IST)
        let baseDeadlineDate: Date;
        if (taskAny.deadlineDate) {
          baseDeadlineDate = new Date(taskAny.deadlineDate);
          baseDeadlineDate.setHours(0, 0, 0, 0);
        } else {
          baseDeadlineDate = new Date(today);
          baseDeadlineDate.setHours(0, 0, 0, 0);
        }
        
        // Get deadline time (from subtask or parent task)
        const deadlineTime = taskAny.deadlineTime || "23:59";
        const [deadlineHours, deadlineMinutes] = deadlineTime.split(":");
        baseDeadlineDate.setHours(parseInt(deadlineHours), parseInt(deadlineMinutes), 0, 0);
        
        // Save all incomplete subtasks as deadline_passed before resetting
        for (const subtask of incompleteSubtasks) {
          const subtaskAny = subtask as any;
          
          // Use subtask's deadline if available, otherwise use parent task's deadline
          let subtaskDeadlineDate: Date;
          const subtaskDeadlineTime = subtaskAny.deadlineTime || deadlineTime;
          
          if (subtaskAny.deadlineDate) {
            subtaskDeadlineDate = new Date(subtaskAny.deadlineDate);
            subtaskDeadlineDate.setHours(0, 0, 0, 0);
          } else {
            subtaskDeadlineDate = new Date(baseDeadlineDate);
            subtaskDeadlineDate.setHours(0, 0, 0, 0);
          }
          
          const [h, m] = subtaskDeadlineTime.split(":");
          subtaskDeadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          
          // Save as SubtaskCompletion record with deadline_passed status
          // This ensures fines are applied to employees who didn't complete their subtasks
          await saveSubtaskCompletionHistory({
            ...subtask,
            status: "pending", // Keep as pending (not completed)
            tickedAt: null, // Not ticked
            completedAt: null, // Not completed
            completedBy: subtaskAny.assignee || null,
            approvalStatus: "deadline_passed", // Mark as deadline passed for fine
            deadlineDate: subtaskDeadlineDate,
            deadlineTime: subtaskDeadlineTime,
          }, task);
          
          console.log(`[Task Recurrence] Saved incomplete subtask ${subtask._id} as deadline_passed before reset. Fine will be applied.`);
        }
        
        // Reset all subtasks for this task - uncheck all completed ones
        // Ensure taskId is properly formatted as ObjectId for matching
        const taskIdObj = task._id instanceof ObjectId ? task._id : new ObjectId(task._id);
        
        // CRITICAL: Also reset the 'ticked' boolean field which indicates if subtask is checked
        const subtaskResetResult = await subtasksCollection.updateMany(
          { taskId: taskIdObj },
          {
            $set: {
              status: "pending",
              ticked: false, // CRITICAL: Reset the ticked boolean field
              approvalStatus: "pending"
            },
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: "",
              timeSpent: ""
            }
          }
        );
        
        // Log the reset result for debugging
        if (subtaskResetResult.modifiedCount > 0) {
          console.log(`[Task Recurrence] Reset ${subtaskResetResult.modifiedCount} subtask(s) for task ${task._id} (matched: ${subtaskResetResult.matchedCount})`);
        } else if (subtaskResetResult.matchedCount > 0) {
          console.log(`[Task Recurrence] Warning: Matched ${subtaskResetResult.matchedCount} subtask(s) but modified 0 for task ${task._id}`);
        }
        
        resetCount++;
        console.log(`[Task Recurrence] Reset task ${task._id} and its subtasks (${task.taskKind})`);
      }
    }

    return resetCount;
  } catch (error) {
    console.error("[Task Recurrence] Error resetting recurring tasks for user:", error);
    throw error;
  }
}

/**
 * Reset ALL recurring tasks in the system
 * This should be called by a cron job at 11:50 PM IST daily
 * Also checks non-recurring tasks with passed deadlines and auto-ticks them
 */
export async function resetAllRecurringTasks(): Promise<number> {
  try {
    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");
    const subtasksCollection = db.collection("subtasks");

    const now = new Date();
    // Cron runs at 11:50 PM IST, so next day is tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(1, 0, 0, 0); // 1:00 AM next day for assigned time
    
    // For daily tasks, deadline should be today's date in IST (not tomorrow)
    // Get today's date in IST timezone to ensure accuracy
    const istFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayISTString = istFormatter.format(now); // Returns YYYY-MM-DD in IST
    const today = new Date(todayISTString + "T00:00:00"); // Create date from IST date string

    // First, check non-recurring tasks with passed deadlines and auto-tick them
    const nonRecurringTasks = await tasksCollection.find({
      taskKind: "one-time",
      status: "pending",
      $or: [
        { deadlineDate: { $exists: true } },
        { deadlineTime: { $exists: true } },
        { dueDate: { $exists: true } }
      ]
    }).toArray();

    let autoTickedCount = 0;
    for (const task of nonRecurringTasks) {
      let deadlinePassed = false;
      let deadlineDate: Date | null = null;
      
      if (task.deadlineTime) {
        if (task.deadlineDate) {
          deadlineDate = new Date(task.deadlineDate);
          deadlineDate.setHours(0, 0, 0, 0);
        } else {
          deadlineDate = new Date(now);
          deadlineDate.setHours(0, 0, 0, 0);
        }
        const [hours, minutes] = task.deadlineTime.split(":");
        deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        deadlinePassed = now > deadlineDate;
      } else if (task.deadlineDate) {
        deadlineDate = new Date(task.deadlineDate);
        deadlineDate.setHours(23, 59, 59, 999);
        deadlinePassed = now > deadlineDate;
      } else if (task.dueDate) {
        deadlineDate = new Date(task.dueDate);
        if (task.dueTime) {
          const [hours, minutes] = task.dueTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
          deadlineDate.setHours(23, 59, 59, 999);
        }
        deadlinePassed = now > deadlineDate;
      }

      if (deadlinePassed && deadlineDate) {
        // Auto-tick the task and mark as deadline_passed
        const assignedTo = task.assignedTo || (task.assignees && task.assignees.length > 0 ? task.assignees[0] : null);
        
        // Save as TaskCompletion record
        await saveTaskCompletionHistory({
          ...task,
          status: "completed",
          tickedAt: deadlineDate, // Set to deadline time
          completedAt: deadlineDate,
          completedBy: assignedTo,
          approvalStatus: "deadline_passed",
          approvedAt: now,
          deadlineDate: deadlineDate,
        });

        // Mark task as completed with deadline_passed status
        await tasksCollection.updateOne(
          { _id: task._id },
          {
            $set: {
              status: "completed",
              tickedAt: deadlineDate,
              completedAt: deadlineDate,
              completedBy: assignedTo,
              approvalStatus: "deadline_passed",
              approvedAt: now,
            }
          }
        );

        autoTickedCount++;
        console.log(`[Cron] Auto-ticked non-recurring task ${task._id} - deadline passed. Fine attributed to: ${deadlineDate.toISOString()}`);
      }
    }

    // Find all recurring tasks (both completed and pending)
    const tasks = await tasksCollection.find({
      taskKind: { $in: ["daily", "weekly", "monthly", "recurring", "custom"] }
    }).toArray();

    let resetCount = 0;

    for (const task of tasks) {
      const isCompleted = task.status === "completed";
      
      // For custom tasks, pass customRecurrence as part of recurringPattern
      const patternToUse = task.taskKind === "custom" && task.customRecurrence
        ? { customRecurrence: task.customRecurrence }
        : task.recurringPattern;
      
      // Check if task should be reset (only for completed tasks)
      let shouldReset = false;
      if (isCompleted) {
        const check = shouldResetRecurringTask(
          task.taskKind as string,
          task.completedAt || task.tickedAt,
          patternToUse
        );
        shouldReset = check.shouldReset;
      }
      
      // For incomplete daily tasks, check if deadline has passed
      // IMPORTANT: For daily tasks that weren't ticked, create a "not ticked" record with fine
      // but DON'T mark the task as ticked - it should remain pending and reset
      if (!isCompleted && task.status === "pending" && task.taskKind === "daily") {
        if (task.deadlineTime) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          let deadlineDate: Date;
          if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(0, 0, 0, 0);
          } else if (task.assignedDate) {
            deadlineDate = new Date(task.assignedDate);
            deadlineDate.setHours(0, 0, 0, 0);
          } else {
            deadlineDate = new Date(today);
            deadlineDate.setHours(0, 0, 0, 0);
          }
          
          const [hours, minutes] = task.deadlineTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          // Check if deadline has passed (cron runs at 11:50 PM, so deadline should have passed)
          const deadlinePassed = now > deadlineDate;
          
          // Check if this is a new day (should reset)
          const check = shouldResetRecurringTask(
            task.taskKind as string,
            deadlineDate,
            patternToUse
          );
          
          if (check.shouldReset && deadlinePassed) {
            const assignedTo = task.assignedTo || (task.assignees && task.assignees.length > 0 ? task.assignees[0] : null);
            
            // Use the function-level 'today' variable (recreate from todayISTString to avoid scope issues)
            const todayDate = new Date(todayISTString + "T00:00:00");
            
            // Create a "not ticked" completion record with fine
            // This shows in task analysis as "not ticked" with fine applied
            await saveTaskCompletionHistory({
              ...task,
              status: "pending", // Keep as pending (not completed)
              tickedAt: null, // Not ticked
              completedAt: null, // Not completed
              completedBy: null, // No one ticked it
              approvalStatus: "deadline_passed", // Mark as deadline passed for fine
              approvedAt: now,
              deadlineDate: deadlineDate, // The deadline that passed
              assignedDate: task.assignedDate || todayDate,
              assignedTime: task.assignedTime || "01:00",
            });
            
            // Reset the task for next cycle WITHOUT marking it as completed
            await tasksCollection.updateOne(
              { _id: task._id },
              {
                $set: {
                  status: "pending", // Keep as pending
                  approvalStatus: "pending",
                  assignedDate: tomorrow,
                  assignedTime: "01:00",
                  deadlineDate: todayDate // For daily tasks, deadline is today's date
                },
                $unset: {
                  completedAt: "",
                  completedBy: "",
                  tickedAt: "",
                  approvedBy: "",
                  approvedAt: "",
                  customFieldValues: ""
                }
              }
            );
            
            resetCount++;
            console.log(`[Task Recurrence] Created "not ticked" record for daily task ${task._id} - deadline passed, fine applied. Task reset for next day.`);
            continue;
          }
        }
      }

      if (shouldReset) {
        // Save completion history before resetting
        await saveTaskCompletionHistory(task);
        
        // For recurring tasks (daily/weekly/monthly), update deadlineDate and assignedDate/assignedTime
        const updateFields: any = {
          status: "pending",
          approvalStatus: "pending"
        };
        
        // Cron runs at 11:50 PM IST, so tasks reset for next day
        // Set assignedDate to tomorrow and assignedTime to 1:00 AM
        if (["daily", "weekly", "monthly"].includes(task.taskKind)) {
          updateFields.assignedDate = tomorrow;
          updateFields.assignedTime = "01:00"; // 1:00 AM for next day
          
          if (task.deadlineTime) {
            // For daily tasks, deadlineDate should be today (not tomorrow)
            // For weekly/monthly tasks, use tomorrow
            // Use the function-level 'today' variable declared at the top
            if (task.taskKind === "daily") {
              updateFields.deadlineDate = new Date(todayISTString + "T00:00:00");
            } else {
              updateFields.deadlineDate = tomorrow;
            }
          }
        }
        
        // Reset the task
        await tasksCollection.updateOne(
          { _id: task._id },
          {
            $set: updateFields,
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: "",
              approvedBy: "",
              approvedAt: "",
              customFieldValues: ""
            }
          }
        );
        
        // Get all completed subtasks for this task and save their history
        const completedSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "completed"
        }).toArray();
        
        for (const subtask of completedSubtasks) {
          await saveSubtaskCompletionHistory(subtask, task);
        }
        
        // Get all incomplete/pending subtasks for this task
        // These need to be saved as deadline_passed before reset so fines are applied
        const incompleteSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "pending"
        }).toArray();
        
        // Calculate deadline date for incomplete subtasks
        const taskAny = task as any;
        
        // Use today's date in IST for daily tasks
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get deadline date from task
        let baseDeadlineDate: Date;
        if (taskAny.deadlineDate) {
          baseDeadlineDate = new Date(taskAny.deadlineDate);
          baseDeadlineDate.setHours(0, 0, 0, 0);
        } else if (taskAny.assignedDate) {
          baseDeadlineDate = new Date(taskAny.assignedDate);
          baseDeadlineDate.setHours(0, 0, 0, 0);
        } else {
          baseDeadlineDate = new Date(today);
          baseDeadlineDate.setHours(0, 0, 0, 0);
        }
        
        // Get deadline time (from subtask or parent task, default to 23:59)
        const baseDeadlineTime = taskAny.deadlineTime || "23:59";
        
        // Save all incomplete subtasks as deadline_passed before resetting
        for (const subtask of incompleteSubtasks) {
          const subtaskAny = subtask as any;
          
          // Use subtask's deadline if available, otherwise use parent task's deadline
          const deadlineTime = subtaskAny.deadlineTime || baseDeadlineTime;
          let subtaskDeadlineDate: Date;
          
          if (subtaskAny.deadlineDate) {
            subtaskDeadlineDate = new Date(subtaskAny.deadlineDate);
            subtaskDeadlineDate.setHours(0, 0, 0, 0);
          } else {
            subtaskDeadlineDate = new Date(baseDeadlineDate);
            subtaskDeadlineDate.setHours(0, 0, 0, 0);
          }
          
          const [h, m] = deadlineTime.split(":");
          subtaskDeadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          
          const assignedTo = subtaskAny.assignee || (subtaskAny.assignees && subtaskAny.assignees.length > 0 ? subtaskAny.assignees[0] : null);
          
          // Save as SubtaskCompletion record with deadline_passed status
          // This ensures fines are applied to employees who didn't complete their subtasks
          await saveSubtaskCompletionHistory({
            ...subtask,
            status: "pending", // Keep as pending (not completed)
            tickedAt: null, // Not ticked
            completedAt: null, // Not completed
            completedBy: assignedTo,
            approvalStatus: "deadline_passed", // Mark as deadline passed for fine
            deadlineDate: subtaskDeadlineDate,
            deadlineTime: deadlineTime,
          }, task);
          
          console.log(`[Task Recurrence] Saved incomplete subtask ${subtask._id} as deadline_passed before reset. Fine will be applied.`);
        }
        
        // Reset all subtasks for this task - uncheck all completed ones
        // Ensure taskId is properly formatted as ObjectId for matching
        const taskIdObj = task._id instanceof ObjectId ? task._id : new ObjectId(task._id);
        
        // CRITICAL: Also reset the 'ticked' boolean field which indicates if subtask is checked
        const subtaskResetResult = await subtasksCollection.updateMany(
          { taskId: taskIdObj },
          {
            $set: {
              status: "pending",
              ticked: false, // CRITICAL: Reset the ticked boolean field
              approvalStatus: "pending"
            },
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: "",
              timeSpent: ""
            }
          }
        );
        
        // Log the reset result for debugging
        if (subtaskResetResult.modifiedCount > 0) {
          console.log(`[Task Recurrence] Reset ${subtaskResetResult.modifiedCount} subtask(s) for task ${task._id} (matched: ${subtaskResetResult.matchedCount})`);
        } else if (subtaskResetResult.matchedCount > 0) {
          console.log(`[Task Recurrence] Warning: Matched ${subtaskResetResult.matchedCount} subtask(s) but modified 0 for task ${task._id}`);
        }
        
        resetCount++;
        console.log(`[Task Recurrence] Reset task ${task._id} and its subtasks (${task.taskKind})`);
      }
    }

    console.log(`[Task Recurrence] Reset ${resetCount} recurring tasks and their subtasks`);
    return resetCount;
  } catch (error) {
    console.error("[Task Recurrence] Error resetting all recurring tasks:", error);
    throw error;
  }
}
