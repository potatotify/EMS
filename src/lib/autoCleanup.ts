// Auto-cleanup utility for removing old data
import clientPromise from "@/lib/mongodb";

let cleanupScheduled = false;

export async function scheduleAutoCleanup() {
  if (cleanupScheduled) return;

  cleanupScheduled = true;

  // Run cleanup immediately on startup
  await runCleanup();

  // Run cleanup every 24 hours
  setInterval(async () => {
    await runCleanup();
  }, 24 * 60 * 60 * 1000); // 24 hours
}

async function runCleanup() {
  try {
    console.log("Starting automatic cleanup...");

    const client = await clientPromise;
    const db = client.db("worknest");

    const now = new Date();
    let totalDeleted = 0;

    // 1. Delete past meetings (completed meetings older than 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = new Date(oneDayAgo);
    yesterday.setHours(0, 0, 0, 0);

    const meetingsResult = await db.collection("projectMeetings").deleteMany({
      meetingDate: {$lt: yesterday.toISOString().split("T")[0]}
    });

    if (meetingsResult.deletedCount && meetingsResult.deletedCount > 0) {
      console.log(`Deleted ${meetingsResult.deletedCount} past meetings`);
      totalDeleted += meetingsResult.deletedCount;
    }

    // 2. Delete completed tasks older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const tasksResult = await db.collection("employeeTasks").deleteMany({
      completed: true,
      completedAt: {$lt: thirtyDaysAgo}
    });

    if (tasksResult.deletedCount && tasksResult.deletedCount > 0) {
      console.log(`Deleted ${tasksResult.deletedCount} old completed tasks`);
      totalDeleted += tasksResult.deletedCount;
    }

    // 3. Delete daily updates older than 90 days
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const updatesResult = await db.collection("dailyUpdates").deleteMany({
      createdAt: {$lt: ninetyDaysAgo}
    });

    if (updatesResult.deletedCount && updatesResult.deletedCount > 0) {
      console.log(`Deleted ${updatesResult.deletedCount} old daily updates`);
      totalDeleted += updatesResult.deletedCount;
    }

    if (totalDeleted > 0) {
      console.log(`Cleanup completed: ${totalDeleted} total items removed`);
    } else {
      console.log("Cleanup completed: No items to remove");
    }
  } catch (error) {
    console.error("Error during automatic cleanup:", error);
  }
}

// Export for manual trigger if needed
export {runCleanup};
