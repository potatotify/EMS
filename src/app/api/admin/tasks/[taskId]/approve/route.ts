import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import TaskCompletion from "@/models/TaskCompletion";
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
    const { approve, bonusPoints, bonusCurrency, penaltyPoints, penaltyCurrency, isTaskCompletion } = body; // true to approve, false to reject

    console.log(`[Approve] Received request for taskId: ${taskId}, isTaskCompletion flag: ${isTaskCompletion}`);

    await dbConnect();

    const client = await clientPromise;
    const db = client.db("worknest");

    // First try to find as regular task, then try TaskCompletion if not found
    let task = null;
    let taskCompletion: any = null;
    let taskCompletionDoc: any = null;
    
    try {
      task = await Task.findById(taskId);
    } catch (e) {
      // Invalid ObjectId format or other error - try TaskCompletion
      console.log(`[Approve] Task.findById failed for ${taskId}, trying TaskCompletion`);
    }
    
    // If task not found, try TaskCompletion using multiple methods
    if (!task) {
      console.log(`[Approve] Regular task not found, searching for TaskCompletion with ID: ${taskId}`);
      
      // Method 1: Try Mongoose TaskCompletion.findById
      try {
        taskCompletion = await TaskCompletion.findById(taskId);
        if (taskCompletion) {
          taskCompletionDoc = taskCompletion.toObject();
          console.log(`[Approve] Found TaskCompletion via Mongoose.findById: ${taskCompletion._id}`);
        }
      } catch (e) {
        console.log(`[Approve] TaskCompletion.findById failed for ${taskId}:`, e);
      }
      
      // Method 2: If not found, try raw MongoDB collection query
      // MongoDB collection name is typically lowercase pluralized: "taskcompletions"
      if (!taskCompletion && !taskCompletionDoc) {
        try {
          // Try by _id first (completion record ID)
          taskCompletionDoc = await db.collection("taskcompletions").findOne({
            _id: new ObjectId(taskId)
          });
          
          if (taskCompletionDoc) {
            console.log(`[Approve] Found TaskCompletion via raw MongoDB by _id: ${taskCompletionDoc._id}`);
          }
          
          // If not found by _id, try by taskId field (original task ID)
          if (!taskCompletionDoc) {
            taskCompletionDoc = await db.collection("taskcompletions").findOne({
              taskId: new ObjectId(taskId)
            });
            
            if (taskCompletionDoc) {
              console.log(`[Approve] Found TaskCompletion via raw MongoDB by taskId: ${taskCompletionDoc._id}`);
            }
          }
          
          // If found, try to convert to Mongoose document
          if (taskCompletionDoc) {
            try {
              taskCompletion = await TaskCompletion.findById(taskCompletionDoc._id);
              if (taskCompletion) {
                // Successfully converted to Mongoose model
                taskCompletionDoc = taskCompletion.toObject();
                console.log(`[Approve] Successfully converted to Mongoose model`);
              }
            } catch (e2) {
              console.log(`[Approve] Could not convert to Mongoose model, will use raw document`);
            }
          }
        } catch (e3) {
          console.log(`[Approve] Raw MongoDB query failed for ${taskId}:`, e3);
        }
      }
      
      // If we found a document but couldn't convert to Mongoose model, create a wrapper
      if (taskCompletionDoc && !taskCompletion) {
        taskCompletion = {
          ...taskCompletionDoc,
          toObject: () => taskCompletionDoc
        };
        console.log(`[Approve] Created wrapper object for TaskCompletion`);
      }
      
      if (!taskCompletion && !taskCompletionDoc) {
        console.log(`[Approve] No TaskCompletion found for ID: ${taskId}`);
      }
    }
    
    // Check if this is a TaskCompletion record (historical task that was reset)
    if (taskCompletion) {

      const now = new Date();
      const taskCompletionAny = taskCompletion as any;
      
      // Use taskCompletionDoc if available for more reliable data access
      const completionData = taskCompletionDoc || taskCompletionAny;
      
      // Check if project still exists
      const projectsCollection = db.collection("projects");
      let projectExists = false;
      let projectDeleted = false;
      
      try {
        const projectId = completionData.projectId instanceof ObjectId 
          ? completionData.projectId 
          : new ObjectId(completionData.projectId);
        const project = await projectsCollection.findOne({ _id: projectId });
        projectExists = !!project;
        projectDeleted = !project;
      } catch (e) {
        projectDeleted = true;
      }

      // Calculate if task was completed on time
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      if (approve && !completionData.notApplicable) {
        if (completionData.deadlineDate) {
          const deadlineDate = new Date(completionData.deadlineDate);
          if (completionData.deadlineTime) {
            const [hours, minutes] = completionData.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }

          const completedAt = completionData.tickedAt || completionData.completedAt || now;
          if (completedAt > deadlineDate) {
            shouldGetPenalty = true;
          } else if (completionData.bonusPoints && completionData.bonusPoints > 0) {
            shouldGetReward = true;
          }
        } else if (completionData.dueDate) {
          const dueDate = new Date(completionData.dueDate);
          if (completionData.dueTime) {
            const [hours, minutes] = completionData.dueTime.split(":");
            dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            dueDate.setHours(23, 59, 59, 999);
          }

          const completedAt = completionData.tickedAt || completionData.completedAt || now;
          if (completedAt > dueDate) {
            shouldGetPenalty = true;
          } else if (completionData.bonusPoints && completionData.bonusPoints > 0) {
            shouldGetReward = true;
          }
        } else if (completionData.bonusPoints && completionData.bonusPoints > 0) {
          shouldGetReward = true;
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (approve) {
        updateData.approvalStatus = "approved";
        updateData.approvedBy = new ObjectId(session.user.id);
        updateData.approvedAt = new Date();
      } else {
        updateData.approvalStatus = "rejected";
        updateData.approvedBy = new ObjectId(session.user.id);
        updateData.approvedAt = new Date();
      }

      // Update bonus/penalty if provided
      if (bonusPoints !== undefined) {
        updateData.bonusPoints = bonusPoints;
      }
      if (bonusCurrency !== undefined) {
        updateData.bonusCurrency = bonusCurrency;
      }
      if (penaltyPoints !== undefined) {
        updateData.penaltyPoints = penaltyPoints;
      }
      if (penaltyCurrency !== undefined) {
        updateData.penaltyCurrency = penaltyCurrency;
      }

      // Update using Mongoose if available, otherwise use raw MongoDB
      if (taskCompletion && typeof taskCompletion.save === 'function' && taskCompletion.constructor.name === 'model') {
        // Update Mongoose document (only if it's a real Mongoose model)
        Object.assign(taskCompletion, updateData);
        await taskCompletion.save();
        // Refresh the document data
        taskCompletionDoc = taskCompletion.toObject();
      } else if (taskCompletionDoc) {
        // Update using raw MongoDB
        await db.collection("taskcompletions").updateOne(
          { _id: taskCompletionDoc._id },
          { $set: updateData }
        );
        // Update local copy
        Object.assign(taskCompletionDoc, updateData);
        // Also update taskCompletion wrapper if it exists
        if (taskCompletion) {
          Object.assign(taskCompletion, updateData);
        }
      }

      // Populate approvedBy
      const usersCollection = db.collection("users");
      let populatedApprovedBy = null;
      const approvedById = completionData.approvedBy || updateData.approvedBy;
      if (approvedById) {
        try {
          const approvedByObjId = approvedById instanceof ObjectId ? approvedById : new ObjectId(approvedById);
          const user = await usersCollection.findOne(
            { _id: approvedByObjId },
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

      // Use updated completion data
      const finalCompletionData = taskCompletionDoc || (taskCompletion ? taskCompletion.toObject() : completionData);

      return NextResponse.json({
        success: true,
        task: {
          ...finalCompletionData,
          _id: finalCompletionData._id.toString(),
          projectId: finalCompletionData.projectId.toString(),
          approvedBy: populatedApprovedBy,
          shouldGetPenalty,
          shouldGetReward,
          projectDeleted,
          isTaskCompletion: true,
        },
      });
    }

    // If neither task nor TaskCompletion found, return error
    if (!task && !taskCompletion) {
      console.log(`[Approve] Neither Task nor TaskCompletion found for ID: ${taskId}`);
      return NextResponse.json({ 
        error: "Task not found. Neither regular task nor TaskCompletion record found with the provided ID." 
      }, { status: 404 });
    }
    
    // If we have a TaskCompletion, it's already handled above, so skip regular task handling
    if (taskCompletion) {
      // TaskCompletion handling is done above, so we're done
      return; // This should never be reached as TaskCompletion handling returns above
    }
    
    // Handle regular task approval (only if we have a regular task)
    if (!task) {
      // This shouldn't happen if we have taskCompletion, but just in case
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if project exists
    // Note: client and db are already defined at the top of the function
    const projectsCollection = db.collection("projects");
    let projectExists = false;
    let projectDeleted = false;
    
    try {
      const project = await projectsCollection.findOne(
        { _id: task.projectId instanceof ObjectId ? task.projectId : new ObjectId(task.projectId) }
      );
      projectExists = !!project;
      projectDeleted = !project;
    } catch (e) {
      projectDeleted = true;
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

    // Manually populate user references (reuse existing client and db)
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
        projectDeleted,
      },
    });
  } catch (error) {
    console.error("Error approving task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

