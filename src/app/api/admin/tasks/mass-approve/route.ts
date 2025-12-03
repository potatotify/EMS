import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import { ObjectId } from "mongodb";

// POST - Mass approve/reject tasks
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { taskIds, approve } = body; // Array of task IDs, true to approve, false to reject

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: "Task IDs array is required" }, { status: 400 });
    }

    await dbConnect();

    const now = new Date();
    const results = [];

    for (const taskId of taskIds) {
      try {
        const task = await Task.findById(taskId);
        if (!task) {
          results.push({ taskId, success: false, error: "Task not found" });
          continue;
        }

        const taskAny = task as any;

        // Calculate if task was completed on time (only for approve)
        let shouldGetPenalty = false;
        let shouldGetReward = false;

        if (approve && task.status === "completed") {
          // Check if deadline has passed
          if (taskAny.deadlineDate) {
            const deadlineDate = new Date(taskAny.deadlineDate);
            if (taskAny.deadlineTime) {
              const [hours, minutes] = taskAny.deadlineTime.split(":");
              deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }

            const completedAt = taskAny.tickedAt || taskAny.completedAt || now;
            if (completedAt > deadlineDate) {
              shouldGetPenalty = true;
            } else if (taskAny.bonusPoints && taskAny.bonusPoints > 0) {
              shouldGetReward = true;
            }
          } else if (taskAny.dueDate) {
            const dueDate = new Date(taskAny.dueDate);
            if (taskAny.dueTime) {
              const [hours, minutes] = taskAny.dueTime.split(":");
              dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            } else {
              dueDate.setHours(23, 59, 59, 999);
            }

            const completedAt = taskAny.tickedAt || taskAny.completedAt || now;
            if (completedAt > dueDate) {
              shouldGetPenalty = true;
            } else if (taskAny.bonusPoints && taskAny.bonusPoints > 0) {
              shouldGetReward = true;
            }
          } else if (taskAny.bonusPoints && taskAny.bonusPoints > 0) {
            shouldGetReward = true;
          }
        }

        // Update approval status
        if (approve) {
          task.approvalStatus = "approved";
          task.approvedBy = new ObjectId(session.user.id);
          task.approvedAt = now;
        } else {
          task.approvalStatus = "rejected";
          task.approvedBy = new ObjectId(session.user.id);
          task.approvedAt = now;
        }

        await task.save();
        results.push({ taskId, success: true });
      } catch (error) {
        console.error(`Error processing task ${taskId}:`, error);
        results.push({ taskId, success: false, error: "Internal error" });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalProcessed: results.length,
      successful: results.filter((r) => r.success).length,
    });
  } catch (error) {
    console.error("Error mass approving tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

