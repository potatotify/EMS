import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import SubtaskCompletion from "@/models/SubtaskCompletion";
import { ObjectId } from "mongodb";

// PATCH - Update a subtask (toggle completion)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { ticked, timeSpent } = body;

    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");

    // First, get the subtask to check assignment
    const subtask = await db.collection("subtasks").findOne({ _id: new ObjectId(id) });
    
    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    // Check if user is the assignee or admin
    const userId = new ObjectId(session.user.id);
    const isAssignee = subtask.assignee && subtask.assignee.toString() === userId.toString();
    const isAdmin = session.user.role === "admin";

    // Only assignee or admin can toggle the subtask
    if (!isAssignee && !isAdmin) {
      return NextResponse.json({ 
        error: "You can only tick subtasks assigned to you" 
      }, { status: 403 });
    }

    // Get parent task to inherit deadline and bonus/fine - ensure we get all bonus/fine fields
    const parentTask = await db.collection("tasks").findOne(
      { _id: subtask.taskId },
      { projection: {
        title: 1,
        taskKind: 1,
        projectId: 1,
        projectName: 1,
        section: 1,
        bonusPoints: 1,
        bonusCurrency: 1,
        penaltyPoints: 1,
        penaltyCurrency: 1,
        deadlineDate: 1,
        deadlineTime: 1,
        assignedDate: 1,
        assignedTime: 1,
        dueDate: 1,
        dueTime: 1
      } }
    );
    
    // Calculate deadline for subtask - ALWAYS inherit from parent task (subtasks always use parent's deadline)
    const now = new Date();
    let deadlineDate: Date | null = null;
    let deadlinePassed = false;
    
    if (ticked && parentTask) {
      const parentTaskAny = parentTask as any;
      
      // ALWAYS use parent task's deadline (subtasks inherit deadline from parent)
      const deadlineTime = parentTaskAny.deadlineTime;
      
      if (deadlineTime) {
        if (parentTaskAny.deadlineDate) {
          deadlineDate = new Date(parentTaskAny.deadlineDate);
          deadlineDate.setHours(0, 0, 0, 0);
        } else if (parentTaskAny.assignedDate) {
          deadlineDate = new Date(parentTaskAny.assignedDate);
          deadlineDate.setHours(0, 0, 0, 0);
        } else {
          deadlineDate = new Date(now);
          deadlineDate.setHours(0, 0, 0, 0);
        }
        const [hours, minutes] = deadlineTime.split(":");
        deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        deadlinePassed = now > deadlineDate;
      } else if (parentTaskAny.deadlineDate) {
        deadlineDate = new Date(parentTaskAny.deadlineDate);
        if (parentTaskAny.deadlineTime) {
          const [hours, minutes] = parentTaskAny.deadlineTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
          deadlineDate.setHours(23, 59, 59, 999);
        }
        deadlinePassed = now > deadlineDate;
      }
    }
    
    // Update the subtask with automatic approval status
    const updateData: any = {
      ticked: ticked,
      tickedAt: ticked ? new Date() : null,
      completedBy: ticked ? new ObjectId(session.user.id) : null,
      status: ticked ? "completed" : "pending",
      completedAt: ticked ? new Date() : null,
    };
    
    // Add timeSpent if provided
    if (ticked && timeSpent !== undefined) {
      updateData.timeSpent = timeSpent;
    } else if (!ticked) {
      // Clear timeSpent when unticking
      updateData.timeSpent = null;
    }
    
    // Automatically set approval status based on deadline
    if (ticked) {
      if (deadlinePassed) {
        updateData.approvalStatus = "deadline_passed";
        updateData.approvedAt = now;
      } else {
        updateData.approvalStatus = "approved";
        updateData.approvedAt = now;
      }
    } else {
      updateData.approvalStatus = "pending";
      updateData.approvedAt = null;
    }
    
    const result = await db.collection("subtasks").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    // If subtask is being ticked, create SubtaskCompletion record with parent task's bonus/fine
    if (ticked && result) {
      try {
        // Get parent task to inherit bonus/fine - ensure we get all bonus/fine fields
        const parentTask = await db.collection("tasks").findOne(
          { _id: result.taskId },
          { projection: {
            title: 1,
            taskKind: 1,
            projectId: 1,
            projectName: 1,
            section: 1,
            bonusPoints: 1,
            bonusCurrency: 1,
            penaltyPoints: 1,
            penaltyCurrency: 1,
            deadlineDate: 1,
            deadlineTime: 1,
            assignedDate: 1,
            assignedTime: 1,
            dueDate: 1,
            dueTime: 1
          } }
        );
        
        if (parentTask) {
          const usersCollection = db.collection("users");
          
          // Get completedBy name
          let completedByName = "Unknown";
          if (result.completedBy) {
            const user = await usersCollection.findOne(
              { _id: result.completedBy instanceof ObjectId ? result.completedBy : new ObjectId(result.completedBy) },
              { projection: { name: 1 } }
            );
            if (user) {
              completedByName = user.name || "Unknown";
            }
          }
          
          // Get assignee names
          let assigneeNames: string[] = [];
          if (result.assignees && Array.isArray(result.assignees)) {
            assigneeNames = await Promise.all(
              result.assignees.map(async (assigneeId: any) => {
                try {
                  const user = await usersCollection.findOne(
                    { _id: assigneeId instanceof ObjectId ? assigneeId : new ObjectId(assigneeId) },
                    { projection: { name: 1 } }
                  );
                  return user?.name || "Unknown";
                } catch (e) {
                  return "Unknown";
                }
              })
            );
          } else if (result.assignee) {
            const user = await usersCollection.findOne(
              { _id: result.assignee instanceof ObjectId ? result.assignee : new ObjectId(result.assignee) },
              { projection: { name: 1 } }
            );
            if (user) {
              assigneeNames = [user.name || "Unknown"];
            }
          }
          
          // Inherit bonus/fine from parent task (subtasks always inherit from parent)
          const parentTaskAny = parentTask as any;
          const subtaskAny = result as any;
          
          // Create SubtaskCompletion record
          await SubtaskCompletion.create({
            subtaskId: result._id,
            taskId: result.taskId,
            subtaskTitle: result.title,
            parentTaskTitle: parentTask.title,
            taskKind: parentTask.taskKind || "one-time",
            projectId: parentTask.projectId,
            projectName: parentTask.projectName,
            section: parentTask.section || "No Section",
            assignees: result.assignees || (result.assignee ? [result.assignee] : []),
            assigneeNames: assigneeNames,
            completedBy: result.completedBy,
            completedByName: completedByName,
            tickedAt: result.tickedAt || new Date(),
            completedAt: result.completedAt || new Date(),
            timeSpent: result.timeSpent !== undefined ? result.timeSpent : undefined,
            // Inherit bonus/fine from parent task
            bonusPoints: parentTaskAny.bonusPoints !== undefined && parentTaskAny.bonusPoints !== null ? parentTaskAny.bonusPoints : 0,
            bonusCurrency: parentTaskAny.bonusCurrency !== undefined && parentTaskAny.bonusCurrency !== null ? parentTaskAny.bonusCurrency : 0,
            penaltyPoints: parentTaskAny.penaltyPoints !== undefined && parentTaskAny.penaltyPoints !== null ? parentTaskAny.penaltyPoints : 0,
            penaltyCurrency: parentTaskAny.penaltyCurrency !== undefined && parentTaskAny.penaltyCurrency !== null ? parentTaskAny.penaltyCurrency : 0,
            approvalStatus: deadlinePassed ? "deadline_passed" : "approved",
            approvedAt: now,
            // ALWAYS inherit deadline from parent task (subtasks always use parent's deadline)
            deadlineDate: parentTaskAny.deadlineDate || undefined,
            deadlineTime: parentTaskAny.deadlineTime || undefined,
            dueDate: subtaskAny.dueDate || parentTaskAny.dueDate || undefined,
            dueTime: subtaskAny.dueTime || parentTaskAny.dueTime || undefined,
            assignedDate: parentTaskAny.assignedDate || undefined,
            assignedTime: parentTaskAny.assignedTime || undefined,
          });
          console.log(`[Subtask Completion] Created SubtaskCompletion record for subtask ${result._id} with parent task bonus/fine`);
        }
      } catch (error) {
        console.error("[Subtask Completion] Error creating SubtaskCompletion record:", error);
        // Don't fail the request if SubtaskCompletion creation fails
      }
    }

    // After subtask is ticked, check if all subtasks are completed
    // If all subtasks are completed, automatically tick the parent task
    if (ticked && result && result.taskId) {
      try {
        // Get all subtasks for the parent task
        const allSubtasks = await db.collection("subtasks").find({
          taskId: result.taskId
        }).toArray();
        
        // Check if all subtasks are completed
        const allCompleted = allSubtasks.length > 0 && allSubtasks.every((st: any) => 
          st.status === "completed" || st.ticked === true
        );
        
        if (allCompleted && allSubtasks.length > 0) {
          // All subtasks are completed - automatically tick the parent task
          const parentTaskId = result.taskId;
          const parentTask = await db.collection("tasks").findOne({ _id: parentTaskId });
          
          if (parentTask && parentTask.status !== "completed") {
            const now = new Date();
            
            // Calculate deadline for parent task
            let deadlineDate: Date | null = null;
            let deadlinePassed = false;
            const parentTaskAny = parentTask as any;
            
            if (parentTaskAny.deadlineTime) {
              if (parentTaskAny.deadlineDate) {
                deadlineDate = new Date(parentTaskAny.deadlineDate);
                deadlineDate.setHours(0, 0, 0, 0);
              } else if (parentTaskAny.assignedDate) {
                deadlineDate = new Date(parentTaskAny.assignedDate);
                deadlineDate.setHours(0, 0, 0, 0);
              } else {
                deadlineDate = new Date(now);
                deadlineDate.setHours(0, 0, 0, 0);
              }
              const [hours, minutes] = parentTaskAny.deadlineTime.split(":");
              deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              deadlinePassed = now > deadlineDate;
            } else if (parentTaskAny.deadlineDate) {
              deadlineDate = new Date(parentTaskAny.deadlineDate);
              if (parentTaskAny.deadlineTime) {
                const [h, m] = parentTaskAny.deadlineTime.split(":");
                deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
              } else {
                deadlineDate.setHours(23, 59, 59, 999);
              }
              deadlinePassed = now > deadlineDate;
            }
            
            // Update parent task to completed
            const parentUpdateData: any = {
              status: "completed",
              tickedAt: now,
              completedAt: now,
              completedBy: new ObjectId(session.user.id),
            };
            
            // Automatically set approval status based on deadline
            if (deadlinePassed) {
              parentUpdateData.approvalStatus = "deadline_passed";
              parentUpdateData.approvedAt = now;
            } else {
              parentUpdateData.approvalStatus = "approved";
              parentUpdateData.approvedAt = now;
            }
            
            await db.collection("tasks").findOneAndUpdate(
              { _id: parentTaskId },
              { $set: parentUpdateData }
            );
            
            // Create TaskCompletion record for the parent task (if it's a one-time task)
            if (parentTaskAny.taskKind === "one-time") {
              try {
                const TaskCompletion = (await import("@/models/TaskCompletion")).default;
                const usersCollection = db.collection("users");
                
                // Get completedBy name
                let completedByName = "Unknown";
                if (session.user.id) {
                  const user = await usersCollection.findOne(
                    { _id: new ObjectId(session.user.id) },
                    { projection: { name: 1 } }
                  );
                  if (user) {
                    completedByName = user.name || "Unknown";
                  }
                }
                
                // Get assignee names
                let assigneeNames: string[] = [];
                if (parentTaskAny.assignees && Array.isArray(parentTaskAny.assignees)) {
                  assigneeNames = await Promise.all(
                    parentTaskAny.assignees.map(async (assigneeId: any) => {
                      try {
                        const user = await usersCollection.findOne(
                          { _id: assigneeId instanceof ObjectId ? assigneeId : new ObjectId(assigneeId) },
                          { projection: { name: 1 } }
                        );
                        return user?.name || "Unknown";
                      } catch (e) {
                        return "Unknown";
                      }
                    })
                  );
                } else if (parentTaskAny.assignedTo) {
                  const user = await usersCollection.findOne(
                    { _id: parentTaskAny.assignedTo instanceof ObjectId ? parentTaskAny.assignedTo : new ObjectId(parentTaskAny.assignedTo) },
                    { projection: { name: 1 } }
                  );
                  if (user) {
                    assigneeNames = [user.name || "Unknown"];
                  }
                }
                
                // Create TaskCompletion record
                await TaskCompletion.create({
                  taskId: parentTaskId,
                  taskTitle: parentTaskAny.title,
                  taskKind: parentTaskAny.taskKind || "one-time",
                  projectId: parentTaskAny.projectId,
                  projectName: parentTaskAny.projectName,
                  section: parentTaskAny.section || "No Section",
                  assignees: parentTaskAny.assignees || (parentTaskAny.assignedTo ? [parentTaskAny.assignedTo] : []),
                  assigneeNames: assigneeNames,
                  assignedTo: parentTaskAny.assignedTo || undefined,
                  completedBy: new ObjectId(session.user.id),
                  completedByName: completedByName,
                  tickedAt: now,
                  completedAt: now,
                  bonusPoints: parentTaskAny.bonusPoints !== undefined && parentTaskAny.bonusPoints !== null ? parentTaskAny.bonusPoints : 0,
                  bonusCurrency: parentTaskAny.bonusCurrency !== undefined && parentTaskAny.bonusCurrency !== null ? parentTaskAny.bonusCurrency : 0,
                  penaltyPoints: parentTaskAny.penaltyPoints !== undefined && parentTaskAny.penaltyPoints !== null ? parentTaskAny.penaltyPoints : 0,
                  penaltyCurrency: parentTaskAny.penaltyCurrency !== undefined && parentTaskAny.penaltyCurrency !== null ? parentTaskAny.penaltyCurrency : 0,
                  approvalStatus: deadlinePassed ? "deadline_passed" : "approved",
                  approvedAt: now,
                  deadlineDate: parentTaskAny.deadlineDate || undefined,
                  deadlineTime: parentTaskAny.deadlineTime || undefined,
                  dueDate: parentTaskAny.dueDate || undefined,
                  dueTime: parentTaskAny.dueTime || undefined,
                  assignedDate: parentTaskAny.assignedDate || undefined,
                  assignedTime: parentTaskAny.assignedTime || undefined,
                });
                
                console.log(`[Auto-Complete Task] Created TaskCompletion record for parent task ${parentTaskId} after all subtasks completed`);
              } catch (error) {
                console.error("[Auto-Complete Task] Error creating TaskCompletion record:", error);
                // Don't fail the request if TaskCompletion creation fails
              }
            }
            
            console.log(`[Auto-Complete Task] Parent task ${parentTaskId} automatically completed after all ${allSubtasks.length} subtasks were completed`);
          }
        }
      } catch (error) {
        console.error("[Auto-Complete Task] Error checking/updating parent task:", error);
        // Don't fail the request if auto-completion check fails
      }
    }

    return NextResponse.json({
      success: true,
      subtask: {
        ...result,
        _id: result._id.toString(),
      },
    });
  } catch (error) {
    console.error("Error updating subtask:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
