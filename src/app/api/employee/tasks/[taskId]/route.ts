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
    
    console.log(`[Task Update] Received request for task ${taskId}, body:`, JSON.stringify(body));
    console.log(`[Task Update] Logged in user ID: ${session.user.id}, email: ${session.user.email}`);

    await dbConnect();

    const task = await Task.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if user has permission
    const taskAny = task as any;
    const userId = session.user.id;
    const userIdObj = new ObjectId(userId);
    
    // Get the project to check lead assignee
    const client = await clientPromise;
    const db = client.db("worknest");
    const project = await db.collection("projects").findOne({
      _id: taskAny.projectId instanceof ObjectId ? taskAny.projectId : new ObjectId(taskAny.projectId)
    });

    // Check if current user is a lead assignee of the project
    let isUserLeadAssignee = false;
    if (project) {
      const leadAssignee = project.leadAssignee;
      if (Array.isArray(leadAssignee)) {
        isUserLeadAssignee = leadAssignee.some((lead: any) => {
          const leadId = lead instanceof ObjectId ? lead : (lead._id ? lead._id : new ObjectId(lead));
          return leadId.equals(userIdObj);
        });
      } else if (leadAssignee) {
        const leadId = leadAssignee instanceof ObjectId ? leadAssignee : (leadAssignee._id ? leadAssignee._id : new ObjectId(leadAssignee));
        isUserLeadAssignee = leadId.equals(userIdObj);
      }
    }

    // Check if current user is admin
    const isCurrentUserAdmin = session.user.role === "admin";
    
    // Check if task creator is admin
    let isCreatorAdmin = false;
    let isUserTaskCreator = false;
    
    if (taskAny.createdBy) {
      const createdById = taskAny.createdBy instanceof ObjectId 
        ? taskAny.createdBy.toString() 
        : taskAny.createdBy.toString();
      isUserTaskCreator = createdById === userId;
      
      // Check if creator is admin
      try {
        const creatorUser = await db.collection("users").findOne({
          _id: taskAny.createdBy instanceof ObjectId ? taskAny.createdBy : new ObjectId(taskAny.createdBy)
        });
        isCreatorAdmin = creatorUser?.role === "admin";
      } catch (e) {
        console.error("Error checking creator role:", e);
      }
    }

    // Check if user is assigned to this task
    let isAssignedToTask = false;
    if (taskAny.assignedTo) {
      const assignedToId = taskAny.assignedTo instanceof ObjectId 
        ? taskAny.assignedTo.toString() 
        : taskAny.assignedTo.toString();
      isAssignedToTask = assignedToId === userId;
    }
    if (!isAssignedToTask && Array.isArray(taskAny.assignees)) {
      isAssignedToTask = taskAny.assignees.some((assignee: any) => {
        const assigneeId = assignee instanceof ObjectId ? assignee.toString() : 
                          (assignee._id ? assignee._id.toString() : assignee.toString());
        return assigneeId === userId;
      });
    }

    // Determine what fields are being updated
    const isUpdatingStatus = body.status !== undefined;
    const isUpdatingNotApplicable = body.notApplicable !== undefined;
    const isUpdatingTimeSpent = body.timeSpent !== undefined;
    const isUpdatingCustomFieldValues = body.customFieldValues !== undefined;
    const isUpdatingBonusFine = body.bonusPoints !== undefined || 
                                body.bonusCurrency !== undefined ||
                                body.penaltyPoints !== undefined ||
                                body.penaltyCurrency !== undefined;
    const isUpdatingOtherFields = body.title !== undefined || 
                                  body.description !== undefined || 
                                  body.priority !== undefined ||
                                  body.dueDate !== undefined ||
                                  body.dueTime !== undefined ||
                                  body.deadlineDate !== undefined ||
                                  body.deadlineTime !== undefined ||
                                  body.taskKind !== undefined ||
                                  body.customRecurrence !== undefined;

    // Permission logic:
    // 1. Admin can always edit tasks they created themselves (even if created as admin)
    // 2. Employees can edit tasks they created themselves
    // 3. Lead assignees can edit ANY task in their project (including admin-created ones) EXCEPT bonus/fine fields
    // 4. Assigned employees can update status, notApplicable, timeSpent, and customFieldValues
    // 5. Employees cannot edit other fields of tasks assigned to them (unless they created them)
    let hasPermission = false;
    
    if (isCurrentUserAdmin && isUserTaskCreator) {
      // Admin created the task - always allow admin to edit their own tasks
      hasPermission = true;
    } else if (isUserTaskCreator) {
      // User created the task - always allow editing
      hasPermission = true;
    } else if (isUserLeadAssignee) {
      // Lead assignee - can edit any task in their project (including admin-created ones)
      // BUT cannot edit bonus/fine fields (those are admin-only)
      if (isUpdatingBonusFine) {
        hasPermission = false; // Block bonus/fine updates for lead assignees
      } else {
        hasPermission = true; // Allow all other edits
      }
    } else if (isAssignedToTask && (isUpdatingStatus || isUpdatingNotApplicable || isUpdatingTimeSpent || isUpdatingCustomFieldValues)) {
      // Assigned employee can update status, notApplicable, timeSpent, and customFieldValues
      hasPermission = true;
    } else if (isAssignedToTask && isUpdatingOtherFields) {
      // Assigned employee cannot edit other fields unless they created the task
      hasPermission = false;
    } else {
      // Regular employee - can only edit tasks they created
      hasPermission = false;
    }

    if (!hasPermission) {
      // Provide specific error message based on what they're trying to update
      if (isUserLeadAssignee && isUpdatingBonusFine) {
        return NextResponse.json({ 
          error: "You cannot edit bonus or fine fields. Only admin can modify bonus points, bonus currency, penalty points, and penalty currency.",
          message: "Bonus and fine fields are admin-only."
        }, { status: 403 });
      }
      
      if (isAssignedToTask && isUpdatingOtherFields) {
        return NextResponse.json({ 
          error: "You can only update the status and completion details of tasks assigned to you. You cannot edit other fields unless you created the task.",
          message: "You can only update the status and completion details of tasks assigned to you."
        }, { status: 403 });
      }
      
      return NextResponse.json({ 
        error: "You can only edit tasks you created yourself. Tasks assigned to you by lead assignees cannot be edited.",
        message: "You can only edit tasks you created yourself."
      }, { status: 403 });
    }

    // Block any attempts to update bonus/fine fields (admin-only)
    // This is an extra safety check even if permission check passes
    if (isUpdatingBonusFine && !isCurrentUserAdmin) {
      return NextResponse.json({ 
        error: "You cannot edit bonus or fine fields. Only admin can modify bonus points, bonus currency, penalty points, and penalty currency.",
        message: "Bonus and fine fields are admin-only."
      }, { status: 403 });
    }

    // Employees can update task fields (title, description, priority, dates, etc.)
    // Note: bonus/fine fields are intentionally NOT included here - they're admin-only
    if (body.title !== undefined) {
      task.title = body.title;
    }
    if (body.description !== undefined) {
      task.description = body.description;
    }
    if (body.priority !== undefined) {
      task.priority = body.priority;
    }
    if (body.dueDate !== undefined) {
      task.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    }
    if (body.dueTime !== undefined) {
      task.dueTime = body.dueTime || undefined;
    }
    if (body.deadlineDate !== undefined) {
      task.deadlineDate = body.deadlineDate ? new Date(body.deadlineDate) : undefined;
    }
    if (body.deadlineTime !== undefined) {
      task.deadlineTime = body.deadlineTime || undefined;
    }
    if (body.taskKind !== undefined) {
      task.taskKind = body.taskKind;
      // Clear customRecurrence if taskKind is not custom
      if (body.taskKind !== "custom") {
        task.customRecurrence = undefined;
        task.markModified("customRecurrence");
      }
    }
    if (body.customRecurrence !== undefined) {
      const taskKind = body.taskKind !== undefined ? body.taskKind : task.taskKind;
      if (taskKind === "custom" && body.customRecurrence) {
        task.customRecurrence = {
          type: body.customRecurrence.type || "daysOfWeek",
          daysOfWeek: body.customRecurrence.daysOfWeek || [],
          daysOfMonth: body.customRecurrence.daysOfMonth || [],
          recurring: body.customRecurrence.recurring || false,
        };
        task.markModified("customRecurrence");
      } else {
        task.customRecurrence = undefined;
        task.markModified("customRecurrence");
      }
    }
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
        
        // Save time spent if provided
        if (body.timeSpent !== undefined) {
          task.timeSpent = body.timeSpent;
          task.markModified("timeSpent"); // Explicitly mark as modified to ensure save
        }
        
        // Reset approval status when employee ticks task (needs re-approval)
        task.approvalStatus = "pending";
        task.approvedBy = undefined;
        task.approvedAt = undefined;
        
        // Always update completedBy to current user (fixes issue where re-ticking doesn't update)
        task.completedBy = new ObjectId(session.user.id);
        task.markModified("completedBy");
        
        if (!wasCompleted) {
          // Only update completedAt if transitioning from incomplete to complete
          task.completedAt = new Date();
        }
        // If already completed, we still update tickedAt above to reflect latest tick time
      } else if (body.status !== "completed" && wasCompleted) {
        task.completedAt = undefined;
        task.completedBy = undefined;
        task.tickedAt = undefined; // Clear ticked time if unchecked
        task.timeSpent = undefined; // Clear time spent when unchecking
        task.markModified("tickedAt"); // Mark as modified when clearing
        task.markModified("timeSpent");
        // Clear custom field values when task is unchecked
        task.customFieldValues = undefined;
      }
    }

    // Handle notApplicable flag (independent of status)
    if (body.notApplicable !== undefined) {
      task.notApplicable = body.notApplicable === true;
      task.markModified("notApplicable");
      // Reset approval status when NA flag changes (needs re-approval)
      task.approvalStatus = "pending";
      task.approvedBy = undefined;
      task.approvedAt = undefined;
      console.log(`[Task Update] Task ${taskId} - Setting notApplicable to: ${task.notApplicable}`);
    }

    // Handle custom field values (only when completing task)
    if (body.customFieldValues !== undefined && body.status === "completed") {
      // Use existing taskAny from line 32
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
    const savedTaskAny = savedTask as any;
    console.log(`[Task Update] Task ${taskId} - Status: ${savedTask.status}, TickedAt: ${savedTask.tickedAt}, CompletedAt: ${savedTask.completedAt}, TimeSpent: ${savedTaskAny.timeSpent}, NotApplicable: ${savedTaskAny.notApplicable}`);

    // Manually populate user references
    // Note: client and db are already defined above
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

    const taskObject = task.toObject();
    const responseTask = {
      ...taskObject,
      _id: task._id.toString(),
      projectId: task.projectId.toString(),
      assignedTo: populatedAssignedTo,
      createdBy: populatedCreatedBy,
      completedBy: populatedCompletedBy,
      notApplicable: taskObject.notApplicable || false, // Ensure field is included
      timeSpent: taskObject.timeSpent, // Explicitly include timeSpent
    };
    
    return NextResponse.json({
      success: true,
      task: responseTask,
    });
  } catch (error) {
    console.error("Error updating task:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("Error details:", errorMessage);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 });
  }
}

