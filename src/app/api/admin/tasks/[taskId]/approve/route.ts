import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import { ObjectId } from "mongodb";

// POST - Approve task and calculate reward/penalty
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { taskId } = await params;
    const body = await request.json();
    const { approve, bonusPoints, bonusCurrency, penaltyPoints, penaltyCurrency } = body; // true to approve, false to reject

    await dbConnect();

    const task = await Task.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const now = new Date();

    // Skip bonus/penalty calculation for tasks marked as not applicable
    const taskAny = task as any;
    const isNotApplicable = taskAny.notApplicable === true;

    // For employee-created tasks, require bonus/penalty to be set before approval
    if (taskAny.createdByEmployee && approve && task.status === "completed") {
      if (bonusPoints === undefined && penaltyPoints === undefined) {
        return NextResponse.json({ 
          error: "Please set bonus and/or penalty points before approving employee-created tasks",
          requiresPoints: true 
        }, { status: 400 });
      }
      
      // Set bonus/penalty points and currency for employee-created tasks
      if (bonusPoints !== undefined) {
        task.bonusPoints = bonusPoints;
      }
      if (bonusCurrency !== undefined) {
        task.bonusCurrency = bonusCurrency;
      }
      if (penaltyPoints !== undefined) {
        task.penaltyPoints = penaltyPoints;
      }
      if (penaltyCurrency !== undefined) {
        task.penaltyCurrency = penaltyCurrency;
      }
    }

    // Calculate if task was completed on time (only if not marked as not applicable)
    let shouldGetPenalty = false;
    let shouldGetReward = false;

    if (approve && task.status === "completed" && !isNotApplicable) {
      // Check if deadline has passed
      if (taskAny.deadlineDate) {
        const deadlineDate = new Date(taskAny.deadlineDate);
        // Combine deadline date with deadline time if available
        if (taskAny.deadlineTime) {
          const [hours, minutes] = taskAny.deadlineTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
          deadlineDate.setHours(23, 59, 59, 999); // End of day if no time specified
        }

        // Check if task was completed after deadline
        const completedAt = taskAny.tickedAt || taskAny.completedAt || now;
        if (completedAt > deadlineDate) {
          shouldGetPenalty = true;
        } else {
          // Completed on time - check if there are bonus points
          if (taskAny.bonusPoints && taskAny.bonusPoints > 0) {
            shouldGetReward = true;
          }
        }
      } else if (taskAny.dueDate) {
        // Use due date as fallback if no deadline
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
      } else {
        // No deadline or due date - check if there are bonus points
        if (taskAny.bonusPoints && taskAny.bonusPoints > 0) {
          shouldGetReward = true;
        }
      }

      // Also check if task was not completed by deadline (even if not completed yet)
      if (taskAny.deadlineDate) {
        const deadlineDate = new Date(taskAny.deadlineDate);
        if (taskAny.deadlineTime) {
          const [hours, minutes] = taskAny.deadlineTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
          deadlineDate.setHours(23, 59, 59, 999);
        }

        if (now > deadlineDate && task.status !== "completed" && !isNotApplicable) {
          // Deadline passed and task not completed (only if not marked as NA)
          shouldGetPenalty = true;
        }
      }
    }

    // If task is marked as not applicable, don't award any bonus/penalty
    if (isNotApplicable) {
      shouldGetPenalty = false;
      shouldGetReward = false;
    }

    // Update approval status
    if (approve) {
      task.approvalStatus = "approved";
      task.approvedBy = new ObjectId(session.user.id);
      task.approvedAt = new Date();
    } else {
      task.approvalStatus = "rejected";
      task.approvedBy = new ObjectId(session.user.id);
      task.approvedAt = new Date();
    }

    await task.save();

    // Manually populate user references
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");

    let populatedApprovedBy = null;
    if (taskAny.approvedBy) {
      try {
        const user = await usersCollection.findOne(
          { _id: taskAny.approvedBy instanceof ObjectId ? taskAny.approvedBy : new ObjectId(taskAny.approvedBy) },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          populatedApprovedBy = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        }
      } catch (e) {
        // Ignore errors
      }
    }

    return NextResponse.json({
      success: true,
      task: {
        ...task.toObject(),
        _id: task._id.toString(),
        projectId: task.projectId.toString(),
        approvedBy: populatedApprovedBy,
        shouldGetPenalty,
        shouldGetReward,
      },
    });
  } catch (error) {
    console.error("Error approving task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

