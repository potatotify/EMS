/**
 * Fix Daily Tasks Reset Script
 * 
 * This script fixes daily tasks and subtasks that weren't reset properly yesterday.
 * It will:
 * 1. Find daily tasks that should have been reset but weren't
 * 2. Save completion history for completed tasks/subtasks
 * 3. Save incomplete subtasks as deadline_passed (so fines are applied)
 * 4. Reset all tasks/subtasks properly for today
 * 
 * Run with: npx tsx scripts/fix-daily-tasks-reset.ts
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { dbConnect } from "../src/lib/mongodb";
import { ObjectId } from "mongodb";
import clientPromise from "../src/lib/mongodb";
import { shouldResetRecurringTask } from "../src/lib/taskRecurrence";
import TaskCompletion from "../src/models/TaskCompletion";
import SubtaskCompletion from "../src/models/SubtaskCompletion";

async function saveTaskCompletionHistory(task: any): Promise<void> {
  try {
    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");

    // Get assignee names
    let assigneeNames: string[] = [];
    if (task.assignees && Array.isArray(task.assignees)) {
      assigneeNames = await Promise.all(
        task.assignees.map(async (assigneeId: any) => {
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
    } else if (task.assignedTo) {
      const user = await usersCollection.findOne(
        { _id: task.assignedTo instanceof ObjectId ? task.assignedTo : new ObjectId(task.assignedTo) },
        { projection: { name: 1 } }
      );
      if (user) {
        assigneeNames = [user.name || "Unknown"];
      }
    }

    // Get completedBy name
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

    const taskAny = task as any;
    const completionData = {
      taskId: task._id,
      taskTitle: task.title,
      taskKind: task.taskKind,
      projectId: task.projectId,
      projectName: task.projectName,
      section: task.section || "No Section",
      assignees: task.assignees || (task.assignedTo ? [task.assignedTo] : []),
      assigneeNames: assigneeNames,
      completedBy: task.completedBy,
      completedByName: completedByName,
      tickedAt: task.tickedAt || task.completedAt,
      completedAt: task.completedAt,
      bonusPoints: typeof taskAny.bonusPoints === "number" ? taskAny.bonusPoints : undefined,
      bonusCurrency: typeof taskAny.bonusCurrency === "number" ? taskAny.bonusCurrency : undefined,
      penaltyPoints: typeof taskAny.penaltyPoints === "number" ? taskAny.penaltyPoints : undefined,
      penaltyCurrency: typeof taskAny.penaltyCurrency === "number" ? taskAny.penaltyCurrency : undefined,
      approvalStatus: taskAny.approvalStatus || "pending",
      deadlineDate: taskAny.deadlineDate || undefined,
      deadlineTime: taskAny.deadlineTime || undefined,
      dueDate: taskAny.dueDate || undefined,
      dueTime: taskAny.dueTime || undefined,
      assignedDate: taskAny.assignedDate || undefined,
      assignedTime: taskAny.assignedTime || undefined,
      timeSpent: typeof taskAny.timeSpent === "number" ? taskAny.timeSpent : undefined,
    };

    await TaskCompletion.create(completionData);
  } catch (error) {
    console.error(`[Task History] Error saving completion history for task ${task._id}:`, error);
  }
}

async function saveSubtaskCompletionHistory(subtask: any, task: any): Promise<void> {
  try {
    await dbConnect();
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
    } else if (subtask.assignee) {
      const user = await usersCollection.findOne(
        { _id: subtask.assignee instanceof ObjectId ? subtask.assignee : new ObjectId(subtask.assignee) },
        { projection: { name: 1 } }
      );
      if (user) {
        assigneeNames = [user.name || "Unknown"];
      }
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

    const subtaskAny = subtask as any;
    const parentTaskAny = task as any;

    // Subtasks inherit deadline from main task if not set
    const deadlineDate = subtaskAny.deadlineDate || parentTaskAny.deadlineDate || undefined;
    const deadlineTime = subtaskAny.deadlineTime || parentTaskAny.deadlineTime || undefined;

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
      bonusPoints: typeof parentTaskAny.bonusPoints === "number" ? parentTaskAny.bonusPoints : (typeof subtaskAny.bonusPoints === "number" ? subtaskAny.bonusPoints : undefined),
      bonusCurrency: typeof parentTaskAny.bonusCurrency === "number" ? parentTaskAny.bonusCurrency : (typeof subtaskAny.bonusCurrency === "number" ? subtaskAny.bonusCurrency : undefined),
      penaltyPoints: typeof parentTaskAny.penaltyPoints === "number" ? parentTaskAny.penaltyPoints : (typeof subtaskAny.penaltyPoints === "number" ? subtaskAny.penaltyPoints : undefined),
      penaltyCurrency: typeof parentTaskAny.penaltyCurrency === "number" ? parentTaskAny.penaltyCurrency : (typeof subtaskAny.penaltyCurrency === "number" ? subtaskAny.penaltyCurrency : undefined),
      approvalStatus: subtaskAny.approvalStatus || parentTaskAny.approvalStatus || "pending",
      deadlineDate: deadlineDate,
      deadlineTime: deadlineTime,
      dueDate: subtaskAny.dueDate || parentTaskAny.dueDate || undefined,
      dueTime: subtaskAny.dueTime || parentTaskAny.dueTime || undefined,
      assignedDate: parentTaskAny.assignedDate || undefined,
      assignedTime: parentTaskAny.assignedTime || undefined,
      timeSpent: typeof subtaskAny.timeSpent === "number" ? subtaskAny.timeSpent : undefined,
    };

    await SubtaskCompletion.create(completionData);
  } catch (error) {
    console.error(`[Subtask History] Error saving completion history for subtask ${subtask._id}:`, error);
  }
}

async function fixDailyTasksReset() {
  try {
    // Check for --force flag to reset all daily tasks regardless of state
    const forceReset = process.argv.includes("--force");
    // Check for --reset-subtasks flag to reset ALL subtasks in ALL daily tasks
    const resetAllSubtasks = process.argv.includes("--reset-subtasks");
    
    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");
    const subtasksCollection = db.collection("subtasks");

    console.log("🔌 Connected to database");
    if (forceReset) {
      console.log("⚠️  FORCE MODE: Will reset ALL daily tasks regardless of state");
    }
    if (resetAllSubtasks) {
      console.log("⚠️  RESET-SUBTASKS MODE: Will reset ALL subtasks in ALL daily tasks (uncheck all)");
      console.log("   This will save history for completed subtasks before resetting");
    }
    console.log("🔍 Finding daily tasks that need to be fixed...");

    const now = new Date();
    
    // Get today's date in IST
    const istFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayISTString = istFormatter.format(now);
    const today = new Date(todayISTString + "T00:00:00");

    // Get yesterday's date in IST
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Find all daily tasks
    const dailyTasks = await tasksCollection.find({
      taskKind: "daily"
    }).toArray();

    console.log(`📋 Found ${dailyTasks.length} daily tasks`);
    console.log(`📅 Today (IST): ${today.toISOString()}`);
    console.log(`📅 Yesterday (IST): ${yesterday.toISOString()}`);
    
    if (resetAllSubtasks) {
      console.log("\n⚠️  RESET-SUBTASKS MODE: Processing all daily tasks to reset their subtasks\n");
    }

    let stats = {
      tasksFixed: 0,
      tasksReset: 0,
      subtasksFixed: 0,
      subtasksReset: 0,
      incompleteSubtasksFined: 0,
      errors: 0,
      skippedCompleted: 0,
      skippedPending: 0,
      debug: {
        completedTasks: 0,
        pendingTasks: 0,
        tasksWithDeadline: 0,
        tasksWithoutDeadline: 0,
      }
    };

    for (const task of dailyTasks) {
      try {
        const taskAny = task as any;
        const isCompleted = task.status === "completed";
        let shouldFix = false;
        
        // If resetAllSubtasks mode, always fix the task to reset its subtasks
        if (resetAllSubtasks) {
          shouldFix = true;
          console.log(`\n🔧 [RESET-SUBTASKS] Task ${task._id} (${task.title}) - will reset all subtasks`);
        }

        if (isCompleted) {
          stats.debug.completedTasks++;
          
          if (forceReset) {
            // Force mode: reset all completed tasks
            shouldFix = true;
            console.log(`\n🔧 [FORCE] Task ${task._id} (${task.title}) will be reset`);
          } else {
            // For completed tasks, check if they were completed before today
            const lastCompletedAt = taskAny.completedAt || taskAny.tickedAt;
            if (lastCompletedAt) {
              const completedDate = new Date(lastCompletedAt);
              const completedDay = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
              const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              
              // If completed before today, it should be reset
              if (completedDay < todayDay) {
                shouldFix = true;
                console.log(`\n🔧 Task ${task._id} (${task.title}) was completed on ${completedDay.toISOString()}, needs reset`);
              } else {
                stats.skippedCompleted++;
              }
            } else {
              // Task is marked completed but has no completion date - should fix
              shouldFix = true;
              console.log(`\n🔧 Task ${task._id} (${task.title}) is completed but has no completion date, needs reset`);
            }
          }
        } else if (task.status === "pending") {
          stats.debug.pendingTasks++;
          
          if (forceReset) {
            // Force mode: reset all pending tasks
            shouldFix = true;
            console.log(`\n🔧 [FORCE] Task ${task._id} (${task.title}) will be reset`);
          } else {
            // For pending tasks, check if deadline was yesterday or earlier
            if (taskAny.deadlineTime) {
              stats.debug.tasksWithDeadline++;
              let deadlineDate: Date;
              if (taskAny.deadlineDate) {
                deadlineDate = new Date(taskAny.deadlineDate);
                deadlineDate.setHours(0, 0, 0, 0);
              } else {
                // No deadlineDate set, use yesterday as default for daily tasks
                deadlineDate = new Date(yesterday);
                deadlineDate.setHours(0, 0, 0, 0);
              }

              const [hours, minutes] = taskAny.deadlineTime.split(":");
              deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

              // Check if deadline was yesterday or earlier
              const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
              const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              
              if (deadlineDay < todayDay || (deadlineDay.getTime() === todayDay.getTime() && now > deadlineDate)) {
                shouldFix = true;
                console.log(`\n🔧 Task ${task._id} (${task.title}) has deadline ${deadlineDate.toISOString()}, needs reset`);
              } else {
                stats.skippedPending++;
              }
            } else {
              stats.debug.tasksWithoutDeadline++;
              // No deadlineTime - check if task was assigned yesterday or earlier
              if (taskAny.assignedDate) {
                const assignedDate = new Date(taskAny.assignedDate);
                const assignedDay = new Date(assignedDate.getFullYear(), assignedDate.getMonth(), assignedDate.getDate());
                const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                
                if (assignedDay < todayDay) {
                  shouldFix = true;
                  console.log(`\n🔧 Task ${task._id} (${task.title}) was assigned on ${assignedDay.toISOString()}, needs reset`);
                } else {
                  stats.skippedPending++;
                }
              } else {
                stats.skippedPending++;
              }
            }
          }
        }

        if (shouldFix) {
          console.log(`\n🔧 Fixing task ${task._id} (${task.title})`);

          // If task is completed, save completion history
          if (isCompleted) {
            await saveTaskCompletionHistory(task);
            console.log(`  ✓ Saved completion history for task`);
          } else {
            // For incomplete tasks, save as deadline_passed
            await saveTaskCompletionHistory({
              ...task,
              status: "pending",
              tickedAt: null,
              completedAt: null,
              completedBy: null,
              approvalStatus: "deadline_passed",
              deadlineDate: taskAny.deadlineDate || yesterday,
            });
            console.log(`  ✓ Saved incomplete task as deadline_passed`);
          }

          // Handle subtasks
          const allSubtasks = await subtasksCollection.find({
            taskId: task._id
          }).toArray();

          console.log(`  📝 Processing ${allSubtasks.length} subtasks...`);

          // Save completed subtasks
          const completedSubtasks = allSubtasks.filter(s => s.status === "completed");
          for (const subtask of completedSubtasks) {
            await saveSubtaskCompletionHistory(subtask, task);
            console.log(`    ✓ Saved completion history for subtask ${subtask._id}`);
          }

          // Save incomplete subtasks as deadline_passed
          const incompleteSubtasks = allSubtasks.filter(s => s.status === "pending");
          
          // Calculate deadline date for incomplete subtasks
          let baseDeadlineDate: Date;
          if (taskAny.deadlineDate) {
            baseDeadlineDate = new Date(taskAny.deadlineDate);
            baseDeadlineDate.setHours(0, 0, 0, 0);
          } else {
            baseDeadlineDate = new Date(yesterday);
            baseDeadlineDate.setHours(0, 0, 0, 0);
          }

          const deadlineTime = taskAny.deadlineTime || "23:59";
          const [deadlineHours, deadlineMinutes] = deadlineTime.split(":");
          baseDeadlineDate.setHours(parseInt(deadlineHours), parseInt(deadlineMinutes), 0, 0);

          for (const subtask of incompleteSubtasks) {
            const subtaskAny = subtask as any;
            
            // Use subtask's deadline if available, otherwise use parent task's deadline
            const subtaskDeadlineTime = subtaskAny.deadlineTime || deadlineTime;
            let subtaskDeadlineDate: Date;
            
            if (subtaskAny.deadlineDate) {
              subtaskDeadlineDate = new Date(subtaskAny.deadlineDate);
              subtaskDeadlineDate.setHours(0, 0, 0, 0);
            } else {
              subtaskDeadlineDate = new Date(baseDeadlineDate);
              subtaskDeadlineDate.setHours(0, 0, 0, 0);
            }
            
            const [h, m] = subtaskDeadlineTime.split(":");
            subtaskDeadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);

            await saveSubtaskCompletionHistory({
              ...subtask,
              status: "pending",
              tickedAt: null,
              completedAt: null,
              completedBy: subtaskAny.assignee || null,
              approvalStatus: "deadline_passed",
              deadlineDate: subtaskDeadlineDate,
              deadlineTime: subtaskDeadlineTime,
            }, task);
            
            console.log(`    ✓ Saved incomplete subtask ${subtask._id} as deadline_passed (fine will be applied)`);
            stats.incompleteSubtasksFined++;
          }

          // Reset the task (only if not in reset-subtasks-only mode)
          if (!resetAllSubtasks) {
            const updateFields: any = {
              status: "pending",
              approvalStatus: "pending"
            };

            if (taskAny.deadlineTime) {
              updateFields.deadlineDate = today;
            }

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
          }

          // Reset ALL subtasks - uncheck all completed ones
          // Convert task._id to ObjectId if it's not already
          const taskIdObj = task._id instanceof ObjectId ? task._id : new ObjectId(task._id);
          
          const resetResult = await subtasksCollection.updateMany(
            { taskId: taskIdObj },
            {
              $set: {
                status: "pending",
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

          console.log(`    ✅ Reset ${resetResult.modifiedCount} subtask(s) (unchecked all completed ones)`);
          
          // Verify the reset worked
          const remainingCompleted = await subtasksCollection.countDocuments({
            taskId: taskIdObj,
            status: "completed"
          });
          
          if (remainingCompleted > 0) {
            console.log(`    ⚠️  WARNING: ${remainingCompleted} subtask(s) still marked as completed after reset!`);
          }

          stats.tasksFixed++;
          stats.tasksReset++;
          stats.subtasksReset += allSubtasks.length;
          console.log(`  ✅ Task and all subtasks reset successfully`);
        }
      } catch (error) {
        console.error(`  ❌ Error fixing task ${task._id}:`, error);
        stats.errors++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Fix Summary:");
    console.log("=".repeat(50));
    console.log(`✅ Tasks fixed: ${stats.tasksFixed}`);
    console.log(`🔄 Tasks reset: ${stats.tasksReset}`);
    console.log(`📝 Subtasks processed: ${stats.subtasksReset}`);
    console.log(`💰 Incomplete subtasks fined: ${stats.incompleteSubtasksFined}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log("\n📊 Debug Info:");
    console.log(`   - Completed tasks: ${stats.debug.completedTasks}`);
    console.log(`   - Pending tasks: ${stats.debug.pendingTasks}`);
    console.log(`   - Tasks with deadline: ${stats.debug.tasksWithDeadline}`);
    console.log(`   - Tasks without deadline: ${stats.debug.tasksWithoutDeadline}`);
    console.log(`   - Skipped (completed, already today): ${stats.skippedCompleted}`);
    console.log(`   - Skipped (pending, deadline not passed): ${stats.skippedPending}`);
    console.log("=".repeat(50));
    console.log("\n✨ Fix completed!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run the fix
fixDailyTasksReset();