// DELETE - Delete task (employee can only delete tasks they created)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { taskId } = await params;
    
    console.log(`[Task Delete] Received request for task ${taskId}`);
    console.log(`[Task Delete] Logged in user ID: ${session.user.id}, email: ${session.user.email}`);

    await dbConnect();

    const task = await Task.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const taskAny = task as any;
    const userId = session.user.id;
    const userIdObj = new ObjectId(userId);

    // Check if user created the task
    const createdById = taskAny.createdBy instanceof ObjectId 
      ? taskAny.createdBy.toString() 
      : taskAny.createdBy.toString();
    
    const isCreator = createdById === userId;

    // Check if user is lead assignee of the project
    let isLeadAssignee = false;
    if (taskAny.projectId) {
      const client = await clientPromise;
      const db = client.db("worknest");
      const project = await db.collection("projects").findOne({
        _id: taskAny.projectId instanceof ObjectId ? taskAny.projectId : new ObjectId(taskAny.projectId),
      });

      if (project) {
        // Check if leadAssignee is an array (multiple lead assignees)
        if (Array.isArray(project.leadAssignee)) {
          isLeadAssignee = project.leadAssignee.some((lead: any) => {
            if (!lead) return false;
            const leadId = lead instanceof ObjectId ? lead.toString() : 
                          (typeof lead === 'object' && lead._id ? lead._id.toString() : lead.toString());
            return leadId === userId;
          });
        } else if (project.leadAssignee) {
          // Single lead assignee (legacy support)
          const leadId = project.leadAssignee instanceof ObjectId 
            ? project.leadAssignee.toString() 
            : (typeof project.leadAssignee === 'object' && project.leadAssignee._id 
              ? project.leadAssignee._id.toString() 
              : project.leadAssignee.toString());
          isLeadAssignee = leadId === userId;
        }
      }
    }

    // Allow deletion if user is creator OR lead assignee
    if (!isCreator && !isLeadAssignee) {
      return NextResponse.json({ 
        error: "You can only delete tasks you created or tasks in projects where you are the lead assignee" 
      }, { status: 403 });
    }

    // Delete the task
    await Task.findByIdAndDelete(taskId);
    
    console.log(`[Task Delete] Task ${taskId} deleted successfully by user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ 
      error: "Internal server error", 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 });
  }
}
