import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User"; // Import User model to register schema
import { ObjectId } from "mongodb";

// GET - Get single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { taskId } = await params;

    await dbConnect();

    const task = await Task.findById(taskId).lean();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Manually populate user references
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");

    let populatedAssignedTo = null;
    let populatedCreatedBy = null;
    let populatedCompletedBy = null;

    // Type assertion for task
    const taskAny = task as any;

    // Populate assignedTo
    if (taskAny.assignedTo) {
      try {
        const user = await usersCollection.findOne(
          { _id: taskAny.assignedTo instanceof ObjectId ? taskAny.assignedTo : new ObjectId(taskAny.assignedTo) },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          populatedAssignedTo = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Populate createdBy
    if (taskAny.createdBy) {
      try {
        const user = await usersCollection.findOne(
          { _id: taskAny.createdBy instanceof ObjectId ? taskAny.createdBy : new ObjectId(taskAny.createdBy) },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          populatedCreatedBy = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Populate completedBy
    if (taskAny.completedBy) {
      try {
        const user = await usersCollection.findOne(
          { _id: taskAny.completedBy instanceof ObjectId ? taskAny.completedBy : new ObjectId(taskAny.completedBy) },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          populatedCompletedBy = {
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
        ...taskAny,
        _id: taskAny._id.toString(),
        projectId: taskAny.projectId.toString(),
        assignedTo: populatedAssignedTo,
        createdBy: populatedCreatedBy,
        completedBy: populatedCompletedBy,
      },
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { taskId } = await params;
    const body = await request.json();

    await dbConnect();

    const task = await Task.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if user has permission (admin or assigned employee)
    if (session.user.role !== "admin" && task.assignedTo?.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update fields
    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.section !== undefined) task.section = body.section || "No Section";
    if (body.taskKind !== undefined) task.taskKind = body.taskKind;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.bonusPoints !== undefined) task.bonusPoints = body.bonusPoints;
    if (body.penaltyPoints !== undefined) task.penaltyPoints = body.penaltyPoints;
    if (body.status !== undefined) task.status = body.status;
    if (body.order !== undefined) task.order = body.order;

    // Date fields
    if (body.assignedDate !== undefined) {
      task.assignedDate = body.assignedDate ? new Date(body.assignedDate) : undefined;
    }
    if (body.assignedTime !== undefined) task.assignedTime = body.assignedTime;
    if (body.dueDate !== undefined) {
      task.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    }
    if (body.dueTime !== undefined) task.dueTime = body.dueTime;
    if (body.deadlineDate !== undefined) {
      task.deadlineDate = body.deadlineDate ? new Date(body.deadlineDate) : undefined;
    }
    if (body.deadlineTime !== undefined) task.deadlineTime = body.deadlineTime;

    // Assignment (only single employee allowed)
    const client = await clientPromise;
    const db = client.db("worknest");

    if (body.assignees !== undefined) {
      const assignees = Array.isArray(body.assignees)
        ? body.assignees.filter(Boolean)
        : [];

      if (assignees.length > 0) {
        // Only take the first assignee if multiple are provided
        const assignedId = new ObjectId(assignees[0]);
        const employee = await db
          .collection("users")
          .findOne({ _id: assignedId }, { projection: { name: 1, email: 1 } });

        if (employee) {
          task.assignees = [assignedId]; // Only single assignee
          task.assigneeNames = [employee.name || ""].filter(Boolean);
          task.assignedTo = assignedId;
          task.assignedToName = task.assigneeNames[0] || null;
        }
      } else {
        task.assignees = undefined;
        task.assigneeNames = undefined;
        task.assignedTo = undefined;
        task.assignedToName = undefined;
      }
    } else if (body.assignedTo !== undefined) {
      // Fallback: single assignedTo update
      if (body.assignedTo) {
        const assignedId = new ObjectId(body.assignedTo);
        task.assignedTo = assignedId;
        const employee = await db
          .collection("users")
          .findOne({ _id: assignedId }, { projection: { name: 1 } });
        task.assignedToName = employee?.name || null;
        // Keep assignees in sync (single)
        task.assignees = [assignedId];
        task.assigneeNames = task.assignedToName ? [task.assignedToName] : undefined;
      } else {
        task.assignedTo = undefined;
        task.assignedToName = undefined;
        task.assignees = undefined;
        task.assigneeNames = undefined;
      }
    }

    // Recurring pattern
    if (body.recurringPattern !== undefined) {
      task.recurringPattern = body.recurringPattern || undefined;
    }

    // Custom fields
    if (body.customFields !== undefined) {
      if (Array.isArray(body.customFields) && body.customFields.length > 0) {
        // Only include valid fields with name and type, preserve defaultValue
        const validFields = body.customFields
          .filter((f: any) => f && f.name && f.name.trim() !== "" && f.type)
          .map((f: any) => ({
            name: String(f.name).trim(),
            type: f.type,
            defaultValue: f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== "" 
              ? f.defaultValue 
              : undefined,
          }));
        
        task.customFields = validFields.length > 0 ? validFields : undefined;
        console.log("Updating task customFields:", task.customFields);
      } else {
        task.customFields = undefined;
      }
    }

    // Handle completion
    const wasCompleted = task.status === "completed";
    if (body.status === "completed" && !wasCompleted) {
      task.completedAt = new Date();
      task.completedBy = new ObjectId(session.user.id);
      task.tickedAt = new Date(); // Record when task is ticked
      // Reset approval when task is completed again
      task.approvalStatus = "pending";
      task.approvedBy = undefined;
      task.approvedAt = undefined;
    } else if (body.status !== "completed" && wasCompleted) {
      // Admin unchecked the task - clear all employee completion data
      task.completedAt = undefined;
      task.completedBy = undefined;
      task.tickedAt = undefined;
      task.approvalStatus = "pending";
      task.approvedBy = undefined;
      task.approvedAt = undefined;
      task.markModified("tickedAt");
      task.markModified("completedBy");
      task.markModified("completedAt");
    }

    // Explicitly mark customFields as modified to ensure it's saved
    if (body.customFields !== undefined) {
      task.markModified("customFields");
    }
    
    await task.save();
    
    console.log("Task saved. CustomFields:", task.customFields);
    
    // Reload the task to ensure we have the latest data including customFields
    const updatedTask = await Task.findById(taskId).lean();
    
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Manually populate user references (reuse existing client/db)
    const usersCollection = db.collection("users");

    let populatedAssignedTo = null;
    let populatedCreatedBy = null;
    let populatedCompletedBy = null;

    // Type assertion for updatedTask
    const updatedTaskAny = updatedTask as any;

    // Populate assignedTo
    if (updatedTaskAny.assignedTo) {
      try {
        const user = await usersCollection.findOne(
          { _id: updatedTaskAny.assignedTo instanceof ObjectId ? updatedTaskAny.assignedTo : new ObjectId(updatedTaskAny.assignedTo) },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          populatedAssignedTo = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Populate createdBy
    if (updatedTaskAny.createdBy) {
      try {
        const user = await usersCollection.findOne(
          { _id: updatedTaskAny.createdBy instanceof ObjectId ? updatedTaskAny.createdBy : new ObjectId(updatedTaskAny.createdBy) },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          populatedCreatedBy = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Populate completedBy
    if (updatedTaskAny.completedBy) {
      try {
        const user = await usersCollection.findOne(
          { _id: updatedTaskAny.completedBy instanceof ObjectId ? updatedTaskAny.completedBy : new ObjectId(updatedTaskAny.completedBy) },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          populatedCompletedBy = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Use updatedTask (reloaded from DB) to ensure customFields are included
    return NextResponse.json({
      success: true,
      task: {
        ...updatedTaskAny,
        _id: updatedTaskAny._id.toString(),
        projectId: updatedTaskAny.projectId.toString(),
        assignedTo: populatedAssignedTo,
        createdBy: populatedCreatedBy,
        completedBy: populatedCompletedBy,
        customFields: updatedTaskAny.customFields || [],
        customFieldValues: updatedTaskAny.customFieldValues || {},
      },
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { taskId } = await params;

    await dbConnect();

    const task = await Task.findByIdAndDelete(taskId);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

