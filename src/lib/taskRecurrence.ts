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
      completedBy: task.completedBy,
      completedByName: completedByName,
      tickedAt: task.tickedAt || task.completedAt,
      completedAt: task.completedAt,
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
      assignees: subtask.assignees || [],
      assigneeNames: assigneeNames,
      completedBy: subtask.completedBy,
      completedByName: completedByName,
      tickedAt: subtask.tickedAt || subtask.completedAt,
      completedAt: subtask.completedAt,
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

    // Find all completed recurring tasks for this project
    const tasks = await tasksCollection.find({
      projectId: new ObjectId(projectId),
      status: "completed",
      taskKind: { $in: ["daily", "weekly", "monthly", "recurring"] }
    }).toArray();

    let resetCount = 0;

    for (const task of tasks) {
      const check = shouldResetRecurringTask(
        task.taskKind as string,
        task.completedAt || task.tickedAt,
        task.recurringPattern
      );

      if (check.shouldReset) {
        // Save completion history before resetting
        await saveTaskCompletionHistory(task);
        
        // Reset the task
        await tasksCollection.updateOne(
          { _id: task._id },
          {
            $set: {
              status: "pending",
              approvalStatus: "pending"
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
        
        // Get all completed subtasks for this task and save their history
        const completedSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "completed"
        }).toArray();
        
        for (const subtask of completedSubtasks) {
          await saveSubtaskCompletionHistory(subtask, task);
        }
        
        // Reset all subtasks for this task
        await subtasksCollection.updateMany(
          { taskId: task._id },
          {
            $set: {
              status: "pending"
            },
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: ""
            }
          }
        );
        
        resetCount++;
        console.log(`[Task Recurrence] Reset task ${task._id} and its subtasks (${task.taskKind}): ${check.message}`);
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

    // Find all completed recurring tasks assigned to this user
    const tasks = await tasksCollection.find({
      $or: [
        { assignedTo: userIdObj },
        { assignees: userIdObj }
      ],
      status: "completed",
      taskKind: { $in: ["daily", "weekly", "monthly", "recurring", "custom"] }
    }).toArray();

    let resetCount = 0;

    for (const task of tasks) {
      // For custom tasks, pass customRecurrence as part of recurringPattern
      const patternToUse = task.taskKind === "custom" && task.customRecurrence
        ? { customRecurrence: task.customRecurrence }
        : task.recurringPattern;
        
      const check = shouldResetRecurringTask(
        task.taskKind as string,
        task.completedAt || task.tickedAt,
        patternToUse
      );

      if (check.shouldReset) {
        // Save completion history before resetting
        await saveTaskCompletionHistory(task);
        
        // Reset the task
        await tasksCollection.updateOne(
          { _id: task._id },
          {
            $set: {
              status: "pending",
              approvalStatus: "pending"
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
        
        // Get all completed subtasks for this task and save their history
        const completedSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "completed"
        }).toArray();
        
        for (const subtask of completedSubtasks) {
          await saveSubtaskCompletionHistory(subtask, task);
        }
        
        // Reset all subtasks for this task
        await subtasksCollection.updateMany(
          { taskId: task._id },
          {
            $set: {
              status: "pending"
            },
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: ""
            }
          }
        );
        
        resetCount++;
        console.log(`[Task Recurrence] Reset task ${task._id} and its subtasks (${task.taskKind}): ${check.message}`);
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
 * This should be called by a cron job at midnight daily
 */
export async function resetAllRecurringTasks(): Promise<number> {
  try {
    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");
    const subtasksCollection = db.collection("subtasks");

    // Find all completed recurring tasks
    const tasks = await tasksCollection.find({
      status: "completed",
      taskKind: { $in: ["daily", "weekly", "monthly", "recurring", "custom"] }
    }).toArray();

    let resetCount = 0;

    for (const task of tasks) {
      // For custom tasks, pass customRecurrence as part of recurringPattern
      const patternToUse = task.taskKind === "custom" && task.customRecurrence
        ? { customRecurrence: task.customRecurrence }
        : task.recurringPattern;
        
      const check = shouldResetRecurringTask(
        task.taskKind as string,
        task.completedAt || task.tickedAt,
        patternToUse
      );

      if (check.shouldReset) {
        // Save completion history before resetting
        await saveTaskCompletionHistory(task);
        
        // Reset the task
        await tasksCollection.updateOne(
          { _id: task._id },
          {
            $set: {
              status: "pending",
              approvalStatus: "pending"
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
        
        // Get all completed subtasks for this task and save their history
        const completedSubtasks = await subtasksCollection.find({
          taskId: task._id,
          status: "completed"
        }).toArray();
        
        for (const subtask of completedSubtasks) {
          await saveSubtaskCompletionHistory(subtask, task);
        }
        
        // Reset all subtasks for this task
        await subtasksCollection.updateMany(
          { taskId: task._id },
          {
            $set: {
              status: "pending"
            },
            $unset: {
              completedAt: "",
              completedBy: "",
              tickedAt: ""
            }
          }
        );
        
        resetCount++;
        console.log(`[Task Recurrence] Reset task ${task._id} and its subtasks (${task.taskKind}): ${check.message}`);
      }
    }

    console.log(`[Task Recurrence] Reset ${resetCount} recurring tasks and their subtasks`);
    return resetCount;
  } catch (error) {
    console.error("[Task Recurrence] Error resetting all recurring tasks:", error);
    throw error;
  }
}
