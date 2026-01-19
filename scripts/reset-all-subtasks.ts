/**
 * Reset All Subtasks Script
 * 
 * This script will reset ALL subtasks in ALL daily tasks (uncheck all completed ones).
 * This is a one-time fix to ensure all subtasks are properly reset.
 * 
 * Run with: npx tsx scripts/reset-all-subtasks.ts
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { dbConnect } from "../src/lib/mongodb";
import { ObjectId } from "mongodb";
import clientPromise from "../src/lib/mongodb";

async function resetAllSubtasks() {
  try {
    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");
    const subtasksCollection = db.collection("subtasks");

    console.log("🔌 Connected to database");
    console.log("🔍 Finding all daily tasks...");

    // Find all daily tasks
    const dailyTasks = await tasksCollection.find({
      taskKind: "daily"
    }).toArray();

    console.log(`📋 Found ${dailyTasks.length} daily tasks\n`);

    let totalSubtasksReset = 0;
    let tasksProcessed = 0;

    for (const task of dailyTasks) {
      try {
        // Convert task._id to ObjectId to ensure proper matching
        const taskId = task._id instanceof ObjectId ? task._id : new ObjectId(task._id);
        
        // Find all subtasks for this task
        const subtasks = await subtasksCollection.find({
          taskId: taskId
        }).toArray();

        if (subtasks.length === 0) {
          continue; // Skip tasks with no subtasks
        }

        // Count completed subtasks
        const completedCount = subtasks.filter(s => s.status === "completed").length;
        
        if (completedCount > 0 || subtasks.length > 0) {
          console.log(`🔧 Task: ${task.title || task._id}`);
          console.log(`   - Total subtasks: ${subtasks.length}`);
          console.log(`   - Completed subtasks: ${completedCount}`);
          
          // Reset ALL subtasks - uncheck all completed ones
          // IMPORTANT: Also reset the 'ticked' field which is a boolean
          const resetResult = await subtasksCollection.updateMany(
            { taskId: taskId },
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
          
          // Verify the reset worked
          const verifySubtasks = await subtasksCollection.find({
            taskId: taskId,
            $or: [
              { status: "completed" },
              { ticked: true }
            ]
          }).toArray();
          
          if (verifySubtasks.length > 0) {
            console.log(`   ⚠️  WARNING: ${verifySubtasks.length} subtask(s) still marked as completed/ticked after reset!`);
            // Try alternative reset methods
            console.log(`   🔄 Trying alternative reset method...`);
            
            // Try with string taskId
            const resetResult2 = await subtasksCollection.updateMany(
              { taskId: taskIdStr },
              {
                $set: {
                  status: "pending",
                  ticked: false,
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
            console.log(`   Alternative method: ${resetResult2.modifiedCount} modified`);
          }

          console.log(`   ✅ Reset ${resetResult.modifiedCount} subtask(s)`);
          totalSubtasksReset += resetResult.modifiedCount;
          tasksProcessed++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing task ${task._id}:`, error);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Reset Summary:");
    console.log("=".repeat(50));
    console.log(`✅ Tasks processed: ${tasksProcessed}`);
    console.log(`🔄 Subtasks reset: ${totalSubtasksReset}`);
    console.log("=".repeat(50));
    console.log("\n✨ All subtasks have been reset!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run the reset
resetAllSubtasks();
