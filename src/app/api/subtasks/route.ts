import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Subtask from "@/models/Subtask";
import Task from "@/models/Task";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";

// GET - Get all subtasks for a task
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    await dbConnect();

    const subtasks = await Subtask.find({ taskId })
      .populate("assignee", "name email")
      .populate("completedBy", "name email")
      .populate("createdBy", "name email")
      .sort({ order: 1 });

    return NextResponse.json({ subtasks }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching subtasks:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new subtask
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const body = await req.json();
    const {
      taskId,
      projectId,
      title,
      description,
      assignee, // Single employee ID
      dueDate,
      dueTime,
      priority,
    } = body;

    // Validate required fields
    if (!taskId || !projectId || !title || !assignee) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get assignee name
    const assigneeUser = await User.findById(assignee).select("name");
    const assigneeName = assigneeUser?.name || "Unknown";

    // Get the highest order for this task
    const lastSubtask = await Subtask.findOne({ taskId }).sort({ order: -1 });
    const order = lastSubtask ? lastSubtask.order + 1 : 0;

    // Get task values (handle both Mongoose document and plain object)
    const taskAny = task as any;
    const taskBonusPoints = taskAny.bonusPoints;
    const taskBonusCurrency = taskAny.bonusCurrency;
    const taskPenaltyPoints = taskAny.penaltyPoints;
    const taskPenaltyCurrency = taskAny.penaltyCurrency;
    
    console.log(`[Subtask Creation] Inheriting from task ${taskId}:`, {
      bonusPoints: taskBonusPoints,
      bonusCurrency: taskBonusCurrency,
      penaltyPoints: taskPenaltyPoints,
      penaltyCurrency: taskPenaltyCurrency,
      deadlineDate: taskAny.deadlineDate,
      deadlineTime: taskAny.deadlineTime,
    });

    // Create the subtask with inherited recurrence, bonus/fine, and deadline from parent task
    const subtask = new Subtask({
      taskId,
      projectId,
      title,
      description,
      assignee,
      assigneeName,
      dueDate,
      dueTime,
      priority: priority || 2,
      status: "pending",
      order,
      createdBy: session.user.id,
      // Inherit recurrence settings from parent task
      taskKind: taskAny.taskKind || "one-time",
      recurringPattern: taskAny.recurringPattern ? {
        frequency: taskAny.recurringPattern.frequency,
        interval: taskAny.recurringPattern.interval,
        endDate: taskAny.recurringPattern.endDate,
        daysOfWeek: taskAny.recurringPattern.daysOfWeek,
        dayOfMonth: taskAny.recurringPattern.dayOfMonth,
      } : undefined,
      customRecurrence: taskAny.customRecurrence ? {
        type: taskAny.customRecurrence.type,
        daysOfWeek: taskAny.customRecurrence.daysOfWeek,
        daysOfMonth: taskAny.customRecurrence.daysOfMonth,
        recurring: taskAny.customRecurrence.recurring,
      } : undefined,
      // Inherit bonus/fine from parent task (ensure we use actual values, not undefined)
      bonusPoints: typeof taskBonusPoints === "number" ? taskBonusPoints : undefined,
      bonusCurrency: typeof taskBonusCurrency === "number" ? taskBonusCurrency : undefined,
      penaltyPoints: typeof taskPenaltyPoints === "number" ? taskPenaltyPoints : undefined,
      penaltyCurrency: typeof taskPenaltyCurrency === "number" ? taskPenaltyCurrency : undefined,
      // Inherit deadline from parent task
      deadlineDate: taskAny.deadlineDate,
      deadlineTime: taskAny.deadlineTime,
      // Inherit approval status and notApplicable flag
      approvalStatus: taskAny.approvalStatus || "pending",
      notApplicable: taskAny.notApplicable || false,
    });
    
    console.log(`[Subtask Creation] Created subtask with values:`, {
      bonusPoints: subtask.bonusPoints,
      bonusCurrency: subtask.bonusCurrency,
      penaltyPoints: subtask.penaltyPoints,
      penaltyCurrency: subtask.penaltyCurrency,
    });

    await subtask.save();

    // Populate the response
    await subtask.populate("assignee", "name email");
    await subtask.populate("createdBy", "name email");

    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating subtask:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update a subtask
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const body = await req.json();
    const {
      subtaskId,
      title,
      description,
      assignee,
      dueDate,
      dueTime,
      priority,
      status,
    } = body;

    if (!subtaskId) {
      return NextResponse.json({ error: "Subtask ID is required" }, { status: 400 });
    }

    const subtask = await Subtask.findById(subtaskId);
    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    // If subtask is missing bonus/fine values, inherit from parent task
    const subtaskAny = subtask as any;
    const needsInheritance = 
      (subtaskAny.bonusPoints === undefined || subtaskAny.bonusPoints === null) ||
      (subtaskAny.bonusCurrency === undefined || subtaskAny.bonusCurrency === null) ||
      (subtaskAny.penaltyPoints === undefined || subtaskAny.penaltyPoints === null) ||
      (subtaskAny.penaltyCurrency === undefined || subtaskAny.penaltyCurrency === null) ||
      !subtaskAny.deadlineDate || !subtaskAny.deadlineTime;
    
    if (needsInheritance) {
      const parentTask = await Task.findById(subtask.taskId);
      if (parentTask) {
        const parentTaskAny = parentTask as any;
        
        // Inherit bonus/fine if missing
        if (subtaskAny.bonusPoints === undefined || subtaskAny.bonusPoints === null) {
          subtask.bonusPoints = typeof parentTaskAny.bonusPoints === "number" ? parentTaskAny.bonusPoints : undefined;
        }
        if (subtaskAny.bonusCurrency === undefined || subtaskAny.bonusCurrency === null) {
          subtask.bonusCurrency = typeof parentTaskAny.bonusCurrency === "number" ? parentTaskAny.bonusCurrency : undefined;
        }
        if (subtaskAny.penaltyPoints === undefined || subtaskAny.penaltyPoints === null) {
          subtask.penaltyPoints = typeof parentTaskAny.penaltyPoints === "number" ? parentTaskAny.penaltyPoints : undefined;
        }
        if (subtaskAny.penaltyCurrency === undefined || subtaskAny.penaltyCurrency === null) {
          subtask.penaltyCurrency = typeof parentTaskAny.penaltyCurrency === "number" ? parentTaskAny.penaltyCurrency : undefined;
        }
        
        // Inherit deadline if missing
        if (!subtaskAny.deadlineDate && parentTaskAny.deadlineDate) {
          subtask.deadlineDate = parentTaskAny.deadlineDate;
        }
        if (!subtaskAny.deadlineTime && parentTaskAny.deadlineTime) {
          subtask.deadlineTime = parentTaskAny.deadlineTime;
        }
        
        // Inherit approval status if missing
        if (!subtaskAny.approvalStatus && parentTaskAny.approvalStatus) {
          subtask.approvalStatus = parentTaskAny.approvalStatus;
        }
        
        console.log(`[Subtask Update] Inherited values from parent task for subtask ${subtaskId}`);
      }
    }

    // Update fields
    if (title) subtask.title = title;
    if (description !== undefined) subtask.description = description;
    if (dueDate !== undefined) subtask.dueDate = dueDate;
    if (dueTime !== undefined) subtask.dueTime = dueTime;
    if (priority) subtask.priority = priority;
    if (status) {
      subtask.status = status;
      if (status === "completed") {
        subtask.completedAt = new Date();
        subtask.completedBy = new mongoose.Types.ObjectId(session.user.id);
        subtask.tickedAt = new Date();
        subtask.ticked = true; // Also set ticked flag
      }
    }

    if (assignee) {
      const assigneeUser = await User.findById(assignee).select("name");
      subtask.assignee = new mongoose.Types.ObjectId(assignee);
      subtask.assigneeName = assigneeUser?.name || "Unknown";
    }

    await subtask.save();

    // Populate the response
    await subtask.populate("assignee", "name email");
    await subtask.populate("completedBy", "name email");
    await subtask.populate("createdBy", "name email");

    return NextResponse.json({ subtask }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating subtask:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a subtask
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const subtaskId = searchParams.get("subtaskId");

    if (!subtaskId) {
      return NextResponse.json({ error: "Subtask ID is required" }, { status: 400 });
    }

    const subtask = await Subtask.findByIdAndDelete(subtaskId);
    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Subtask deleted successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting subtask:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
