import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import TaskCompletion from "@/models/TaskCompletion";
import { ObjectId } from "mongodb";

// GET - Fetch all tasks with full details for analysis
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();

    // Manually populate user references and project details
    const client = await clientPromise;
    const db = client.db("worknest");

    // Fetch only completed tasks (tasks that have been ticked at least once)
    const tasks = await Task.find({
      $or: [
        { tickedAt: { $exists: true, $ne: null } },
        { completedAt: { $exists: true, $ne: null } },
        { status: "completed" }
      ]
    })
      .sort({ tickedAt: -1, completedAt: -1, createdAt: -1 })
      .lean();

    // Fetch completed subtasks (where ticked is true or tickedAt exists)
    const subtasks = await db.collection("subtasks").find({
      $or: [
        { ticked: true },
        { tickedAt: { $exists: true, $ne: null } }
      ]
    })
      .sort({ tickedAt: -1, createdAt: -1 })
      .toArray();
    
    console.log(`[Task Analysis] Found ${subtasks.length} completed subtasks`);
    if (subtasks.length > 0) {
      console.log(`[Task Analysis] Sample subtask:`, {
        id: subtasks[0]._id,
        title: subtasks[0].title,
        ticked: subtasks[0].ticked,
        tickedAt: subtasks[0].tickedAt,
        assignee: subtasks[0].assignee
      });
    }
    
    const usersCollection = db.collection("users");
    const projectsCollection = db.collection("projects");
    const tasksCollection = db.collection("tasks");

    const taskRows = await Promise.all(
      tasks.map(async (task: any) => {
        // Get project name
        let projectName = task.projectName || "Unknown";
        try {
          const project = await projectsCollection.findOne(
            { _id: task.projectId instanceof ObjectId ? task.projectId : new ObjectId(task.projectId) },
            { projection: { projectName: 1 } }
          );
          if (project) {
            projectName = project.projectName || projectName;
          }
        } catch (e) {
          // Use existing projectName
        }

        // Populate assignedTo
        let assignedToName = task.assignedToName || "Unassigned";
        let assignedToId = null;
        if (task.assignedTo) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.assignedTo instanceof ObjectId ? task.assignedTo : new ObjectId(task.assignedTo) },
              { projection: { name: 1, email: 1 } }
            );
            if (user) {
              assignedToName = user.name || assignedToName;
              assignedToId = user._id.toString();
            }
          } catch (e) {
            // Keep default
          }
        }

        // Populate createdBy
        let createdByName = "Admin";
        if (task.createdBy && task.createdByEmployee) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.createdBy instanceof ObjectId ? task.createdBy : new ObjectId(task.createdBy) },
              { projection: { name: 1 } }
            );
            if (user) {
              // Check if this employee is the lead assignee of the project
              let isLeadAssignee = false;
              try {
                const project = await projectsCollection.findOne(
                  { _id: task.projectId instanceof ObjectId ? task.projectId : new ObjectId(task.projectId) },
                  { projection: { leadAssignee: 1 } }
                );
                if (project && project.leadAssignee) {
                  const leadAssigneeId = project.leadAssignee instanceof ObjectId 
                    ? project.leadAssignee.toString() 
                    : project.leadAssignee.toString();
                  const createdById = task.createdBy instanceof ObjectId 
                    ? task.createdBy.toString() 
                    : task.createdBy.toString();
                  isLeadAssignee = leadAssigneeId === createdById;
                }
              } catch (e) {
                // Couldn't determine lead assignee status
              }
              
              // Only show (Lead Assignee) tag if they are actually the lead assignee
              if (isLeadAssignee) {
                createdByName = `${user.name} (Lead Assignee)`;
              } else {
                createdByName = user.name;
              }
            }
          } catch (e) {
            // Keep default
          }
        }
        // For admin-created tasks, keep createdByName as "Admin"

        // Populate completedBy (ticked by)
        let tickedByName = null;
        if (task.completedBy) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.completedBy instanceof ObjectId ? task.completedBy : new ObjectId(task.completedBy) },
              { projection: { name: 1 } }
            );
            if (user) {
              tickedByName = user.name;
            }
          } catch (e) {
            // Keep null
          }
        }

        // Populate approvedBy
        let approvedByName = "";
        if (task.approvedBy) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.approvedBy instanceof ObjectId ? task.approvedBy : new ObjectId(task.approvedBy) },
              { projection: { name: 1 } }
            );
            if (user) {
              approvedByName = user.name;
            }
          } catch (e) {
            // Keep empty
          }
        }

        // Format dates and times
        const formatDate = (date: Date | string | undefined) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
        };

        const formatTime = (date: Date | string | undefined) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
        };

        // Check if deadline has passed and auto-reject if needed
        const now = new Date();
        let deadlinePassed = false;
        let deadlineDate: Date | null = null;
        
        // For recurring tasks (daily/weekly/monthly), use today's date if deadlineTime exists
        const isRecurring = ["daily", "weekly", "monthly"].includes(task.taskKind);
        
        if (task.deadlineTime) {
          // For recurring tasks, deadlineDate should be today's date
          if (isRecurring) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            deadlineDate = task.deadlineDate ? new Date(task.deadlineDate) : today;
            deadlineDate.setHours(0, 0, 0, 0);
          } else {
            deadlineDate = task.deadlineDate ? new Date(task.deadlineDate) : new Date();
            deadlineDate.setHours(0, 0, 0, 0);
          }
          
          // Parse deadline time
          const [hours, minutes] = task.deadlineTime.split(":");
          deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          deadlinePassed = now > deadlineDate;
        } else if (task.deadlineDate) {
          deadlineDate = new Date(task.deadlineDate);
          deadlineDate.setHours(23, 59, 59, 999);
          deadlinePassed = now > deadlineDate;
        } else if (task.dueDate) {
          deadlineDate = new Date(task.dueDate);
          if (task.dueTime) {
            const [hours, minutes] = task.dueTime.split(":");
            deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
          deadlinePassed = now > deadlineDate;
        }

        // Auto-reject if deadline passed and not already approved/rejected
        let approvalStatus = task.approvalStatus || "pending";
        if (deadlinePassed && (!approvalStatus || approvalStatus === "pending")) {
          // Auto-reject tasks with passed deadlines
          if (task.status !== "completed" || (task.tickedAt && new Date(task.tickedAt) > deadlineDate!)) {
            approvalStatus = "deadline_passed";
            // Update in database if not already set
            if (!task.approvalStatus) {
              try {
                await Task.updateOne(
                  { _id: task._id },
                  { 
                    $set: { 
                      approvalStatus: "deadline_passed",
                      approvedAt: now 
                    } 
                  }
                );
              } catch (e) {
                console.error("Error auto-rejecting task:", e);
              }
            }
          }
        }

        // Calculate what employee got (reward or penalty)
        let employeeGot = "";
        
        if (approvalStatus === "approved") {
          // Only show reward/penalty after approval
          const now = new Date();
          let shouldGetPenalty = false;
          let shouldGetReward = false;

          if (task.status === "completed") {
            // Check if deadline has passed
            if (task.deadlineDate) {
              const deadlineDate = new Date(task.deadlineDate);
              if (task.deadlineTime) {
                const [hours, minutes] = task.deadlineTime.split(":");
                deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              } else {
                deadlineDate.setHours(23, 59, 59, 999);
              }

              const completedAt = task.tickedAt || task.completedAt || now;
              if (completedAt > deadlineDate) {
                shouldGetPenalty = true;
              } else if (task.bonusPoints && task.bonusPoints > 0) {
                shouldGetReward = true;
              }
            } else if (task.dueDate) {
              const dueDate = new Date(task.dueDate);
              if (task.dueTime) {
                const [hours, minutes] = task.dueTime.split(":");
                dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              } else {
                dueDate.setHours(23, 59, 59, 999);
              }

              const completedAt = task.tickedAt || task.completedAt || now;
              if (completedAt > dueDate) {
                shouldGetPenalty = true;
              } else if (task.bonusPoints && task.bonusPoints > 0) {
                shouldGetReward = true;
              }
            } else if (task.bonusPoints && task.bonusPoints > 0) {
              shouldGetReward = true;
            }
          } else {
            // Task not completed - check if deadline passed
            if (task.deadlineDate) {
              const deadlineDate = new Date(task.deadlineDate);
              if (task.deadlineTime) {
                const [hours, minutes] = task.deadlineTime.split(":");
                deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              } else {
                deadlineDate.setHours(23, 59, 59, 999);
              }

              if (now > deadlineDate) {
                shouldGetPenalty = true;
              }
            } else if (task.dueDate) {
              const dueDate = new Date(task.dueDate);
              if (task.dueTime) {
                const [hours, minutes] = task.dueTime.split(":");
                dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              } else {
                dueDate.setHours(23, 59, 59, 999);
              }

              if (now > dueDate) {
                shouldGetPenalty = true;
              }
            }
          }

          if (shouldGetPenalty && task.penaltyPoints && task.penaltyPoints > 0) {
            employeeGot = `-${task.penaltyPoints} Penalty`;
          } else if (shouldGetReward) {
            employeeGot = `+${task.bonusPoints} Reward`;
          } else if (task.status === "completed") {
            employeeGot = "0 Points";
          } else {
            employeeGot = "Not Completed";
          }
        } else if (approvalStatus === "rejected" || approvalStatus === "deadline_passed") {
          // If admin rejects or deadline passed, employee should get penalty (if configured), otherwise 0
          if (task.penaltyPoints && task.penaltyPoints > 0) {
            employeeGot = `-${task.penaltyPoints} Penalty`;
          } else {
            employeeGot = "0 Points";
          }
        } else {
          // Not approved yet - keep empty
          employeeGot = "";
        }

        // Check if project exists
        let projectExists = true;
        let projectDeleted = false;
        try {
          const projectCheck = await projectsCollection.findOne(
            { _id: task.projectId instanceof ObjectId ? task.projectId : new ObjectId(task.projectId) }
          );
          projectExists = !!projectCheck;
          projectDeleted = !projectCheck;
          if (projectDeleted) {
            projectName = `${projectName} (Project Deleted)`;
          }
        } catch (e) {
          projectDeleted = true;
          projectName = `${projectName} (Project Deleted)`;
        }

        // Get ticked/completed date for sorting
        const tickedAtDate = task.tickedAt || task.completedAt || task.createdAt;
        
        return {
          _id: task._id.toString(),
          entryType: "task",
          projectName,
          personAssignedTo: assignedToName,
          taskAssignedBy: createdByName,
          taskName: task.title,
          taskKind: task.taskKind || "one-time",
          sectionName: task.section || "No Section",
          assignedAtDate: task.assignedDate ? formatDate(task.assignedDate) : (task.createdAt ? formatDate(task.createdAt) : ""),
          assignedAtTime: task.assignedTime || (task.assignedDate ? formatTime(task.assignedDate) : (task.createdAt ? formatTime(task.createdAt) : "")),
          dateDue: task.dueDate ? formatDate(task.dueDate) : "",
          timeDue: task.dueTime || (task.dueDate ? formatTime(task.dueDate) : ""),
          deadlineDate: task.deadlineDate ? formatDate(task.deadlineDate) : "",
          deadlineTime: task.deadlineTime || (task.deadlineDate ? formatTime(task.deadlineDate) : ""),
          priority: task.priority || 2,
          tickedBy: tickedByName || "",
          tickedTime: (() => {
            // Use tickedAt if available, otherwise fallback to completedAt
            const tickTime = task.tickedAt || task.completedAt;
            if (tickTime) {
              return `${formatDate(tickTime)} ${formatTime(tickTime)}`;
            }
            return "";
          })(),
          // Add raw date fields for sorting
          tickedAt: tickedAtDate ? new Date(tickedAtDate).toISOString() : null,
          completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
          createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
          projectDeleted,
          projectExists,
          rewardsPoint: task.bonusPoints || 0,
          rewardsCurrency: task.bonusCurrency || 0,
          penaltyPoint: task.penaltyPoints || 0,
          penaltyCurrency: task.penaltyCurrency || 0,
          employeeGot,
          status: task.status,
          approvalStatus: approvalStatus,
          approvedBy: approvedByName,
          deadlinePassed: deadlinePassed,
          customFields: task.customFields || [],
          customFieldValues: task.customFieldValues || {},
          createdByEmployee: task.createdByEmployee || false,
        };
      })
    );

    // Process subtasks into analysis rows
    const subtaskRows = await Promise.all(
      subtasks.map(async (subtask: any) => {
        // Get parent task info
        let parentTask: any = null;
        let projectName = 'Unknown Project';
        let section = 'No Section';
        try {
          parentTask = await tasksCollection.findOne({ _id: subtask.taskId });
          if (parentTask) {
            const project = await projectsCollection.findOne(
              { _id: parentTask.projectId instanceof ObjectId ? parentTask.projectId : new ObjectId(parentTask.projectId) },
              { projection: { projectName: 1 } }
            );
            if (project) {
              projectName = project.projectName || 'Unknown Project';
            }
            section = parentTask.section || 'No Section';
          }
        } catch (e) {
          console.error('Error fetching parent task for subtask:', e);
        }

        // Populate assignee (subtasks have a single assignee)
        let assigneeName = 'Unassigned';
        if (subtask.assignee) {
          try {
            const user = await usersCollection.findOne(
              { _id: subtask.assignee instanceof ObjectId ? subtask.assignee : new ObjectId(subtask.assignee) },
              { projection: { name: 1 } }
            );
            if (user) {
              assigneeName = user.name;
            }
          } catch (e) {
            assigneeName = 'Unknown';
          }
        }

        // Populate completedBy
        let tickedByName = null;
        if (subtask.completedBy) {
          try {
            const user = await usersCollection.findOne(
              { _id: subtask.completedBy instanceof ObjectId ? subtask.completedBy : new ObjectId(subtask.completedBy) },
              { projection: { name: 1 } }
            );
            if (user) {
              tickedByName = user.name;
            }
          } catch (e) {
            // Keep null
          }
        }

        // Format dates and times
        const formatDate = (date: Date | string | undefined) => {
          if (!date) return '';
          const d = typeof date === 'string' ? new Date(date) : date;
          return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        };

        const formatTime = (date: Date | string | undefined) => {
          if (!date) return '';
          const d = typeof date === 'string' ? new Date(date) : date;
          return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        };

        return {
          _id: subtask._id.toString(),
          entryType: 'subtask',
          projectName,
          personAssignedTo: assigneeName,
          taskAssignedBy: 'Admin/Lead', // Subtasks are assigned by admin or lead assignee
          taskName: `${subtask.title} [Subtask of: ${parentTask?.title || 'Unknown Task'}]`,
          taskKind: parentTask?.taskKind || 'one-time',
          sectionName: section,
          assignedAtDate: subtask.createdAt ? formatDate(subtask.createdAt) : '',
          assignedAtTime: subtask.createdAt ? formatTime(subtask.createdAt) : '',
          dateDue: parentTask?.dueDate ? formatDate(parentTask.dueDate) : '',
          timeDue: parentTask?.dueTime || '',
          deadlineDate: parentTask?.deadlineDate ? formatDate(parentTask.deadlineDate) : '',
          deadlineTime: parentTask?.deadlineTime || '',
          priority: parentTask?.priority || 2,
          tickedBy: tickedByName || '',
          tickedTime: (() => {
            const tickTime = subtask.tickedAt || subtask.completedAt;
            if (tickTime) {
              return `${formatDate(tickTime)} ${formatTime(tickTime)}`;
            }
            return '';
          })(),
          // Add raw date fields for sorting
          tickedAt: subtask.tickedAt ? new Date(subtask.tickedAt).toISOString() : (subtask.completedAt ? new Date(subtask.completedAt).toISOString() : null),
          completedAt: subtask.completedAt ? new Date(subtask.completedAt).toISOString() : null,
          createdAt: subtask.createdAt ? new Date(subtask.createdAt).toISOString() : null,
          rewardsPoint: 0, // Subtasks don't have individual rewards
          rewardsCurrency: 0,
          penaltyPoint: 0,
          penaltyCurrency: 0,
          employeeGot: '', // No points for subtasks
          status: subtask.status || 'pending',
          approvalStatus: parentTask?.approvalStatus || 'pending',
          approvedBy: '',
          deadlinePassed: false,
          customFields: [],
          customFieldValues: {},
          createdByEmployee: false,
          parentTaskId: parentTask?._id.toString() || '',
          parentTaskTitle: parentTask?.title || 'Unknown Task',
          isSubtask: true,
        };
      })
    );

    // Fetch hackathon submissions and integrate as separate rows
    const hackathonParticipants = await db
      .collection("hackathonparticipants")
      .find({
        status: { $in: ["submitted", "winner", "runner_up"] },
      })
      .toArray();

    const hackathonIds = Array.from(
      new Set(hackathonParticipants.map((p: any) => p.hackathonId?.toString()).filter(Boolean))
    ).map((id) => new ObjectId(id));

    const hackathonsMap = new Map<string, any>();
    if (hackathonIds.length > 0) {
      const hackathons = await db
        .collection("hackathons")
        .find({ _id: { $in: hackathonIds } })
        .toArray();
      hackathons.forEach((h) => {
        hackathonsMap.set(h._id.toString(), h);
      });
    }

    const hackathonRows = await Promise.all(
      hackathonParticipants.map(async (p: any) => {
        const user = await usersCollection.findOne(
          { _id: p.userId },
          { projection: { name: 1, email: 1 } }
        );
        const hackathon = hackathonsMap.get(p.hackathonId.toString());

        const formatDate = (date: Date | string | undefined | null) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
        };

        const formatTime = (date: Date | string | undefined | null) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          return d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        };

        const submittedAt = p.submission?.submittedAt || p.createdAt;
        const endDate = hackathon?.endDate || null;
        const startDate = hackathon?.startDate || hackathon?.registrationDeadline || p.createdAt || null;

        let employeeGot = "";
        if (p.status === "winner") {
          employeeGot = "Hackathon Winner";
        } else if (p.status === "runner_up") {
          employeeGot = "Hackathon Runner Up";
        } else if (p.status === "submitted") {
          employeeGot = "Submitted";
        }

        return {
          _id: p._id.toString(),
          entryType: "hackathon",
          projectName: hackathon?.name || "Hackathon",
          personAssignedTo: user?.name || "Unknown",
          taskAssignedBy: "Hackathon",
          taskName: p.submission?.projectName || "Hackathon Submission",
          taskKind: "hackathon",
          sectionName: "Hackathon",
          assignedAtDate: startDate ? formatDate(startDate) : "",
          assignedAtTime: startDate ? formatTime(startDate) : "",
          dateDue: endDate ? formatDate(endDate) : "",
          timeDue: endDate ? formatTime(endDate) : "",
          deadlineDate: endDate ? formatDate(endDate) : "",
          deadlineTime: endDate ? formatTime(endDate) : "",
          priority: 2,
          tickedBy: user?.name || "",
          tickedTime: submittedAt ? `${formatDate(submittedAt)} ${formatTime(submittedAt)}` : "",
          // Use hackathon prize pool as reward points
          rewardsPoint: hackathon?.prizePool || 0,
          // No fine points for hackathon entries
          penaltyPoint: null,
          employeeGot,
          status: p.status,
          approvalStatus: "hackathon",
          approvedBy: "",
          deadlinePassed: endDate ? new Date(endDate) < new Date() : false,
        };
      })
    );

    // Fetch historical task completions (for recurring tasks that were reset)
    const taskCompletions = await TaskCompletion.find({})
      .sort({ tickedAt: -1 })
      .lean();

    // Fetch historical subtask completions  
    const SubtaskCompletion = (await import("@/models/SubtaskCompletion")).default;
    const subtaskCompletions = await SubtaskCompletion.find({})
      .sort({ tickedAt: -1 })
      .lean();

    const completionRows = await Promise.all(
      taskCompletions.map(async (completion: any) => {
        const formatDate = (date: Date | string | undefined | null) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
        };

        const formatTime = (date: Date | string | undefined | null) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          return d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        };

        // Calculate what employee got
        let employeeGot = "";
        if (completion.approvalStatus === "approved") {
          if (completion.actualPoints !== undefined) {
            if (completion.actualPoints > 0) {
              employeeGot = `+${completion.actualPoints} Points`;
            } else if (completion.actualPoints < 0) {
              employeeGot = `${completion.actualPoints} Points`;
            }
          } else if (completion.bonusPoints && completion.bonusPoints > 0) {
            employeeGot = `+${completion.bonusPoints} Points`;
          } else if (completion.penaltyPoints && completion.penaltyPoints > 0) {
            employeeGot = `-${completion.penaltyPoints} Points`;
          }
        }

        // Check if project exists
        let projectExists = true;
        let projectDeleted = false;
        let projectNameDisplay = completion.projectName || "Unknown";
        try {
          const projectCheck = await projectsCollection.findOne(
            { _id: completion.projectId instanceof ObjectId ? completion.projectId : new ObjectId(completion.projectId) }
          );
          projectExists = !!projectCheck;
          projectDeleted = !projectCheck;
          if (projectDeleted) {
            projectNameDisplay = `${completion.projectName} (Project Deleted)`;
          }
        } catch (e) {
          projectDeleted = true;
          projectNameDisplay = `${completion.projectName} (Project Deleted)`;
        }

        // Get assigned date/time - prefer stored assignedDate/assignedTime, then try original task, then tickedAt
        let assignedAtDate = "";
        let assignedAtTime = "";
        
        // First check if assignedDate/assignedTime are stored in completion record
        if (completion.assignedDate) {
          assignedAtDate = formatDate(completion.assignedDate);
          assignedAtTime = completion.assignedTime || formatTime(completion.assignedDate);
        } else {
          // Try to get original task's assignedDate/assignedTime if task still exists
          try {
            if (completion.taskId) {
              const originalTask = await tasksCollection.findOne(
                { _id: completion.taskId instanceof ObjectId ? completion.taskId : new ObjectId(completion.taskId) },
                { projection: { assignedDate: 1, assignedTime: 1, createdAt: 1 } }
              );
              if (originalTask) {
                // Use original task's assignedDate/assignedTime if available
                if (originalTask.assignedDate) {
                  assignedAtDate = formatDate(originalTask.assignedDate);
                  assignedAtTime = originalTask.assignedTime || formatTime(originalTask.assignedDate);
                } else if (originalTask.createdAt) {
                  assignedAtDate = formatDate(originalTask.createdAt);
                  assignedAtTime = formatTime(originalTask.createdAt);
                }
              }
            }
          } catch (e) {
            // Ignore errors
          }
          
          // If we couldn't get original task date, use tickedAt (when employee actually worked on it)
          if (!assignedAtDate && completion.tickedAt) {
            assignedAtDate = formatDate(completion.tickedAt);
            assignedAtTime = formatTime(completion.tickedAt);
          } else if (!assignedAtDate && completion.createdAt) {
            // Last fallback: use completion record creation date
            assignedAtDate = formatDate(completion.createdAt);
            assignedAtTime = formatTime(completion.createdAt);
          }
        }

        return {
          _id: completion._id.toString(),
          entryType: "task_completion",
          projectName: projectNameDisplay,
          personAssignedTo: completion.assignedToName || completion.assigneeNames?.[0] || "Unknown",
          taskAssignedBy: "Admin", // Historical data, assume admin
          taskName: `${completion.taskTitle} (${completion.taskKind})`,
          taskKind: completion.taskKind,
          sectionName: completion.section || "No Section",
          assignedAtDate,
          assignedAtTime,
          dateDue: completion.dueDate ? formatDate(completion.dueDate) : "",
          timeDue: completion.dueTime || "",
          deadlineDate: completion.deadlineDate ? formatDate(completion.deadlineDate) : "",
          deadlineTime: completion.deadlineTime || "",
          priority: completion.priority || 2,
          tickedBy: completion.completedByName || "",
          tickedTime: completion.tickedAt ? `${formatDate(completion.tickedAt)} ${formatTime(completion.tickedAt)}` : "",
          // Add raw date fields for sorting
          tickedAt: completion.tickedAt ? new Date(completion.tickedAt).toISOString() : null,
          completedAt: completion.completedAt ? new Date(completion.completedAt).toISOString() : null,
          createdAt: completion.createdAt ? new Date(completion.createdAt).toISOString() : null,
          rewardsPoint: completion.bonusPoints || 0,
          rewardsCurrency: completion.bonusCurrency || 0,
          penaltyPoint: completion.penaltyPoints || 0,
          penaltyCurrency: completion.penaltyCurrency || 0,
          employeeGot,
          status: "completed", // All completions are completed
          approvalStatus: completion.approvalStatus || "pending",
          approvedBy: completion.approvedByName || "",
          deadlinePassed: false, // Historical data
          customFields: completion.customFields || [],
          customFieldValues: completion.customFieldValues || {},
          createdByEmployee: false,
          isHistorical: true, // Flag to indicate this is historical data
          isTaskCompletion: true, // Flag to indicate this is a TaskCompletion record
          projectDeleted,
          projectExists,
          taskId: completion.taskId ? completion.taskId.toString() : null, // Include original taskId if available
        };
      })
    );

    // Process subtask completion history
    const subtaskCompletionRows = await Promise.all(
      subtaskCompletions.map(async (completion: any) => {
        const formatDate = (date: Date | string | undefined | null) => {
          if (!date) return '';
          const d = typeof date === 'string' ? new Date(date) : date;
          return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
        };

        const formatTime = (date: Date | string | undefined | null) => {
          if (!date) return '';
          const d = typeof date === 'string' ? new Date(date) : date;
          return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        };

        return {
          _id: completion._id.toString(),
          entryType: 'subtask_completion',
          projectName: completion.projectName,
          personAssignedTo: completion.assigneeNames?.join(', ') || 'Unknown',
          taskAssignedBy: 'Admin/Lead',
          taskName: `${completion.subtaskTitle} [Subtask of: ${completion.parentTaskTitle}]`,
          taskKind: completion.taskKind,
          sectionName: completion.section || 'No Section',
          assignedAtDate: '',
          assignedAtTime: '',
          dateDue: '',
          timeDue: '',
          deadlineDate: '',
          deadlineTime: '',
          priority: 2,
          tickedBy: completion.completedByName || '',
          tickedTime: completion.tickedAt ? `${formatDate(completion.tickedAt)} ${formatTime(completion.tickedAt)}` : '',
          // Add raw date fields for sorting
          tickedAt: completion.tickedAt ? new Date(completion.tickedAt).toISOString() : null,
          completedAt: completion.completedAt ? new Date(completion.completedAt).toISOString() : null,
          createdAt: completion.createdAt ? new Date(completion.createdAt).toISOString() : null,
          rewardsPoint: 0,
          rewardsCurrency: 0,
          penaltyPoint: 0,
          penaltyCurrency: 0,
          employeeGot: '',
          status: 'completed',
          approvalStatus: 'completed',
          approvedBy: '',
          deadlinePassed: false,
          customFields: [],
          customFieldValues: {},
          createdByEmployee: false,
          isHistorical: true,
          isSubtask: true,
          parentTaskTitle: completion.parentTaskTitle,
        };
      })
    );

    const analysisData = [...taskRows, ...subtaskRows, ...completionRows, ...subtaskCompletionRows, ...hackathonRows];

    // Sort: pending/new approvals first, then approved ones, both sorted by date
    analysisData.sort((a: any, b: any) => {
      // Get approval status
      const aStatus = a.approvalStatus || "pending";
      const bStatus = b.approvalStatus || "pending";
      
      // Check if approved
      const aIsApproved = aStatus === "approved";
      const bIsApproved = bStatus === "approved";
      
      // Pending/new approvals come first
      if (aIsApproved !== bIsApproved) {
        return aIsApproved ? 1 : -1; // Pending (-1) comes before approved (1)
      }
      
      // Within same group, sort by date (most recent first)
      // Use tickedAt, completedAt, or createdAt (raw ISO strings) for reliable sorting
      const getDate = (item: any): Date => {
        // Prefer raw date fields (ISO strings) for accurate sorting
        if (item.tickedAt) {
          const d = new Date(item.tickedAt);
          if (!isNaN(d.getTime())) return d;
        }
        if (item.completedAt) {
          const d = new Date(item.completedAt);
          if (!isNaN(d.getTime())) return d;
        }
        if (item.createdAt) {
          const d = new Date(item.createdAt);
          if (!isNaN(d.getTime())) return d;
        }
        // Fallback: Try to parse tickedTime string (format: "MM/DD/YYYY HH:mm" or "MM/DD/YYYY")
        if (item.tickedTime && typeof item.tickedTime === 'string') {
          const parts = item.tickedTime.trim().split(' ');
          if (parts.length >= 1) {
            const datePart = parts[0].split('/');
            if (datePart.length === 3) {
              let date = new Date(
                parseInt(datePart[2]), // year
                parseInt(datePart[0]) - 1, // month (0-indexed)
                parseInt(datePart[1]) // day
              );
              // Add time if available
              if (parts.length >= 2) {
                const timePart = parts[1].split(':');
                if (timePart.length >= 2) {
                  date.setHours(parseInt(timePart[0]), parseInt(timePart[1]), 0, 0);
                }
              }
              if (!isNaN(date.getTime())) {
                return date;
              }
            }
          }
        }
        // Default to epoch if no valid date found
        return new Date(0);
      };
      
      const aDate = getDate(a);
      const bDate = getDate(b);
      
      // Sort by date descending (most recent first)
      return bDate.getTime() - aDate.getTime();
    });

    return NextResponse.json({
      success: true,
      tasks: analysisData,
    });
  } catch (error) {
    console.error("Error fetching task analysis:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

