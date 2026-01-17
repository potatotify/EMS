import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import Subtask from "@/models/Subtask";
import User from "@/models/User";
import TaskCompletion from "@/models/TaskCompletion";
import SubtaskCompletion from "@/models/SubtaskCompletion";
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

    // First try to find as regular task, then try TaskCompletion, then Subtask, then SubtaskCompletion if not found
    let task = null;
    let subtask = null;
    let taskCompletion: any = null;
    let taskCompletionDoc: any = null;
    let subtaskCompletion: any = null;
    let subtaskCompletionDoc: any = null;
    
    try {
      task = await Task.findById(taskId);
    } catch (e) {
      // Invalid ObjectId format or other error - try TaskCompletion or Subtask
      console.log(`[Approve] Task.findById failed for ${taskId}, trying TaskCompletion or Subtask`);
    }
    
    // If task not found, try Subtask
    if (!task) {
      try {
        subtask = await Subtask.findById(taskId);
        if (subtask) {
          console.log(`[Approve] Found Subtask: ${subtask._id}`);
        }
      } catch (e) {
        console.log(`[Approve] Subtask.findById failed for ${taskId}`);
      }
    }
    
    // If task and subtask not found, try SubtaskCompletion first, then TaskCompletion
    if (!task && !subtask) {
      console.log(`[Approve] Regular task and subtask not found, searching for SubtaskCompletion with ID: ${taskId}`);
      
      // Try SubtaskCompletion
      try {
        subtaskCompletion = await SubtaskCompletion.findById(taskId);
        if (subtaskCompletion) {
          subtaskCompletionDoc = subtaskCompletion.toObject();
          console.log(`[Approve] Found SubtaskCompletion via Mongoose.findById: ${subtaskCompletion._id}`);
        }
      } catch (e) {
        console.log(`[Approve] SubtaskCompletion.findById failed for ${taskId}:`, e);
      }
      
      // If not found via Mongoose, try raw MongoDB
      if (!subtaskCompletion && !subtaskCompletionDoc) {
        try {
          subtaskCompletionDoc = await db.collection("subtaskcompletions").findOne({
            _id: new ObjectId(taskId)
          });
          
          if (subtaskCompletionDoc) {
            console.log(`[Approve] Found SubtaskCompletion via raw MongoDB by _id: ${subtaskCompletionDoc._id}`);
            // Try to convert to Mongoose model
            try {
              subtaskCompletion = await SubtaskCompletion.findById(subtaskCompletionDoc._id);
              if (subtaskCompletion) {
                subtaskCompletionDoc = subtaskCompletion.toObject();
              }
            } catch (e2) {
              console.log(`[Approve] Could not convert SubtaskCompletion to Mongoose model, will use raw document`);
            }
          }
        } catch (e3) {
          console.log(`[Approve] Raw MongoDB query for SubtaskCompletion failed for ${taskId}:`, e3);
        }
      }
      
      // If we found a document but couldn't convert to Mongoose model, create a wrapper
      if (subtaskCompletionDoc && !subtaskCompletion) {
        subtaskCompletion = {
          ...subtaskCompletionDoc,
          toObject: () => subtaskCompletionDoc
        };
        console.log(`[Approve] Created wrapper object for SubtaskCompletion`);
      }
      
      // If SubtaskCompletion not found, try TaskCompletion
      if (!subtaskCompletion && !subtaskCompletionDoc) {
        console.log(`[Approve] SubtaskCompletion not found, searching for TaskCompletion with ID: ${taskId}`);
        
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

    // Handle SubtaskCompletion approval first (before checking for errors)
    if (subtaskCompletion || subtaskCompletionDoc) {
      const now = new Date();
      const completionData = subtaskCompletionDoc || (subtaskCompletion ? subtaskCompletion.toObject() : null);
      
      if (!completionData) {
        return NextResponse.json({ error: "SubtaskCompletion data not found" }, { status: 404 });
      }
      
      // Get parent task to inherit deadline and bonus/fine if needed
      let parentTask: any = null;
      try {
        if (completionData.taskId) {
          parentTask = await db.collection("tasks").findOne({
            _id: completionData.taskId instanceof ObjectId ? completionData.taskId : new ObjectId(completionData.taskId)
          });
        }
      } catch (e) {
        console.log(`[Approve] Error fetching parent task for SubtaskCompletion:`, e);
      }
      
      // Use parent task's deadline if subtask doesn't have one
      const deadlineDate = completionData.deadlineDate || (parentTask?.deadlineDate ? new Date(parentTask.deadlineDate) : null);
      const deadlineTime = completionData.deadlineTime || parentTask?.deadlineTime;
      
      // Calculate if subtask was completed on time
      let shouldGetPenalty = false;
      let shouldGetReward = false;
      
      if (approve) {
        if (deadlineDate) {
          const deadline = new Date(deadlineDate);
          if (deadlineTime) {
            const [hours, minutes] = deadlineTime.split(":");
            deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            deadline.setHours(23, 59, 59, 999);
          }
          
          const completedAt = completionData.tickedAt || completionData.completedAt || now;
          if (completedAt > deadline) {
            shouldGetPenalty = true;
          } else {
            // Completed on time - check for bonus
            const bonus = completionData.bonusPoints || (parentTask?.bonusPoints || 0);
            if (bonus > 0) {
              shouldGetReward = true;
            }
          }
        } else {
          // No deadline - check for bonus
          const bonus = completionData.bonusPoints || (parentTask?.bonusPoints || 0);
          if (bonus > 0) {
            shouldGetReward = true;
          }
        }
      }
      
      // Update approval status
      const updateData: any = {
        approvalStatus: approve ? "approved" : "rejected",
        approvedBy: new ObjectId(session.user.id),
        approvedAt: new Date(),
      };
      
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
      if (subtaskCompletion && typeof subtaskCompletion.save === 'function' && subtaskCompletion.constructor.name === 'model') {
        Object.assign(subtaskCompletion, updateData);
        await subtaskCompletion.save();
        subtaskCompletionDoc = subtaskCompletion.toObject();
      } else if (subtaskCompletionDoc) {
        await db.collection("subtaskcompletions").updateOne(
          { _id: subtaskCompletionDoc._id },
          { $set: updateData }
        );
        Object.assign(subtaskCompletionDoc, updateData);
        if (subtaskCompletion) {
          Object.assign(subtaskCompletion, updateData);
        }
      }
      
      // Also update the original subtask if it exists
      try {
        if (completionData.subtaskId) {
          await db.collection("subtasks").updateOne(
            { _id: completionData.subtaskId instanceof ObjectId ? completionData.subtaskId : new ObjectId(completionData.subtaskId) },
            { $set: { approvalStatus: updateData.approvalStatus } }
          );
        }
      } catch (e) {
        console.log(`[Approve] Error updating original subtask:`, e);
      }
      
      // Populate approvedBy
      const usersCollection = db.collection("users");
      let populatedApprovedBy = null;
      if (updateData.approvedBy) {
        try {
          const user = await usersCollection.findOne(
            { _id: updateData.approvedBy instanceof ObjectId ? updateData.approvedBy : new ObjectId(updateData.approvedBy) },
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
      
      const finalCompletionData = subtaskCompletionDoc || (subtaskCompletion ? subtaskCompletion.toObject() : completionData);
      
      return NextResponse.json({
        success: true,
        task: {
          ...finalCompletionData,
          _id: finalCompletionData._id.toString(),
          subtaskId: finalCompletionData.subtaskId ? (finalCompletionData.subtaskId instanceof ObjectId ? finalCompletionData.subtaskId.toString() : finalCompletionData.subtaskId.toString()) : null,
          taskId: finalCompletionData.taskId ? (finalCompletionData.taskId instanceof ObjectId ? finalCompletionData.taskId.toString() : finalCompletionData.taskId.toString()) : null,
          projectId: finalCompletionData.projectId ? (finalCompletionData.projectId instanceof ObjectId ? finalCompletionData.projectId.toString() : finalCompletionData.projectId.toString()) : null,
          approvedBy: populatedApprovedBy,
          shouldGetPenalty,
          shouldGetReward,
          isSubtaskCompletion: true,
        },
      });
    }
    
    // Handle subtask approval (before checking for errors)
    if (subtask) {
      const now = new Date();
      const subtaskAny = subtask as any;
      const isNotApplicable = subtaskAny.notApplicable === true;

      // Calculate if subtask was completed on time (only if not marked as not applicable)
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      if (approve && subtask.status === "completed" && !isNotApplicable) {
        // Check if deadline has passed
        if (subtaskAny.deadlineDate) {
          const deadlineDate = new Date(subtaskAny.deadlineDate);
          if (subtaskAny.deadlineTime) {
            const [hours, minutes] = subtaskAny.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }

          const completedAt = subtaskAny.tickedAt || subtaskAny.completedAt || now;
          if (completedAt > deadlineDate) {
            shouldGetPenalty = true;
          } else if (subtaskAny.bonusPoints && subtaskAny.bonusPoints > 0) {
            shouldGetReward = true;
          }
        } else if (subtaskAny.dueDate) {
          const dueDate = new Date(subtaskAny.dueDate);
          if (subtaskAny.dueTime) {
            const [hours, minutes] = subtaskAny.dueTime.split(":");
            dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            dueDate.setHours(23, 59, 59, 999);
          }

          const completedAt = subtaskAny.tickedAt || subtaskAny.completedAt || now;
          if (completedAt > dueDate) {
            shouldGetPenalty = true;
          } else if (subtaskAny.bonusPoints && subtaskAny.bonusPoints > 0) {
            shouldGetReward = true;
          }
        } else if (subtaskAny.bonusPoints && subtaskAny.bonusPoints > 0) {
          shouldGetReward = true;
        }

        // Also check if subtask was not completed by deadline
        if (subtaskAny.deadlineDate) {
          const deadlineDate = new Date(subtaskAny.deadlineDate);
          if (subtaskAny.deadlineTime) {
            const [hours, minutes] = subtaskAny.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }

          if (now > deadlineDate && subtask.status !== "completed" && !isNotApplicable) {
            shouldGetPenalty = true;
          }
        }
      }

      // If subtask is marked as not applicable, don't award any bonus/penalty
      if (isNotApplicable) {
        shouldGetPenalty = false;
        shouldGetReward = false;
      }

      // Update approval status
      if (approve) {
        subtask.approvalStatus = "approved";
      } else {
        subtask.approvalStatus = "rejected";
      }

      await subtask.save();

      return NextResponse.json({
        success: true,
        task: {
          ...subtask.toObject(),
          _id: subtask._id.toString(),
          taskId: subtask.taskId.toString(),
          projectId: subtask.projectId.toString(),
          shouldGetPenalty,
          shouldGetReward,
          isSubtask: true,
        },
      });
    }
    
    // If neither task, TaskCompletion, subtask, nor SubtaskCompletion found, return error
    if (!task && !taskCompletion && !subtask && !subtaskCompletion) {
      console.log(`[Approve] Neither Task, TaskCompletion, Subtask, nor SubtaskCompletion found for ID: ${taskId}`);
      return NextResponse.json({ 
        error: "Task not found. Neither regular task, TaskCompletion record, subtask, nor SubtaskCompletion found with the provided ID." 
      }, { status: 404 });
    }
    
    // If we have a TaskCompletion or SubtaskCompletion, they're already handled above, so skip regular task handling
    if (taskCompletion || subtaskCompletion) {
      // TaskCompletion/SubtaskCompletion handling is done above, so we're done
      return; // This should never be reached as TaskCompletion/SubtaskCompletion handling returns above
    }
    
    // Handle regular task approval (only if we have a regular task)
    if (!task) {
      // This shouldn't happen if we have taskCompletion or subtask, but just in case
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

