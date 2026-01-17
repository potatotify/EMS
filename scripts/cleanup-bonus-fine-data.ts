/**
 * Database Cleanup Script for Bonus/Fine Data
 * 
 * This script helps clean up old bonus/fine data while preserving important information.
 * 
 * Options:
 * 1. Archive old TaskCompletion and SubtaskCompletion records (recommended)
 * 2. Delete old records before a specific date
 * 3. Reset all approvalStatus to "pending" (soft reset)
 * 4. Clear custom bonus/fine entries
 * 
 * Run with: npx tsx scripts/cleanup-bonus-fine-data.ts
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { dbConnect } from "../src/lib/mongodb";
import TaskCompletion from "../src/models/TaskCompletion";
import SubtaskCompletion from "../src/models/SubtaskCompletion";
import { ObjectId } from "mongodb";
import clientPromise from "../src/lib/mongodb";

interface CleanupOptions {
  archiveOldRecords?: boolean;
  deleteBeforeDate?: Date;
  resetApprovalStatus?: boolean;
  clearCustomEntries?: boolean;
  archiveDate?: Date; // Archive records before this date
}

async function cleanupBonusFineData(options: CleanupOptions) {
  try {
    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");

    console.log("🔌 Connected to database");
    console.log("📋 Cleanup options:", options);

    let stats = {
      taskCompletionsArchived: 0,
      taskCompletionsDeleted: 0,
      subtaskCompletionsArchived: 0,
      subtaskCompletionsDeleted: 0,
      approvalStatusReset: 0,
      customEntriesCleared: 0,
    };

    // Option 1: Archive old records
    if (options.archiveOldRecords && options.archiveDate) {
      console.log(`\n📦 Archiving records before ${options.archiveDate.toISOString()}...`);
      
      // Create archive collection
      const archiveDate = options.archiveDate;
      
      // Archive TaskCompletions
      const oldTaskCompletions = await TaskCompletion.find({
        createdAt: { $lt: archiveDate }
      }).lean();
      
      if (oldTaskCompletions.length > 0) {
        await db.collection("taskCompletions_archive").insertMany(
          oldTaskCompletions.map((tc: any) => ({
            ...tc,
            archivedAt: new Date(),
            originalId: tc._id,
          }))
        );
        stats.taskCompletionsArchived = oldTaskCompletions.length;
        console.log(`  ✓ Archived ${oldTaskCompletions.length} TaskCompletion records`);
      }
      
      // Archive SubtaskCompletions
      const oldSubtaskCompletions = await SubtaskCompletion.find({
        createdAt: { $lt: archiveDate }
      }).lean();
      
      if (oldSubtaskCompletions.length > 0) {
        await db.collection("subtaskCompletions_archive").insertMany(
          oldSubtaskCompletions.map((sc: any) => ({
            ...sc,
            archivedAt: new Date(),
            originalId: sc._id,
          }))
        );
        stats.subtaskCompletionsArchived = oldSubtaskCompletions.length;
        console.log(`  ✓ Archived ${oldSubtaskCompletions.length} SubtaskCompletion records`);
      }
    }

    // Option 2: Delete old records
    if (options.deleteBeforeDate) {
      console.log(`\n🗑️  Deleting records before ${options.deleteBeforeDate.toISOString()}...`);
      
      const deleteResult = await TaskCompletion.deleteMany({
        createdAt: { $lt: options.deleteBeforeDate }
      });
      stats.taskCompletionsDeleted = deleteResult.deletedCount || 0;
      console.log(`  ✓ Deleted ${stats.taskCompletionsDeleted} TaskCompletion records`);
      
      const deleteSubtaskResult = await SubtaskCompletion.deleteMany({
        createdAt: { $lt: options.deleteBeforeDate }
      });
      stats.subtaskCompletionsDeleted = deleteSubtaskResult.deletedCount || 0;
      console.log(`  ✓ Deleted ${stats.subtaskCompletionsDeleted} SubtaskCompletion records`);
    }

    // Option 3: Reset approval status (soft reset)
    if (options.resetApprovalStatus) {
      console.log(`\n🔄 Resetting approval status to "pending"...`);
      
      const resetTaskResult = await TaskCompletion.updateMany(
        { approvalStatus: { $ne: "pending" } },
        { $set: { approvalStatus: "pending" } }
      );
      stats.approvalStatusReset += resetTaskResult.modifiedCount || 0;
      
      const resetSubtaskResult = await SubtaskCompletion.updateMany(
        { approvalStatus: { $ne: "pending" } },
        { $set: { approvalStatus: "pending" } }
      );
      stats.approvalStatusReset += resetSubtaskResult.modifiedCount || 0;
      
      console.log(`  ✓ Reset approval status for ${stats.approvalStatusReset} records`);
    }

    // Option 4: Clear custom bonus/fine entries
    if (options.clearCustomEntries) {
      console.log(`\n🧹 Clearing custom bonus/fine entries...`);
      
      const customBonusFineResult = await db.collection("customBonusFine").deleteMany({});
      stats.customEntriesCleared = customBonusFineResult.deletedCount || 0;
      console.log(`  ✓ Cleared ${stats.customEntriesCleared} custom bonus/fine entries`);
    }

    console.log("\n✅ Cleanup completed!");
    console.log("\n📊 Summary:");
    console.log(`  - TaskCompletions archived: ${stats.taskCompletionsArchived}`);
    console.log(`  - TaskCompletions deleted: ${stats.taskCompletionsDeleted}`);
    console.log(`  - SubtaskCompletions archived: ${stats.subtaskCompletionsArchived}`);
    console.log(`  - SubtaskCompletions deleted: ${stats.subtaskCompletionsDeleted}`);
    console.log(`  - Approval status reset: ${stats.approvalStatusReset}`);
    console.log(`  - Custom entries cleared: ${stats.customEntriesCleared}`);

    return stats;
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log("🧹 Bonus/Fine Data Cleanup Script\n");
  console.log("⚠️  WARNING: This script will modify your database!");
  console.log("💡 Recommendation: Archive old records instead of deleting them.\n");

  // Example: Archive records older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Example: Delete records older than 90 days (after archiving)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Configure cleanup options
  const options: CleanupOptions = {
    // Option 1: Archive old records (RECOMMENDED - preserves data)
    archiveOldRecords: true,
    archiveDate: thirtyDaysAgo,
    
    // Option 2: Delete very old records (only after archiving)
    // deleteBeforeDate: ninetyDaysAgo,
    
    // Option 3: Soft reset approval status (optional)
    // resetApprovalStatus: false,
    
    // Option 4: Clear custom bonus/fine entries (optional)
    // clearCustomEntries: false,
  };

  // Uncomment the options you want to use:
  // options.deleteBeforeDate = ninetyDaysAgo; // Delete records older than 90 days
  // options.resetApprovalStatus = true; // Reset all approval statuses
  // options.clearCustomEntries = true; // Clear custom bonus/fine entries

  await cleanupBonusFineData(options);
  
  console.log("\n✨ Done!");
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { cleanupBonusFineData };
