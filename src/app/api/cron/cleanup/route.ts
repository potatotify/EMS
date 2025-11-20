import {NextRequest, NextResponse} from "next/server";
import clientPromise from "@/lib/mongodb";

// This cron job cleans up old/expired data from the database
export async function GET(request: NextRequest) {
  try {
    // Verify this is called by a cron service (optional security check)
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    const now = new Date();
    const results = {
      deletedMeetings: 0,
      deletedCompletedTasks: 0,
      deletedOldUpdates: 0
    };

    // 1. Delete meetings that are older than 24 hours past their scheduled time
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const meetingsResult = await db.collection("projectMeetings").deleteMany({
      meetingDate: {$lt: oneDayAgo.toISOString().split("T")[0]}
    });
    results.deletedMeetings = meetingsResult.deletedCount || 0;

    // 2. Delete completed tasks that are older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const tasksResult = await db.collection("employeeTasks").deleteMany({
      completed: true,
      completedAt: {$lt: thirtyDaysAgo}
    });
    results.deletedCompletedTasks = tasksResult.deletedCount || 0;

    // 3. Delete daily updates older than 90 days (keep 3 months of history)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const updatesResult = await db.collection("dailyUpdates").deleteMany({
      createdAt: {$lt: ninetyDaysAgo}
    });
    results.deletedOldUpdates = updatesResult.deletedCount || 0;

    console.log("Cleanup cron job completed:", results);

    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully",
      results
    });
  } catch (error) {
    console.error("Error in cleanup cron job:", error);
    return NextResponse.json(
      {error: "Cleanup failed", details: String(error)},
      {status: 500}
    );
  }
}
