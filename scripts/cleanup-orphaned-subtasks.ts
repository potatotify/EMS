/**
 * Cleanup Orphaned Subtasks Script
 * 
 * This script finds and deletes subtasks that don't have a parent task (orphaned subtasks).
 * These can occur if tasks were deleted without properly cleaning up their subtasks.
 * 
 * Run with: npx tsx scripts/cleanup-orphaned-subtasks.ts
 * 
 * To actually delete (default is dry-run):
 * npx tsx scripts/cleanup-orphaned-subtasks.ts --delete
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { dbConnect } from "../src/lib/mongodb";
import clientPromise from "../src/lib/mongodb";
import SubtaskCompletion from "../src/models/SubtaskCompletion";
import { ObjectId } from "mongodb";

async function cleanupOrphanedSubtasks() {
  try {
    await dbConnect();
    console.log("✅ Database connected for cleanup.");

    const client = await clientPromise;
    const db = client.db("worknest");

    // Check if --delete flag is provided
    const shouldDelete = process.argv.includes("--delete");

    // Get all subtasks
    const allSubtasks = await db.collection("subtasks").find({}).toArray();
    console.log(`\n📊 Found ${allSubtasks.length} total subtask(s) in database.`);

    // Get all task IDs that exist
    const allTasks = await db.collection("tasks").find({}).project({ _id: 1 }).toArray();
    const existingTaskIds = new Set(
      allTasks.map((t: any) => t._id.toString())
    );
    console.log(`📋 Found ${existingTaskIds.size} existing task(s) in database.`);

    // Find orphaned subtasks (subtasks whose parent task doesn't exist)
    const orphanedSubtasks: any[] = [];
    for (const subtask of allSubtasks) {
      const taskId = subtask.taskId?.toString();
      if (!taskId || !existingTaskIds.has(taskId)) {
        orphanedSubtasks.push(subtask);
      }
    }

    console.log(`\n🔍 Found ${orphanedSubtasks.length} orphaned subtask(s) (subtasks without parent tasks).`);

    if (orphanedSubtasks.length === 0) {
      console.log("\n✨ No orphaned subtasks found. Database is clean!");
      process.exit(0);
    }

    // Display orphaned subtasks (limit to first 20 for readability)
    console.log("\n📝 Orphaned Subtasks (showing first 20):");
    console.log("=".repeat(80));
    const displayLimit = Math.min(20, orphanedSubtasks.length);
    for (let i = 0; i < displayLimit; i++) {
      const subtask = orphanedSubtasks[i];
      console.log(`  ${i + 1}. ID: ${subtask._id}`);
      console.log(`     Title: ${subtask.title || 'N/A'}`);
      console.log(`     Parent Task ID: ${subtask.taskId || 'N/A'} (NOT FOUND)`);
      console.log(`     Status: ${subtask.status || 'N/A'}`);
      console.log(`     Created: ${subtask.createdAt ? new Date(subtask.createdAt).toISOString() : 'N/A'}`);
      console.log("");
    }
    if (orphanedSubtasks.length > 20) {
      console.log(`  ... and ${orphanedSubtasks.length - 20} more orphaned subtask(s)\n`);
    }

    // Get orphaned subtask IDs for SubtaskCompletion cleanup
    const orphanedSubtaskIds = orphanedSubtasks.map((st: any) => st._id);

    // Count SubtaskCompletion records for orphaned subtasks
    const subtaskCompletionCount = await SubtaskCompletion.countDocuments({
      subtaskId: { $in: orphanedSubtaskIds }
    });
    console.log(`\n📊 Found ${subtaskCompletionCount} SubtaskCompletion record(s) for orphaned subtasks.`);

    if (!shouldDelete) {
      console.log("\n⚠️  DRY RUN MODE - No data will be deleted.");
      console.log("\n⚠️  WARNING: This would permanently delete:");
      console.log(`   - ${orphanedSubtasks.length} orphaned subtask(s)`);
      console.log(`   - ${subtaskCompletionCount} SubtaskCompletion record(s)`);
      console.log("\n💡 To actually delete, run with --delete flag:");
      console.log("   npx tsx scripts/cleanup-orphaned-subtasks.ts --delete\n");
      process.exit(0);
    }

    // Actually delete the orphaned subtasks
    console.log("\n🗑️  DELETION MODE - Proceeding with deletion...\n");

    // Delete SubtaskCompletion records for orphaned subtasks
    let deletedCompletionCount = 0;
    if (subtaskCompletionCount > 0) {
      const subtaskCompletionResult = await SubtaskCompletion.deleteMany({
        subtaskId: { $in: orphanedSubtaskIds }
      });
      deletedCompletionCount = subtaskCompletionResult.deletedCount;
      console.log(`✅ Deleted ${deletedCompletionCount} SubtaskCompletion record(s).`);
    }

    // Delete orphaned subtasks
    const subtasksResult = await db.collection("subtasks").deleteMany({
      _id: { $in: orphanedSubtaskIds }
    });
    console.log(`✅ Deleted ${subtasksResult.deletedCount} orphaned subtask(s).`);

    console.log("\n✨ Cleanup completed successfully!");
    console.log(`\n📈 Summary:`);
    console.log(`   - Orphaned subtasks deleted: ${subtasksResult.deletedCount}`);
    console.log(`   - SubtaskCompletion records deleted: ${deletedCompletionCount}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrphanedSubtasks();
