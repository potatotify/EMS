import { NextRequest, NextResponse } from "next/server";
import { resetAllRecurringTasks } from "@/lib/taskRecurrence";

/**
 * POST /api/cron/reset-recurring-tasks
 * Cron job endpoint to automatically reset all recurring tasks
 * This should be called daily at midnight (or early morning)
 * 
 * Protected by Vercel cron secret header
 */
export async function POST(request: NextRequest) {
  try {
    // Check for Vercel cron header or cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get("x-vercel-cron");
    
    const isCronRequest = 
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      vercelCronHeader === "1";

    if (!isCronRequest) {
      return NextResponse.json(
        { error: "Unauthorized - Cron job only" },
        { status: 403 }
      );
    }

    console.log("[Cron] Starting recurring tasks reset...");
    const resetCount = await resetAllRecurringTasks();
    
    console.log(`[Cron] Successfully reset ${resetCount} recurring task(s)`);
    
    return NextResponse.json({
      success: true,
      resetCount,
      message: `Successfully reset ${resetCount} recurring task(s)`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Cron] Error resetting recurring tasks:", error);
    return NextResponse.json(
      { 
        error: "Failed to reset recurring tasks", 
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
