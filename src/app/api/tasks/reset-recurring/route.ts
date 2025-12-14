import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { resetRecurringTasksForUser, resetAllRecurringTasks } from "@/lib/taskRecurrence";

/**
 * POST /api/tasks/reset-recurring
 * Reset recurring tasks that need to be reset based on their schedule
 * 
 * Query params:
 * - scope: "user" (default) | "all" (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "user";

    let resetCount = 0;

    if (scope === "all") {
      // Only admins can reset all tasks
      if (session.user.role !== "admin") {
        return NextResponse.json(
          { error: "Only admins can reset all recurring tasks" },
          { status: 403 }
        );
      }

      resetCount = await resetAllRecurringTasks();
    } else {
      // Reset tasks for current user
      resetCount = await resetRecurringTasksForUser(session.user.id);
    }

    return NextResponse.json({
      success: true,
      resetCount,
      message: `Successfully reset ${resetCount} recurring task(s)`
    });
  } catch (error: any) {
    console.error("[API] Error resetting recurring tasks:", error);
    return NextResponse.json(
      { error: "Failed to reset recurring tasks", details: error.message },
      { status: 500 }
    );
  }
}
