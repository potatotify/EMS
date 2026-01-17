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
    
    let body;
    try {
      body = await request.json();
      console.log("Received update request for task:", taskId);
      console.log("Request body:", JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json({ 
        error: "Invalid request body",
        message: parseError instanceof Error ? parseError.message : "Failed to parse JSON"
      }, { status: 400 });
    }

    await dbConnect();

    let task = await Task.findById(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get the project to check lead assignee
    const client = await clientPromise;
    const db = client.db("worknest");
    const project = await db.collection("projects").findOne({
      _id: task.projectId instanceof ObjectId ? task.projectId : new ObjectId(task.projectId)
    });

    // Check if user has permission
    const userId = session.user.id;
    const isAdmin = session.user.role === "admin";
    const isAssignedEmployee = task.assignedTo?.toString() === userId;
    const isTaskCreator = task.createdBy?.toString() === userId;
    
    // Check if current user is a lead assignee of the project
    let isUserLeadAssignee = false;
    if (project) {
      const userIdObj = new ObjectId(userId);
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

    // Check if task creator is admin
    let isCreatorAdmin = false;
    if (task.createdBy) {
      try {
        const creatorUser = await db.collection("users").findOne({
          _id: task.createdBy instanceof ObjectId ? task.createdBy : new ObjectId(task.createdBy)
        });
        isCreatorAdmin = creatorUser?.role === "admin";
      } catch (e) {
        console.error("Error checking creator role:", e);
      }
    }

    // Check if user is trying to update bonus/fine fields
    const isUpdatingBonusFine = body.bonusPoints !== undefined || 
                                body.bonusCurrency !== undefined ||
                                body.penaltyPoints !== undefined ||
                                body.penaltyCurrency !== undefined;

    // Permission logic:
    // 1. Admin can always edit everything
    // 2. Lead assignees can edit ANY task in their project (including admin-created ones) EXCEPT bonus/fine fields
    // 3. Employees can edit tasks they created themselves
    // 4. Otherwise, assigned employees can edit (for backward compatibility)
    let hasPermission = false;
    if (isAdmin) {
      hasPermission = true;
    } else if (isUserLeadAssignee) {
      // Lead assignee - can edit any task in their project (including admin-created ones)
      // BUT cannot edit bonus/fine fields (those are admin-only)
      if (isUpdatingBonusFine) {
        hasPermission = false; // Block bonus/fine updates for lead assignees
      } else {
        hasPermission = true; // Allow all other edits
      }
    } else if (isTaskCreator) {
      // User created the task - allow editing
      hasPermission = true;
    } else {
      // Regular assigned employee - allow editing (backward compatibility)
      hasPermission = isAssignedEmployee;
    }

    if (!hasPermission) {
      // Provide specific error message for lead assignees trying to edit bonus/fine
      if (isUserLeadAssignee && isUpdatingBonusFine) {
        return NextResponse.json({ 
          error: "You cannot edit bonus or fine fields. Only admin can modify bonus points, bonus currency, penalty points, and penalty currency.",
          message: "Bonus and fine fields are admin-only."
        }, { status: 403 });
      }
      
      return NextResponse.json({ 
        error: "Forbidden",
        message: "You don't have permission to edit this task."
      }, { status: 403 });
    }

    // Extra safety check: Block lead assignees from updating bonus/fine fields
    if (isUpdatingBonusFine && !isAdmin && isUserLeadAssignee) {
      return NextResponse.json({ 
        error: "You cannot edit bonus or fine fields. Only admin can modify bonus points, bonus currency, penalty points, and penalty currency.",
        message: "Bonus and fine fields are admin-only."
      }, { status: 403 });
    }

    // Update fields
    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.section !== undefined) task.section = body.section || "No Section";
    if (body.taskKind !== undefined) task.taskKind = body.taskKind;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.bonusPoints !== undefined) task.bonusPoints = body.bonusPoints;
    if (body.bonusCurrency !== undefined) task.bonusCurrency = body.bonusCurrency;
    if (body.penaltyPoints !== undefined) task.penaltyPoints = body.penaltyPoints;
    if (body.penaltyCurrency !== undefined) task.penaltyCurrency = body.penaltyCurrency;
    if (body.status !== undefined) task.status = body.status;
    if (body.order !== undefined) task.order = body.order;

    // Date fields - handle empty strings explicitly
    if (body.assignedDate !== undefined) {
      task.assignedDate = body.assignedDate && body.assignedDate.trim() !== "" 
        ? new Date(body.assignedDate) 
        : undefined;
    }
    if (body.assignedTime !== undefined) {
      task.assignedTime = body.assignedTime && body.assignedTime.trim() !== "" 
        ? body.assignedTime 
        : undefined;
    }
    if (body.dueDate !== undefined) {
      task.dueDate = body.dueDate && body.dueDate.trim() !== "" 
        ? new Date(body.dueDate) 
        : undefined;
    }
    if (body.dueTime !== undefined) {
      task.dueTime = body.dueTime && body.dueTime.trim() !== "" 
        ? body.dueTime 
        : undefined;
    }
    if (body.deadlineDate !== undefined) {
      task.deadlineDate = body.deadlineDate && body.deadlineDate.trim() !== "" 
        ? new Date(body.deadlineDate) 
        : undefined;
    }
    if (body.deadlineTime !== undefined) {
      task.deadlineTime = body.deadlineTime && body.deadlineTime.trim() !== "" 
        ? body.deadlineTime 
        : undefined;
    }

    // Assignment (only single employee allowed)
    // Note: client and db are already defined above

    // Helper function to safely create ObjectId
    const safeObjectId = (value: any): ObjectId | null => {
      if (!value) return null;
      if (value instanceof ObjectId) return value;
      if (typeof value === 'string' && value.trim() === '') return null;
      try {
        // Check if it's a valid 24-character hex string
        if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
          return new ObjectId(value);
        }
        return null;
      } catch (e) {
        console.error("Invalid ObjectId value:", value, e);
        return null;
      }
    };

    if (body.assignees !== undefined) {
      const assignees = Array.isArray(body.assignees)
        ? body.assignees.filter(Boolean)
        : [];

      if (assignees.length > 0) {
        // Only take the first assignee if multiple are provided
        const assignedId = safeObjectId(assignees[0]);
        if (assignedId) {
          const employee = await db
            .collection("users")
            .findOne({ _id: assignedId }, { projection: { name: 1, email: 1 } });

          if (employee) {
            task.assignees = [assignedId]; // Only single assignee
            task.assigneeNames = [employee.name || ""].filter(Boolean);
            task.assignedTo = assignedId;
            task.assignedToName = task.assigneeNames[0] || null;
          } else {
            console.warn("Employee not found for assignedId:", assignedId);
            task.assignees = undefined;
            task.assigneeNames = undefined;
            task.assignedTo = undefined;
            task.assignedToName = undefined;
          }
        } else {
          console.warn("Invalid assignee ID:", assignees[0]);
          task.assignees = undefined;
          task.assigneeNames = undefined;
          task.assignedTo = undefined;
          task.assignedToName = undefined;
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
        const assignedId = safeObjectId(body.assignedTo);
        if (assignedId) {
          task.assignedTo = assignedId;
          const employee = await db
            .collection("users")
            .findOne({ _id: assignedId }, { projection: { name: 1 } });
          task.assignedToName = employee?.name || null;
          // Keep assignees in sync (single)
          task.assignees = [assignedId];
          task.assigneeNames = task.assignedToName ? [task.assignedToName] : undefined;
        } else {
          console.warn("Invalid assignedTo ID:", body.assignedTo);
          task.assignedTo = undefined;
          task.assignedToName = undefined;
          task.assignees = undefined;
          task.assigneeNames = undefined;
        }
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
    
    // Custom recurrence
    if (body.taskKind !== undefined && body.taskKind !== "custom") {
      // Clear customRecurrence if taskKind is not custom
      task.customRecurrence = undefined;
      task.markModified("customRecurrence");
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
    
    // Mark other potentially modified fields
    if (body.assignees !== undefined || body.assignedTo !== undefined) {
      task.markModified("assignees");
      task.markModified("assigneeNames");
      task.markModified("assignedTo");
      task.markModified("assignedToName");
    }
    
    // Validate before saving
    try {
      await task.validate();
    } catch (validationError: any) {
      console.error("Validation error:", validationError);
      const validationMessages = validationError.errors 
        ? Object.values(validationError.errors).map((e: any) => e.message).join(", ")
        : validationError.message || "Validation failed";
      return NextResponse.json({ 
        error: "Validation failed",
        message: validationMessages,
        details: validationError.errors ? Object.keys(validationError.errors) : undefined
      }, { status: 400 });
    }
    
    // Save task with retry logic for version conflicts
    let saveAttempts = 0;
    const maxRetries = 3;
    let saveSuccess = false;
    let lastError: any = null;
    
    while (saveAttempts < maxRetries && !saveSuccess) {
      try {
        await task.save();
        saveSuccess = true;
      } catch (saveError: any) {
        lastError = saveError;
        saveAttempts++;
        
        // Check if it's a version conflict error
        if (saveError.name === 'VersionError' || saveError.message?.includes('No matching document found')) {
          console.warn(`Version conflict detected (attempt ${saveAttempts}/${maxRetries}), retrying...`);
          
          if (saveAttempts < maxRetries) {
            // Reload the task to get the latest version
            const freshTask = await Task.findById(taskId);
            if (!freshTask) {
              return NextResponse.json({ error: "Task not found" }, { status: 404 });
            }
            
            // Reapply all the changes to the fresh task
            // Copy all modified fields from the old task to the fresh task
            if (body.title !== undefined) freshTask.title = task.title;
            if (body.description !== undefined) freshTask.description = task.description;
            if (body.section !== undefined) freshTask.section = task.section;
            if (body.taskKind !== undefined) freshTask.taskKind = task.taskKind;
            if (body.priority !== undefined) freshTask.priority = task.priority;
            if (body.bonusPoints !== undefined) freshTask.bonusPoints = task.bonusPoints;
            if (body.bonusCurrency !== undefined) freshTask.bonusCurrency = task.bonusCurrency;
            if (body.penaltyPoints !== undefined) freshTask.penaltyPoints = task.penaltyPoints;
            if (body.penaltyCurrency !== undefined) freshTask.penaltyCurrency = task.penaltyCurrency;
            if (body.status !== undefined) freshTask.status = task.status;
            if (body.order !== undefined) freshTask.order = task.order;
            
            // Date fields
            if (body.assignedDate !== undefined) freshTask.assignedDate = task.assignedDate;
            if (body.assignedTime !== undefined) freshTask.assignedTime = task.assignedTime;
            if (body.dueDate !== undefined) freshTask.dueDate = task.dueDate;
            if (body.dueTime !== undefined) freshTask.dueTime = task.dueTime;
            if (body.deadlineDate !== undefined) freshTask.deadlineDate = task.deadlineDate;
            if (body.deadlineTime !== undefined) freshTask.deadlineTime = task.deadlineTime;
            
            // Assignment fields
            if (body.assignees !== undefined || body.assignedTo !== undefined) {
              freshTask.assignees = task.assignees;
              freshTask.assigneeNames = task.assigneeNames;
              freshTask.assignedTo = task.assignedTo;
              freshTask.assignedToName = task.assignedToName;
            }
            
            // Recurring pattern
            if (body.recurringPattern !== undefined) {
              freshTask.recurringPattern = task.recurringPattern;
            }
            
            // Custom recurrence
            if (body.customRecurrence !== undefined || (body.taskKind !== undefined && body.taskKind !== "custom")) {
              freshTask.customRecurrence = task.customRecurrence;
              freshTask.markModified("customRecurrence");
            }
            
            // Custom fields
            if (body.customFields !== undefined) {
              freshTask.customFields = task.customFields;
              freshTask.markModified("customFields");
            }
            
            // Completion fields
            if (body.status !== undefined) {
              freshTask.completedAt = task.completedAt;
              freshTask.completedBy = task.completedBy;
              freshTask.tickedAt = task.tickedAt;
              freshTask.approvalStatus = task.approvalStatus;
              freshTask.approvedBy = task.approvedBy;
              freshTask.approvedAt = task.approvedAt;
            }
            
            // Mark modified fields
            if (body.assignees !== undefined || body.assignedTo !== undefined) {
              freshTask.markModified("assignees");
              freshTask.markModified("assigneeNames");
              freshTask.markModified("assignedTo");
              freshTask.markModified("assignedToName");
            }
            
            // Replace task with fresh task for next retry
            task = freshTask;
            
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 100 * saveAttempts));
            continue;
          }
        }
        
        // If it's not a version error or we've exhausted retries, break and return error
        break;
      }
    }
    
    // If save failed after all retries, return error
    if (!saveSuccess) {
      console.error("Error saving task after retries:", lastError);
      const errorMessage = lastError?.message || "Failed to save task";
      const errorDetails = lastError?.errors 
        ? Object.values(lastError.errors).map((e: any) => e.message).join(", ")
        : errorMessage;
      
      // For version errors, check if the task was actually saved
      if (lastError?.name === 'VersionError' || lastError?.message?.includes('No matching document found')) {
        // Check if the task was actually saved despite the error
        const verifyTask = await Task.findById(taskId);
        if (verifyTask) {
          // Task exists, check if our changes were applied
          const changesApplied = 
            (body.title === undefined || verifyTask.title === task.title) &&
            (body.status === undefined || verifyTask.status === task.status);
          
          if (changesApplied) {
            // Task was saved successfully despite version error
            console.warn("Version conflict occurred but task was saved successfully");
            // Continue with normal flow - reload task below
            saveSuccess = true;
          } else {
            return NextResponse.json({ 
              error: "Task was modified by another user",
              message: "The task was updated by another user. Please refresh and try again.",
              details: "Version conflict detected"
            }, { status: 409 }); // 409 Conflict is more appropriate for version conflicts
          }
        } else {
          return NextResponse.json({ 
            error: "Task was modified by another user",
            message: "The task was updated by another user. Please refresh and try again.",
            details: "Version conflict detected"
          }, { status: 409 });
        }
      }
      
      return NextResponse.json({ 
        error: "Failed to save task",
        message: errorDetails,
        details: lastError?.stack
      }, { status: 500 });
    }
    
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
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorDetails = error instanceof Error && (error as any).errors 
      ? Object.values((error as any).errors).map((e: any) => e.message).join(", ")
      : errorMessage;
    return NextResponse.json({ 
      error: "Failed to update task",
      message: errorDetails,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
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
    const client = await clientPromise;
    const db = client.db("worknest");

    // Delete all subtasks associated with this task
    const subtasksResult = await db.collection("subtasks").deleteMany({
      taskId: new ObjectId(taskId)
    });
    console.log(`[Task Delete] Deleted ${subtasksResult.deletedCount} subtask(s) for task ${taskId}`);

    // Delete all SubtaskCompletion records for subtasks of this task
    // First, get all subtask IDs that belong to this task
    const subtasks = await db.collection("subtasks").find({
      taskId: new ObjectId(taskId)
    }).project({ _id: 1 }).toArray();
    
    if (subtasks.length > 0) {
      const subtaskIds = subtasks.map((st: any) => st._id);
      const SubtaskCompletion = (await import("@/models/SubtaskCompletion")).default;
      const subtaskCompletionResult = await SubtaskCompletion.deleteMany({
        subtaskId: { $in: subtaskIds }
      });
      console.log(`[Task Delete] Deleted ${subtaskCompletionResult.deletedCount} SubtaskCompletion record(s) for task ${taskId}`);
    }

    // Delete the task
    const task = await Task.findByIdAndDelete(taskId);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Task deleted successfully",
      deletedSubtasks: subtasksResult.deletedCount
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

