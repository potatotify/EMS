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

    // Create the subtask with inherited recurrence from parent task
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
      taskKind: task.taskKind || "one-time",
      recurringPattern: task.recurringPattern ? {
        frequency: task.recurringPattern.frequency,
        interval: task.recurringPattern.interval,
        endDate: task.recurringPattern.endDate,
        daysOfWeek: task.recurringPattern.daysOfWeek,
        dayOfMonth: task.recurringPattern.dayOfMonth,
      } : undefined,
      customRecurrence: task.customRecurrence ? {
        type: task.customRecurrence.type,
        daysOfWeek: task.customRecurrence.daysOfWeek,
        daysOfMonth: task.customRecurrence.daysOfMonth,
        recurring: task.customRecurrence.recurring,
      } : undefined,
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
