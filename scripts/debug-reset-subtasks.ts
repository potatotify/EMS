/**
 * Debug Script to Test Subtask Reset
 * 
 * This script will:
 * 1. Find daily tasks and their subtasks
 * 2. Show the current state
 * 3. Test the reset logic
 * 4. Verify the reset worked
 * 
 * Run with: npx tsx scripts/debug-reset-subtasks.ts
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { dbConnect } from "../src/lib/mongodb";
import { ObjectId } from "mongodb";
import clientPromise from "../src/lib/mongodb";

async function debugResetSubtasks() {
  try {
    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");
    const subtasksCollection = db.collection("subtasks");

    console.log("🔌 Connected to database");
    console.log("🔍 Finding daily tasks and their subtasks...\n");

    // Find first 5 daily tasks for testing
    const dailyTasks = await tasksCollection.find({
      taskKind: "daily"
    }).limit(5).toArray();

    console.log(`📋 Found ${dailyTasks.length} daily tasks (showing first 5)\n`);

    for (const task of dailyTasks) {
      try {
        const taskId = task._id instanceof ObjectId ? task._id : new ObjectId(task._id);
        const taskIdStr = taskId.toString();
        
        console.log(`\n${"=".repeat(60)}`);
        console.log(`📌 Task: ${task.title || "Untitled"} (${taskIdStr})`);
        console.log(`   Status: ${task.status}`);
        console.log(`   TaskKind: ${task.taskKind}`);
        
        // Try different ways to find subtasks
        console.log(`\n🔍 Searching for subtasks...`);
        
        // Method 1: Direct ObjectId match
        const subtasks1 = await subtasksCollection.find({
          taskId: taskId
        }).toArray();
        console.log(`   Method 1 (taskId: ObjectId): Found ${subtasks1.length} subtasks`);
        
        // Method 2: String match
        const subtasks2 = await subtasksCollection.find({
          taskId: taskIdStr
        }).toArray();
        console.log(`   Method 2 (taskId: String): Found ${subtasks2.length} subtasks`);
        
        // Method 3: Using $in with both formats
        const subtasks3 = await subtasksCollection.find({
          taskId: { $in: [taskId, taskIdStr] }
        }).toArray();
        console.log(`   Method 3 (taskId: $in): Found ${subtasks3.length} subtasks`);
        
        // Use the method that found the most subtasks
        const subtasks = subtasks1.length >= subtasks2.length ? subtasks1 : subtasks2;
        if (subtasks3.length > subtasks.length) {
          subtasks.push(...subtasks3.filter(s => !subtasks.find(ex => ex._id.toString() === s._id.toString())));
        }
        
        if (subtasks.length === 0) {
          console.log(`   ⚠️  No subtasks found for this task`);
          
          // Check if there are any subtasks at all
          const allSubtasks = await subtasksCollection.find({}).limit(3).toArray();
          if (allSubtasks.length > 0) {
            console.log(`   📝 Sample subtask structure:`);
            console.log(`      - _id: ${allSubtasks[0]._id}`);
            console.log(`      - taskId type: ${typeof allSubtasks[0].taskId}`);
            console.log(`      - taskId value: ${allSubtasks[0].taskId}`);
            console.log(`      - taskId toString: ${allSubtasks[0].taskId?.toString()}`);
          }
          continue;
        }

        console.log(`\n   ✅ Using ${subtasks.length} subtasks found`);
        
        // Show current state
        const completedSubtasks = subtasks.filter(s => s.status === "completed" || s.ticked === true);
        const pendingSubtasks = subtasks.filter(s => s.status === "pending" && s.ticked === false);
        
        console.log(`\n   📊 Current State:`);
        console.log(`      - Total: ${subtasks.length}`);
        console.log(`      - Completed/Ticked: ${completedSubtasks.length}`);
        console.log(`      - Pending: ${pendingSubtasks.length}`);
        
        if (completedSubtasks.length > 0) {
          console.log(`\n   📝 Sample completed subtask:`);
          const sample = completedSubtasks[0];
          console.log(`      - _id: ${sample._id}`);
          console.log(`      - title: ${sample.title}`);
          console.log(`      - status: ${sample.status}`);
          console.log(`      - ticked: ${sample.ticked}`);
          console.log(`      - taskId: ${sample.taskId} (type: ${typeof sample.taskId})`);
          console.log(`      - completedAt: ${sample.completedAt}`);
          console.log(`      - tickedAt: ${sample.tickedAt}`);
        }
        
        // Test the reset query
        console.log(`\n   🔄 Testing reset query...`);
        
        // Try reset with ObjectId
        const resetResult1 = await subtasksCollection.updateMany(
          { taskId: taskId },
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
        console.log(`      Reset with ObjectId: ${resetResult1.modifiedCount} modified, ${resetResult1.matchedCount} matched`);
        
        // Verify the reset worked
        const subtasksAfter = await subtasksCollection.find({
          taskId: taskId
        }).toArray();
        
        const stillCompleted = subtasksAfter.filter(s => s.status === "completed" || s.ticked === true).length;
        
        console.log(`\n   ✅ After Reset:`);
        console.log(`      - Still completed/ticked: ${stillCompleted}`);
        console.log(`      - Should be 0 if reset worked`);
        
        if (stillCompleted > 0) {
          console.log(`\n   ⚠️  WARNING: Reset didn't work! Some subtasks are still completed.`);
          console.log(`   🔍 Checking why...`);
          
          const stillCompletedList = subtasksAfter.filter(s => s.status === "completed" || s.ticked === true);
          for (const st of stillCompletedList) {
            console.log(`      - Subtask ${st._id}: status=${st.status}, ticked=${st.ticked}, taskId=${st.taskId}`);
          }
        } else {
          console.log(`   ✅ Reset successful!`);
        }
        
      } catch (error: any) {
        console.error(`   ❌ Error processing task ${task._id}:`, error.message);
        console.error(`   Stack:`, error.stack);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✨ Debug completed!");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Fatal error:", error);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Run the debug
debugResetSubtasks();
