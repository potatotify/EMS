import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import { ObjectId } from "mongodb";

// PATCH - Update task (employee can only update status for assigned tasks)
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

    // Check if user has permission (assigned employee)
    const taskAny = task as any;
    if (taskAny.assignedTo) {
      const assignedToId = taskAny.assignedTo instanceof ObjectId 
        ? taskAny.assignedTo.toString() 
        : taskAny.assignedTo.toString();
      
      if (assignedToId !== session.user.id) {
        return NextResponse.json({ error: "You can only update tasks assigned to you" }, { status: 403 });
      }
    } else {
      // Unassigned tasks - allow employees to update them
      // This allows employees to work on unassigned tasks
    }

    // Employees can only update status and custom field values
    if (body.status !== undefined) {
      const wasCompleted = task.status === "completed";
      task.status = body.status;
      
      // Handle completion
      if (body.status === "completed") {
        // Always update tickedAt when task is marked as completed
        // This ensures we capture the latest tick time even if task was previously completed
        const tickedTime = new Date();
        task.tickedAt = tickedTime;
        task.markModified("tickedAt"); // Explicitly mark as modified to ensure save
        
        // Reset approval status when employee ticks task (needs re-approval)
        task.approvalStatus = "pending";
        task.approvedBy = undefined;
        task.approvedAt = undefined;
        
        if (!wasCompleted) {
          // Only update completedAt and completedBy if transitioning from incomplete to complete
          task.completedAt = new Date();
          task.completedBy = new ObjectId(session.user.id);
        }
        // If already completed, we still update tickedAt above to reflect latest tick time
      } else if (body.status !== "completed" && wasCompleted) {
        task.completedAt = undefined;
        task.completedBy = undefined;
        task.tickedAt = undefined; // Clear ticked time if unchecked
        task.markModified("tickedAt"); // Mark as modified when clearing
        // Clear custom field values when task is unchecked
        task.customFieldValues = undefined;
      }
    }

    // Handle custom field values (only when completing task)
    if (body.customFieldValues !== undefined && body.status === "completed") {
      const taskAny = task as any;
      // Validate that custom fields exist and values match types
      if (taskAny.customFields && Array.isArray(taskAny.customFields) && taskAny.customFields.length > 0) {
        const validatedValues: Record<string, any> = {};
        
        for (const field of taskAny.customFields) {
          const value = body.customFieldValues[field.name];
          if (value !== undefined && value !== null && value !== "") {
            // Type validation and conversion
            switch (field.type) {
              case "number":
                validatedValues[field.name] = Number(value);
                break;
              case "boolean":
                validatedValues[field.name] = Boolean(value);
                break;
              case "date":
                validatedValues[field.name] = new Date(value);
                break;
              case "string":
              default:
                validatedValues[field.name] = String(value);
                break;
            }
          }
        }
        
        task.customFieldValues = Object.keys(validatedValues).length > 0 ? validatedValues : undefined;
      }
    }

    // Ensure tickedAt is saved properly
    const savedTask = await task.save();
    
    // Log for debugging
    console.log(`[Task Update] Task ${taskId} - Status: ${savedTask.status}, TickedAt: ${savedTask.tickedAt}, CompletedAt: ${savedTask.completedAt}`);

    // Manually populate user references
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");

    let populatedAssignedTo = null;
    let populatedCreatedBy = null;
    let populatedCompletedBy = null;

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
        ...task.toObject(),
        _id: task._id.toString(),
        projectId: task.projectId.toString(),
        assignedTo: populatedAssignedTo,
        createdBy: populatedCreatedBy,
        completedBy: populatedCompletedBy,
      },
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
