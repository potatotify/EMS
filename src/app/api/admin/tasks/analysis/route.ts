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

    // Get pagination and filter parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    // Get filter parameters
    const projectFilter = searchParams.get("projectFilter") || "all";
    const employeeFilter = searchParams.get("employeeFilter") || "all";
    const deadlineFilter = searchParams.get("deadlineFilter") || "all";

    await dbConnect();

    // Manually populate user references and project details
    const client = await clientPromise;
    const db = client.db("worknest");

    // Fetch historical task completions first to identify which tasks have completion records
    // Include both ticked tasks AND unticked daily tasks (notTicked flag)
    // Limit initial fetch for performance
    const allTaskCompletions = await TaskCompletion.find({
      $or: [
        { tickedAt: { $exists: true, $ne: null } }, // Tasks that were ticked
        { notTicked: true, approvalStatus: "deadline_passed" } // Daily tasks that weren't ticked
      ]
    })
      .sort({ createdAt: -1 }) // Sort by creation date instead of tickedAt (which can be null)
      .limit(1000) // Increase limit to get all completions including unticked ones
      .lean();
    
    // Deduplicate: For each taskId, keep only the LATEST completion
    const taskCompletionMap = new Map<string, any>();
    for (const completion of allTaskCompletions) {
      if (!completion.taskId) continue;
      const taskId = completion.taskId.toString();
      const existing = taskCompletionMap.get(taskId);
      
      // Compare by createdAt if tickedAt is null, otherwise use tickedAt
      const completionDate = completion.tickedAt ? new Date(completion.tickedAt) : new Date(completion.createdAt);
      const existingDate = existing?.tickedAt ? new Date(existing.tickedAt) : (existing?.createdAt ? new Date(existing.createdAt) : null);
      
      if (!existing || !existingDate || completionDate > existingDate) {
        taskCompletionMap.set(taskId, completion);
      }
    }
    
    // Convert map back to array (only latest completion per task)
    const taskCompletions = Array.from(taskCompletionMap.values());
    
    // Get set of taskIds that have TaskCompletion records (for one-time tasks, we'll only show completions)
    const tasksWithCompletions = new Set(
      taskCompletions
        .filter((tc: any) => tc.taskId)
        .map((tc: any) => tc.taskId.toString())
    );

    // Fetch only completed tasks (tasks that have been ticked at least once)
    // Limit initial fetch to reduce memory usage - we'll fetch more if needed
    const tasks = await Task.find({
      $or: [
        { tickedAt: { $exists: true, $ne: null } },
        { completedAt: { $exists: true, $ne: null } },
        { status: "completed" }
      ]
    })
      .sort({ tickedAt: -1, completedAt: -1, createdAt: -1 })
      .limit(100) // Fetch max 100 tasks initially for processing
      .lean();

    // Fetch historical subtask completions (before fetching subtasks to avoid duplicates)
    const SubtaskCompletion = (await import("@/models/SubtaskCompletion")).default;
    const allSubtaskCompletions = await SubtaskCompletion.find({})
      .sort({ createdAt: -1 }) // Sort by creation date instead of tickedAt (which can be null)
      .limit(1000) // Increase limit to get all completions for deduplication
      .lean();
    
    // Deduplicate: For each subtaskId, keep only the LATEST completion
    const subtaskCompletionMap = new Map<string, any>();
    for (const completion of allSubtaskCompletions) {
      if (!completion.subtaskId) continue;
      const subtaskId = completion.subtaskId.toString();
      const existing = subtaskCompletionMap.get(subtaskId);
      
      // Compare by createdAt if tickedAt is null, otherwise use tickedAt
      const completionDate = completion.tickedAt ? new Date(completion.tickedAt) : new Date(completion.createdAt);
      const existingDate = existing?.tickedAt ? new Date(existing.tickedAt) : (existing?.createdAt ? new Date(existing.createdAt) : null);
      
      if (!existing || !existingDate || completionDate > existingDate) {
        subtaskCompletionMap.set(subtaskId, completion);
      }
    }
    
    // Convert map back to array (only latest completion per subtask)
    const subtaskCompletions = Array.from(subtaskCompletionMap.values());
    
    // Get set of subtaskIds that have SubtaskCompletion records
    const subtasksWithCompletions = new Set(
      subtaskCompletions
        .filter((sc: any) => sc.subtaskId)
        .map((sc: any) => sc.subtaskId.toString())
    );

    // Fetch completed subtasks (where ticked is true or tickedAt exists)
    // Limit initial fetch
    const subtasks = await db.collection("subtasks").find({
      $or: [
        { ticked: true },
        { tickedAt: { $exists: true, $ne: null } }
      ]
    })
      .sort({ tickedAt: -1, createdAt: -1 })
      .limit(100) // Fetch max 100 subtasks initially
      .toArray();
    
    
    const usersCollection = db.collection("users");
    const projectsCollection = db.collection("projects");
    const tasksCollection = db.collection("tasks");

    // Format dates and times - defined at top level so accessible to all processing sections
    const formatDate = (date: Date | string | undefined) => {
      if (!date) return "";
      const d = typeof date === "string" ? new Date(date) : date;
      // Convert to IST (Asia/Kolkata) timezone - UTC+5:30
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(d);
    };

    const formatTime = (date: Date | string | undefined) => {
      if (!date) return "";
      const d = typeof date === "string" ? new Date(date) : date;
      // Convert to IST (Asia/Kolkata) timezone - UTC+5:30
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return formatter.format(d);
    };

    // Calculate today's date in IST ONCE at the start of the request
    // This ensures consistency throughout the entire request processing
    // IMPORTANT: Always returns today's date in IST, not tomorrow's date
    const now = new Date();
    const istFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayISTString = istFormatter.format(now); // Returns MM/DD/YYYY in IST (e.g., "01/18/2026")
    
    // Helper function that returns the pre-calculated today's date
    // This ensures we always return the same date throughout the request
    const getTodayInISTString = () => {
      return todayISTString;
    };
    
    // Helper function to get today's Date object in IST for deadline calculations
    // Parses the todayISTString (MM/DD/YYYY) and creates a Date object
    const getTodayDateInIST = (): Date => {
      // todayISTString is in format "MM/DD/YYYY" (e.g., "01/18/2026")
      const [month, day, year] = todayISTString.split("/").map(Number);
      // Create date at midnight in local time (will be used for comparison)
      // Since tickedAt is also a Date object, comparisons will work correctly
      const date = new Date(year, month - 1, day, 0, 0, 0, 0); // month is 0-indexed
      return date;
    };

    const taskRows = await Promise.all(
      tasks.map(async (task: any) => {
        
        // IMPORTANT: Verify task is still ticked/completed
        // If task is unticked or deleted, skip it
        const isTicked = !!(task.tickedAt || task.completedAt || task.status === "completed");
        if (!isTicked) {
          return null;
        }
        
        // Get project name and status
        let projectName = task.projectName || "Unknown";
        let projectStatus = null;
        try {
          const project = await projectsCollection.findOne(
            { _id: task.projectId instanceof ObjectId ? task.projectId : new ObjectId(task.projectId) },
            { projection: { projectName: 1, status: 1 } }
          );
          if (project) {
            projectName = project.projectName || projectName;
            projectStatus = project.status || null;
          }
        } catch (e) {
          // Use existing projectName
        }

        // For one-time tasks that have TaskCompletion records, skip showing the original task
        // (we'll show them via TaskCompletion records instead to avoid duplicates)
        if (task.taskKind === "one-time" && tasksWithCompletions.has(task._id.toString())) {
          return null;
        }

        // Skip tasks from projects that are not "active"
        if (projectStatus !== "active") {
          return null;
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

        // Check if deadline has passed and auto-reject if needed
        // (formatDate and formatTime are defined at top level)
        const now = new Date();
        let deadlinePassed = false;
        let deadlineDate: Date | null = null;
        
        // For recurring tasks (daily/weekly/monthly), use today's date if deadlineTime exists
        const isRecurring = ["daily", "weekly", "monthly"].includes(task.taskKind);
        const isDaily = task.taskKind === "daily";
        
        if (task.deadlineTime) {
          // For daily tasks, ALWAYS use today's date (not what's stored in DB)
          // For other recurring tasks, use today's date if deadlineDate not set
          if (isDaily) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            deadlineDate = new Date(today); // Always use today for daily tasks
            deadlineDate.setHours(0, 0, 0, 0);
          } else if (isRecurring) {
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

        // Automatically calculate what employee got based on deadline (no approval needed)
        let employeeGot = "";
        
        if (task.status === "completed" && task.tickedAt) {
          const now = new Date();
          let shouldGetPenalty = false;
          let shouldGetReward = false;
          
          // Check if deadline has passed
          if (deadlineDate) {
            const completedAt = task.tickedAt || task.completedAt || now;
            if (completedAt > deadlineDate) {
              // Completed after deadline - apply fine
              shouldGetPenalty = true;
            } else {
              // Completed before deadline - apply bonus
              if (task.bonusPoints && task.bonusPoints > 0) {
                shouldGetReward = true;
              }
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
            // No deadline, but has bonus - give reward
            shouldGetReward = true;
          }
          
          // Display what employee got
          if (shouldGetPenalty) {
            if (task.penaltyCurrency && task.penaltyCurrency > 0) {
              employeeGot = `-₹${task.penaltyCurrency} Fine`;
            } else if (task.penaltyPoints && task.penaltyPoints > 0) {
              employeeGot = `-${task.penaltyPoints} Penalty`;
            } else {
              employeeGot = "0 Points";
            }
          } else if (shouldGetReward) {
            if (task.bonusCurrency && task.bonusCurrency > 0) {
              employeeGot = `+₹${task.bonusCurrency} Bonus`;
            } else if (task.bonusPoints && task.bonusPoints > 0) {
              employeeGot = `+${task.bonusPoints} Reward`;
            } else {
              employeeGot = "0 Points";
            }
          } else {
            employeeGot = "0 Points";
          }
        } else if (deadlinePassed && task.status !== "completed") {
          // Deadline passed and not completed - show fine
          if (task.penaltyCurrency && task.penaltyCurrency > 0) {
            employeeGot = `-₹${task.penaltyCurrency} Fine`;
          } else if (task.penaltyPoints && task.penaltyPoints > 0) {
            employeeGot = `-${task.penaltyPoints} Penalty`;
          } else {
            employeeGot = "0 Points";
          }
        } else {
          employeeGot = "Not Completed";
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
        // Get assigned date for sorting (prefer assignedDate, fallback to createdAt)
        const assignedDateRaw = task.assignedDate || task.createdAt;
        
        return {
          _id: task._id.toString(),
          entryType: "task",
          projectName,
          personAssignedTo: assignedToName,
          taskAssignedBy: createdByName || "N/A",
          taskName: task.title,
          taskKind: task.taskKind || "one-time",
          sectionName: task.section || "No Section",
          assignedAtDate: task.assignedDate ? formatDate(task.assignedDate) : (task.createdAt ? formatDate(task.createdAt) : "N/A"),
          assignedAtTime: task.assignedTime || (task.assignedDate ? formatTime(task.assignedDate) : (task.createdAt ? formatTime(task.createdAt) : "N/A")),
          dateDue: task.dueDate ? formatDate(task.dueDate) : "N/A",
          timeDue: task.dueTime || (task.dueDate ? formatTime(task.dueDate) : "N/A"),
          // For daily tasks, ALWAYS show today's date (not what's stored in DB)
          deadlineDate: (() => {
            // Check if task is daily (case-insensitive, handle both string and any other type)
            const isDaily = task.taskKind === "daily" || String(task.taskKind || "").toLowerCase() === "daily";
            if (isDaily) {
              const today = getTodayInISTString();
              return today;
            }
            const dbDeadline = task.deadlineDate ? formatDate(task.deadlineDate) : "N/A";
            return dbDeadline;
          })(),
          deadlineTime: task.deadlineTime || (task.deadlineDate ? formatTime(task.deadlineDate) : "N/A"),
          priority: task.priority || 2,
          tickedBy: tickedByName || "N/A",
          tickedTime: (() => {
            // Use tickedAt if available, otherwise fallback to completedAt
            const tickTime = task.tickedAt || task.completedAt;
            if (tickTime) {
              return `${formatDate(tickTime)} ${formatTime(tickTime)}`;
            }
            return "N/A";
          })(),
          // Add raw date fields for sorting
          assignedAtDateISO: assignedDateRaw ? new Date(assignedDateRaw).toISOString() : null,
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
        // IMPORTANT: Verify subtask is still ticked/completed
        // If subtask is unticked or deleted, skip it
        const isTicked = !!(subtask.tickedAt || subtask.completedAt || subtask.ticked === true || subtask.status === "completed");
        if (!isTicked) {
          return null;
        }
        
        // For subtasks that have SubtaskCompletion records, skip showing the original subtask
        // (we'll show them via SubtaskCompletion records instead to avoid duplicates)
        if (subtasksWithCompletions.has(subtask._id.toString())) {
          return null;
        }
        
        // Get parent task info
        let parentTask: any = null;
        let projectName = 'Unknown Project';
        let section = 'No Section';
        let projectStatus = null;
        try {
          // Fetch parent task with all bonus/fine fields to ensure proper inheritance
          parentTask = await tasksCollection.findOne(
            { _id: subtask.taskId },
            { projection: { 
              title: 1, 
              projectId: 1, 
              section: 1, 
              deadlineDate: 1, 
              deadlineTime: 1, 
              assignedDate: 1,
              assignedTime: 1,
              dueDate: 1,
              dueTime: 1,
              priority: 1,
              taskKind: 1,
              approvalStatus: 1,
              bonusPoints: 1,
              bonusCurrency: 1,
              penaltyPoints: 1,
              penaltyCurrency: 1
            } }
          );
          if (parentTask) {
            const project = await projectsCollection.findOne(
              { _id: parentTask.projectId instanceof ObjectId ? parentTask.projectId : new ObjectId(parentTask.projectId) },
              { projection: { projectName: 1, status: 1 } }
            );
            if (project) {
              projectName = project.projectName || 'Unknown Project';
              projectStatus = project.status || null;
            }
            section = parentTask.section || 'No Section';
          }
        } catch (e) {
          console.error('Error fetching parent task for subtask:', e);
        }

        // Skip subtasks from projects that are not "active"
        if (projectStatus !== "active") {
          return null;
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

        // Calculate deadline date for subtask - ALWAYS use parent task's deadline (subtasks inherit deadline from parent)
        // (formatDate and formatTime are defined at top level)
        let deadlineDate: Date | null = null;
        let deadlinePassed = false;
        const now = new Date();
        
        // ALWAYS use parent task's deadline (subtasks inherit deadline from parent)
        if (parentTask) {
          const parentTaskAny = parentTask as any;
          if (parentTaskAny.deadlineTime) {
            if (parentTaskAny.deadlineDate) {
              deadlineDate = new Date(parentTaskAny.deadlineDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (parentTaskAny.assignedDate) {
              deadlineDate = new Date(parentTaskAny.assignedDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (subtask.createdAt) {
              deadlineDate = new Date(subtask.createdAt);
              deadlineDate.setHours(0, 0, 0, 0);
            }
            if (deadlineDate) {
              const [h, m] = parentTaskAny.deadlineTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            }
          } else if (parentTaskAny.deadlineDate) {
            deadlineDate = new Date(parentTaskAny.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          }
        }
        
        if (deadlineDate) {
          deadlinePassed = now > deadlineDate;
        }

        // Calculate what employee got (similar to task logic)
        let employeeGot = '';
        const subtaskApprovalStatus = subtask.approvalStatus || parentTask?.approvalStatus || 'pending';
        
        // Subtasks ALWAYS inherit bonus/fine from parent task (never use subtask's own values)
        const parentTaskAny = parentTask as any;
        // Get bonus/fine directly from parent task
        const bonus = parentTaskAny?.bonusPoints !== undefined && parentTaskAny?.bonusPoints !== null ? parentTaskAny.bonusPoints : 0;
        const bonusCurrency = parentTaskAny?.bonusCurrency !== undefined && parentTaskAny?.bonusCurrency !== null ? parentTaskAny.bonusCurrency : 0;
        const penalty = parentTaskAny?.penaltyPoints !== undefined && parentTaskAny?.penaltyPoints !== null ? parentTaskAny.penaltyPoints : 0;
        const penaltyCurrency = parentTaskAny?.penaltyCurrency !== undefined && parentTaskAny?.penaltyCurrency !== null ? parentTaskAny.penaltyCurrency : 0;
        
        // Check if parent task has any bonus/fine values at all
        // Check both if values exist AND if they're > 0
        const hasBonusValue = bonusCurrency > 0 || bonus > 0;
        const hasFineValue = penaltyCurrency > 0 || penalty > 0;
        const hasBonus = (bonusCurrency !== undefined && bonusCurrency !== null) || (bonus !== undefined && bonus !== null);
        const hasFine = (penaltyCurrency !== undefined && penaltyCurrency !== null) || (penalty !== undefined && penalty !== null);
        const hasAnyReward = hasBonusValue || hasFineValue || hasBonus || hasFine;
        
        // Calculate what employee got based on approval status and deadline
        // Simple logic: if parent has bonus/fine, always show bonus (before deadline) or fine (after deadline)
        // Check if subtask is completed (either status === 'completed' or ticked === true)
        const isCompleted = subtask.status === 'completed' || subtask.ticked === true;
        const hasTickedAt = subtask.tickedAt || subtask.completedAt;
        
        if (isCompleted && hasTickedAt) {
          const tickedAtDate = subtask.tickedAt || subtask.completedAt;
          const completedAt = new Date(tickedAtDate);
          const wasLate = deadlineDate ? completedAt > deadlineDate : false;
          
          // If parent task has bonus/fine values, always show either bonus or fine (never 0)
          if (hasAnyReward) {
            if (subtaskApprovalStatus === 'deadline_passed' || wasLate) {
              // Ticked after deadline - show fine
              if (hasFineValue) {
                if (penaltyCurrency > 0) {
                  employeeGot = `-₹${penaltyCurrency} Fine`;
                } else if (penalty > 0) {
                  employeeGot = `-${penalty} Penalty`;
                } else {
                  employeeGot = '0 Fine';
                }
              } else if (hasFine) {
                employeeGot = '0 Fine';
              } else if (hasBonusValue) {
                // Has bonus but no fine - if ticked after deadline, show fine (but no fine value), so show 0
                employeeGot = '0 Points';
              } else {
                employeeGot = '0 Points';
              }
            } else {
              // Ticked before deadline - ALWAYS show bonus if parent has bonus/fine values
              if (hasBonusValue) {
                // Parent has bonus values > 0
                if (bonusCurrency > 0) {
                  employeeGot = `+₹${bonusCurrency} Bonus`;
                } else if (bonus > 0) {
                  employeeGot = `+${bonus} Reward`;
                } else {
                  employeeGot = '0 Bonus';
                }
              } else if (hasBonus) {
                // Parent has bonus field but value is 0
                employeeGot = '0 Bonus';
              } else if (hasFineValue) {
                // Parent has fine but no bonus - if ticked before deadline, no fine, show 0
                employeeGot = '0 Points';
              } else if (hasFine) {
                // Parent has fine field but value is 0
                employeeGot = '0 Points';
              } else {
                employeeGot = '0 Points';
              }
            }
          } else {
            // Parent task has no bonus/fine values - show 0 Points
            employeeGot = '0 Points';
          }
        } else if (deadlinePassed && hasAnyReward) {
          // Not completed and deadline passed - show fine if parent has fine values
          if (penaltyCurrency > 0) {
            employeeGot = `-₹${penaltyCurrency} Fine`;
          } else if (penalty > 0) {
            employeeGot = `-${penalty} Penalty`;
          } else if (hasFine) {
            employeeGot = '0 Fine';
          } else {
            employeeGot = '0 Points';
          }
        } else {
          // Not completed or no bonus/fine - show 0 Points
          employeeGot = '0 Points';
        }

        return {
          _id: subtask._id.toString(),
          entryType: 'subtask',
          projectName,
          personAssignedTo: assigneeName,
          taskAssignedBy: 'N/A', // Subtasks are assigned by admin or lead assignee, show N/A if not available
          taskName: `${subtask.title} [Subtask of: ${parentTask?.title || 'Unknown Task'}]`,
          taskKind: subtask.taskKind || parentTask?.taskKind || 'one-time',
          sectionName: section,
          assignedAtDate: subtask.createdAt ? formatDate(subtask.createdAt) : (parentTask?.assignedDate ? formatDate(parentTask.assignedDate) : (parentTask?.createdAt ? formatDate(parentTask.createdAt) : "N/A")),
          assignedAtTime: subtask.createdAt ? formatTime(subtask.createdAt) : (parentTask?.assignedTime || (parentTask?.assignedDate ? formatTime(parentTask.assignedDate) : (parentTask?.createdAt ? formatTime(parentTask.createdAt) : "N/A"))),
          dateDue: subtask.dueDate ? formatDate(subtask.dueDate) : (parentTask?.dueDate ? formatDate(parentTask.dueDate) : "N/A"),
          timeDue: subtask.dueTime || parentTask?.dueTime || "N/A",
          // ALWAYS show parent task's deadline (subtasks inherit deadline from parent)
          // For daily parent tasks, ALWAYS show today's date (not what's stored in DB)
          deadlineDate: (() => {
            const parentTaskKind = (parentTask as any)?.taskKind;
            const isParentDaily = parentTaskKind === "daily" || String(parentTaskKind || "").toLowerCase() === "daily";
            if (parentTask && isParentDaily) {
              const today = getTodayInISTString();
              return today;
            }
            return parentTask?.deadlineDate ? formatDate(parentTask.deadlineDate) : "N/A";
          })(),
          deadlineTime: parentTask?.deadlineTime || "N/A",
          priority: subtask.priority || parentTask?.priority || 2,
          tickedBy: tickedByName || "N/A",
          tickedTime: (() => {
            const tickTime = subtask.tickedAt || subtask.completedAt;
            if (tickTime) {
              return `${formatDate(tickTime)} ${formatTime(tickTime)}`;
            }
            return "N/A";
          })(),
          // Add raw date fields for sorting
          assignedAtDateISO: subtask.createdAt ? new Date(subtask.createdAt).toISOString() : null,
          tickedAt: subtask.tickedAt ? new Date(subtask.tickedAt).toISOString() : (subtask.completedAt ? new Date(subtask.completedAt).toISOString() : null),
          completedAt: subtask.completedAt ? new Date(subtask.completedAt).toISOString() : null,
          createdAt: subtask.createdAt ? new Date(subtask.createdAt).toISOString() : null,
          rewardsPoint: bonus,
          rewardsCurrency: bonusCurrency,
          penaltyPoint: penalty,
          penaltyCurrency: penaltyCurrency,
          employeeGot: employeeGot,
          status: subtask.status || 'pending',
          approvalStatus: subtaskApprovalStatus,
          approvedBy: "N/A",
          deadlinePassed: deadlinePassed,
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
          // Convert to IST (Asia/Kolkata) timezone - UTC+5:30
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          return formatter.format(d);
        };

        const formatTime = (date: Date | string | undefined | null) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          // Convert to IST (Asia/Kolkata) timezone - UTC+5:30
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return formatter.format(d);
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
          // Add raw date fields for sorting
          assignedAtDateISO: startDate ? new Date(startDate).toISOString() : (p.createdAt ? new Date(p.createdAt).toISOString() : null),
          tickedAt: submittedAt ? new Date(submittedAt).toISOString() : null,
          completedAt: null,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
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

    // TaskCompletions and SubtaskCompletions already fetched above for deduplication
    // No need to fetch again

    const completionRows = await Promise.all(
      taskCompletions.map(async (completion: any) => {
        
        const formatDate = (date: Date | string | undefined | null) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          // Convert to IST (Asia/Kolkata) timezone - UTC+5:30
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          return formatter.format(d);
        };

        const formatTime = (date: Date | string | undefined | null) => {
          if (!date) return "";
          const d = typeof date === "string" ? new Date(date) : date;
          // Convert to IST (Asia/Kolkata) timezone - UTC+5:30
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return formatter.format(d);
        };

        // Automatically calculate what employee got based on deadline (no approval needed)
        let employeeGot = "";
        const now = new Date();
        
        // Handle unticked daily tasks (notTicked flag)
        if (completion.notTicked && completion.approvalStatus === "deadline_passed") {
          // Task was not ticked - show fine
          if (completion.penaltyCurrency && completion.penaltyCurrency > 0) {
            employeeGot = `-₹${completion.penaltyCurrency} Fine (Not Ticked)`;
          } else if (completion.penaltyPoints && completion.penaltyPoints > 0) {
            employeeGot = `-${completion.penaltyPoints} Penalty (Not Ticked)`;
          } else {
            employeeGot = "0 Points (Not Ticked)";
          }
        } else if (completion.tickedAt) {
          let shouldGetPenalty = false;
          let shouldGetReward = false;
          
          // Calculate deadline
          // For daily tasks, use today's date in IST (not what's in DB)
          const isDaily = completion.taskKind === "daily" || String(completion.taskKind || "").toLowerCase() === "daily";
          let completionDeadlineDate: Date | null = null;
          if (completion.deadlineTime) {
            if (isDaily) {
              // For daily tasks, always use today's date in IST
              completionDeadlineDate = getTodayDateInIST();
              completionDeadlineDate.setHours(0, 0, 0, 0);
            } else if (completion.deadlineDate) {
              completionDeadlineDate = new Date(completion.deadlineDate);
              completionDeadlineDate.setHours(0, 0, 0, 0);
            } else {
              completionDeadlineDate = new Date(completion.tickedAt);
              completionDeadlineDate.setHours(0, 0, 0, 0);
            }
            const [hours, minutes] = completion.deadlineTime.split(":");
            completionDeadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else if (isDaily) {
            // For daily tasks without deadlineTime, use today 23:59:59
            completionDeadlineDate = getTodayDateInIST();
            completionDeadlineDate.setHours(23, 59, 59, 999);
          } else if (completion.deadlineDate) {
            completionDeadlineDate = new Date(completion.deadlineDate);
            completionDeadlineDate.setHours(23, 59, 59, 999);
          } else if (completion.dueDate) {
            completionDeadlineDate = new Date(completion.dueDate);
            if (completion.dueTime) {
              const [hours, minutes] = completion.dueTime.split(":");
              completionDeadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            } else {
              completionDeadlineDate.setHours(23, 59, 59, 999);
            }
          }
          
          if (completionDeadlineDate) {
            const completedAt = completion.tickedAt || completion.completedAt || now;
            if (completedAt > completionDeadlineDate) {
              shouldGetPenalty = true;
            } else {
              if (completion.bonusPoints && completion.bonusPoints > 0) {
                shouldGetReward = true;
              }
            }
          } else if (completion.bonusPoints && completion.bonusPoints > 0) {
            shouldGetReward = true;
          }
          
          // Display what employee got
          if (shouldGetPenalty) {
            if (completion.penaltyCurrency && completion.penaltyCurrency > 0) {
              employeeGot = `-₹${completion.penaltyCurrency} Fine`;
            } else if (completion.penaltyPoints && completion.penaltyPoints > 0) {
              employeeGot = `-${completion.penaltyPoints} Penalty`;
            } else {
              employeeGot = "0 Points";
            }
          } else if (shouldGetReward) {
            if (completion.bonusCurrency && completion.bonusCurrency > 0) {
              employeeGot = `+₹${completion.bonusCurrency} Bonus`;
            } else if (completion.bonusPoints && completion.bonusPoints > 0) {
              employeeGot = `+${completion.bonusPoints} Reward`;
            } else {
              employeeGot = "0 Points";
            }
          } else {
            employeeGot = "0 Points";
          }
        } else {
          employeeGot = "Not Completed";
        }

        // Check if project exists and get status
        let projectExists = true;
        let projectDeleted = false;
        let projectNameDisplay = completion.projectName || "Unknown";
        let projectStatus = null;
        try {
          const projectCheck = await projectsCollection.findOne(
            { _id: completion.projectId instanceof ObjectId ? completion.projectId : new ObjectId(completion.projectId) },
            { projection: { projectName: 1, status: 1 } }
          );
          projectExists = !!projectCheck;
          projectDeleted = !projectCheck;
          if (projectCheck) {
            projectStatus = projectCheck.status || null;
          }
          if (projectDeleted) {
            projectNameDisplay = `${completion.projectName} (Project Deleted)`;
          }
        } catch (e) {
          projectDeleted = true;
          projectNameDisplay = `${completion.projectName} (Project Deleted)`;
        }

        // Skip task completions from projects that are not "active"
        if (projectStatus !== "active") {
          return null;
        }

        // IMPORTANT: Check if the original task still exists and is still ticked
        // If task is deleted or unticked, skip this completion entry
        let taskExists = false;
        let taskStillTicked = false;
        try {
          if (completion.taskId) {
            const originalTask = await tasksCollection.findOne(
              { _id: completion.taskId instanceof ObjectId ? completion.taskId : new ObjectId(completion.taskId) },
              { projection: { status: 1, tickedAt: 1, completedAt: 1 } }
            );
            if (originalTask) {
              taskExists = true;
              // Check if task is still ticked (has tickedAt or completedAt, or status is completed)
              taskStillTicked = !!(originalTask.tickedAt || originalTask.completedAt || originalTask.status === "completed");
            }
          }
        } catch (e) {
          // Task doesn't exist or error checking
          taskExists = false;
        }
        
        // Skip if task is deleted or unticked
        if (!taskExists || !taskStillTicked) {
          return null;
        }
        
        // Get assigned date/time - prefer stored assignedDate/assignedTime, then try original task, then tickedAt
        let assignedAtDate = "N/A";
        let assignedAtTime = "N/A";
        let assignedAtDateISO: string | null = null;
        
        // First check if assignedDate/assignedTime are stored in completion record
        if (completion.assignedDate) {
          assignedAtDate = formatDate(completion.assignedDate);
          assignedAtTime = completion.assignedTime || formatTime(completion.assignedDate);
          assignedAtDateISO = new Date(completion.assignedDate).toISOString();
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
                  assignedAtDateISO = new Date(originalTask.assignedDate).toISOString();
                } else if (originalTask.createdAt) {
                  assignedAtDate = formatDate(originalTask.createdAt);
                  assignedAtTime = formatTime(originalTask.createdAt);
                  assignedAtDateISO = new Date(originalTask.createdAt).toISOString();
                }
              }
            }
          } catch (e) {
            // Ignore errors
          }
          
          // If we couldn't get original task date, use tickedAt (when employee actually worked on it)
          if (assignedAtDate === "N/A" && completion.tickedAt) {
            assignedAtDate = formatDate(completion.tickedAt);
            assignedAtTime = formatTime(completion.tickedAt);
            assignedAtDateISO = new Date(completion.tickedAt).toISOString();
          } else if (assignedAtDate === "N/A" && completion.createdAt) {
            // Last fallback: use completion record creation date
            assignedAtDate = formatDate(completion.createdAt);
            assignedAtTime = formatTime(completion.createdAt);
            assignedAtDateISO = new Date(completion.createdAt).toISOString();
          }
        }

        return {
          _id: completion._id.toString(),
          entryType: "task_completion",
          projectName: projectNameDisplay,
          personAssignedTo: completion.assignedToName || completion.assigneeNames?.[0] || "N/A",
          taskAssignedBy: "N/A", // Historical data, show N/A if not available
          taskName: `${completion.taskTitle} (${completion.taskKind})`,
          taskKind: completion.taskKind,
          sectionName: completion.section || "No Section",
          assignedAtDate,
          assignedAtTime,
          dateDue: completion.dueDate ? formatDate(completion.dueDate) : "N/A",
          timeDue: completion.dueTime || "N/A",
          // For daily tasks, ALWAYS show today's date (not what's stored in completion record)
          deadlineDate: (() => {
            const completionTaskKind = completion.taskKind;
            const isCompletionDaily = completionTaskKind === "daily" || String(completionTaskKind || "").toLowerCase() === "daily";
            if (isCompletionDaily) {
              const today = getTodayInISTString();
              return today;
            }
            const dbDeadline = completion.deadlineDate ? formatDate(completion.deadlineDate) : "N/A";
            return dbDeadline;
          })(),
          deadlineTime: completion.deadlineTime || "N/A",
          priority: completion.priority || 2,
          tickedBy: completion.notTicked ? "Not Ticked" : (completion.completedByName || "N/A"),
          tickedTime: completion.notTicked ? "Not Ticked" : (completion.tickedAt ? `${formatDate(completion.tickedAt)} ${formatTime(completion.tickedAt)}` : "N/A"),
          // Add raw date fields for sorting
          assignedAtDateISO: assignedAtDateISO,
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
          approvedBy: completion.approvedByName || "N/A",
          deadlinePassed: false, // Historical data
          customFields: completion.customFields || [],
          customFieldValues: completion.customFieldValues || {},
          createdByEmployee: false,
          // Only mark as historical if it's a recurring task (one-time tasks are not historical)
          isHistorical: completion.taskKind !== "one-time", // Historical only for recurring tasks
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
        // IMPORTANT: Check if the original subtask still exists and is still ticked
        // If subtask is deleted or unticked, skip this completion entry
        let subtaskExists = false;
        let subtaskStillTicked = false;
        try {
          if (completion.subtaskId) {
            const originalSubtask = await db.collection("subtasks").findOne(
              { _id: completion.subtaskId instanceof ObjectId ? completion.subtaskId : new ObjectId(completion.subtaskId) },
              { projection: { status: 1, tickedAt: 1, completedAt: 1, ticked: 1 } }
            );
            if (originalSubtask) {
              subtaskExists = true;
              // Check if subtask is still ticked
              subtaskStillTicked = !!(originalSubtask.tickedAt || originalSubtask.completedAt || originalSubtask.ticked === true || originalSubtask.status === "completed");
            }
          }
        } catch (e) {
          // Subtask doesn't exist or error checking
          subtaskExists = false;
        }
        
        // Skip if subtask is deleted or unticked
        if (!subtaskExists || !subtaskStillTicked) {
          return null;
        }
        
        // Check project status for subtask completions
        let projectStatus = null;
        if (completion.projectId) {
          try {
            const project = await projectsCollection.findOne(
              { _id: completion.projectId instanceof ObjectId ? completion.projectId : new ObjectId(completion.projectId) },
              { projection: { status: 1 } }
            );
            if (project) {
              projectStatus = project.status || null;
            }
          } catch (e) {
            // Couldn't fetch project status
          }
        }

        // Skip subtask completions from projects that are not "active"
        if (projectStatus !== "active") {
          return null;
        }

        const formatDate = (date: Date | string | undefined | null) => {
          if (!date) return '';
          const d = typeof date === 'string' ? new Date(date) : date;
          return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Asia/Kolkata'
          });
        };

        const formatTime = (date: Date | string | undefined | null) => {
          if (!date) return '';
          const d = typeof date === 'string' ? new Date(date) : date;
          return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Kolkata'
          });
        };

        // Automatically calculate what employee got based on deadline and approval status
        let employeeGot = '';
        const now = new Date();
        
        // Get bonus/fine from completion record (inherited from parent task)
        const bonus = completion.bonusPoints !== undefined && completion.bonusPoints !== null ? completion.bonusPoints : 0;
        const bonusCurrency = completion.bonusCurrency !== undefined && completion.bonusCurrency !== null ? completion.bonusCurrency : 0;
        const penalty = completion.penaltyPoints !== undefined && completion.penaltyPoints !== null ? completion.penaltyPoints : 0;
        const penaltyCurrency = completion.penaltyCurrency !== undefined && completion.penaltyCurrency !== null ? completion.penaltyCurrency : 0;
        
        // Check if parent task has any bonus/fine values at all
        // IMPORTANT: Check if values exist (even if 0) OR if they're > 0
        const hasBonus = (bonusCurrency !== undefined && bonusCurrency !== null && bonusCurrency >= 0) || (bonus !== undefined && bonus !== null && bonus >= 0);
        const hasFine = (penaltyCurrency !== undefined && penaltyCurrency !== null && penaltyCurrency >= 0) || (penalty !== undefined && penalty !== null && penalty >= 0);
        const hasAnyReward = hasBonus || hasFine;
        
        // For display, check if values are actually > 0
        const hasBonusValue = bonusCurrency > 0 || bonus > 0;
        const hasFineValue = penaltyCurrency > 0 || penalty > 0;
        
        // Check approval status first
        const approvalStatus = completion.approvalStatus || 'pending';
        
        if (completion.tickedAt) {
          // Calculate deadline (inherit from parent task)
          // For daily tasks, use today's date in IST (not what's in DB)
          const isDaily = completion.taskKind === "daily" || String(completion.taskKind || "").toLowerCase() === "daily";
          let completionDeadlineDate: Date | null = null;
          if (completion.deadlineTime) {
            if (isDaily) {
              // For daily tasks, always use today's date in IST
              completionDeadlineDate = getTodayDateInIST();
              completionDeadlineDate.setHours(0, 0, 0, 0);
            } else if (completion.deadlineDate) {
              completionDeadlineDate = new Date(completion.deadlineDate);
              completionDeadlineDate.setHours(0, 0, 0, 0);
            } else if (completion.tickedAt) {
              completionDeadlineDate = new Date(completion.tickedAt);
              completionDeadlineDate.setHours(0, 0, 0, 0);
            }
            if (completionDeadlineDate) {
              const [hours, minutes] = completion.deadlineTime.split(":");
              completionDeadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }
          } else if (isDaily) {
            // For daily tasks without deadlineTime, use today 23:59:59
            completionDeadlineDate = getTodayDateInIST();
            completionDeadlineDate.setHours(23, 59, 59, 999);
          } else if (completion.deadlineDate) {
            completionDeadlineDate = new Date(completion.deadlineDate);
            completionDeadlineDate.setHours(23, 59, 59, 999);
          }
          
          const completedAt = new Date(completion.tickedAt);
          const deadlinePassed = completionDeadlineDate ? completedAt > completionDeadlineDate : false;
          
          // Simple logic: if parent has bonus/fine, always show either bonus (before deadline) or fine (after deadline)
          if (hasAnyReward) {
            if (approvalStatus === 'deadline_passed' || deadlinePassed) {
              // Ticked after deadline - show fine
              if (hasFineValue) {
                if (penaltyCurrency > 0) {
                  employeeGot = `-₹${penaltyCurrency} Fine`;
                } else if (penalty > 0) {
                  employeeGot = `-${penalty} Penalty`;
                } else {
                  employeeGot = '0 Fine';
                }
              } else if (hasFine) {
                employeeGot = '0 Fine';
              } else {
                employeeGot = '0 Points';
              }
            } else {
              // Ticked before deadline - ALWAYS show bonus if parent has bonus/fine values
              if (hasBonusValue) {
                if (bonusCurrency > 0) {
                  employeeGot = `+₹${bonusCurrency} Bonus`;
                } else if (bonus > 0) {
                  employeeGot = `+${bonus} Reward`;
                } else {
                  employeeGot = '0 Bonus';
                }
              } else if (hasBonus) {
                employeeGot = '0 Bonus';
              } else if (hasFineValue) {
                // Has fine but no bonus - if ticked before deadline, no fine, show 0
                employeeGot = '0 Points';
              } else {
                employeeGot = '0 Points';
              }
            }
          } else {
            // Parent task has no bonus/fine values - show 0 Points
            employeeGot = '0 Points';
          }
        } else {
          employeeGot = 'Not Completed';
        }

        return {
          _id: completion._id.toString(),
          entryType: 'subtask_completion',
          projectName: completion.projectName,
          personAssignedTo: completion.assigneeNames?.join(', ') || 'Unknown',
          taskAssignedBy: 'N/A',
          taskName: `${completion.subtaskTitle} [Subtask of: ${completion.parentTaskTitle}]`,
          taskKind: completion.taskKind,
          sectionName: completion.section || 'No Section',
          assignedAtDate: completion.assignedDate ? formatDate(completion.assignedDate) : 'N/A',
          assignedAtTime: completion.assignedTime || (completion.assignedDate ? formatTime(completion.assignedDate) : 'N/A'),
          dateDue: completion.dueDate ? formatDate(completion.dueDate) : 'N/A',
          timeDue: completion.dueTime || 'N/A',
          // For daily tasks, ALWAYS show today's date (not what's stored in completion record)
          deadlineDate: (() => {
            const completionTaskKind = completion.taskKind;
            const isCompletionDaily = completionTaskKind === "daily" || String(completionTaskKind || "").toLowerCase() === "daily";
            if (isCompletionDaily) {
              const today = getTodayInISTString();
              return today;
            }
            const dbDeadline = completion.deadlineDate ? formatDate(completion.deadlineDate) : 'N/A';
            return dbDeadline;
          })(),
          deadlineTime: completion.deadlineTime || 'N/A',
          priority: 2,
          tickedBy: completion.completedByName || 'N/A',
          tickedTime: completion.tickedAt ? `${formatDate(completion.tickedAt)} ${formatTime(completion.tickedAt)}` : 'N/A',
          // Add raw date fields for sorting
          assignedAtDateISO: completion.assignedDate ? new Date(completion.assignedDate).toISOString() : (completion.createdAt ? new Date(completion.createdAt).toISOString() : null),
          tickedAt: completion.tickedAt ? new Date(completion.tickedAt).toISOString() : null,
          completedAt: completion.completedAt ? new Date(completion.completedAt).toISOString() : null,
          createdAt: completion.createdAt ? new Date(completion.createdAt).toISOString() : null,
          rewardsPoint: bonus,
          rewardsCurrency: bonusCurrency,
          penaltyPoint: penalty,
          penaltyCurrency: penaltyCurrency,
          employeeGot: employeeGot,
          status: 'completed',
          approvalStatus: completion.approvalStatus || 'approved', // Show status but bonus/fine is auto-applied
          approvedBy: "N/A",
          deadlinePassed: false,
          customFields: [],
          customFieldValues: {},
          createdByEmployee: false,
          // Only mark as historical if it's a recurring task (one-time tasks are not historical)
          isHistorical: completion.taskKind !== "one-time", // Historical only for recurring tasks
          isSubtask: true,
          parentTaskTitle: completion.parentTaskTitle,
        };
      })
    );

    // Filter out null entries (tasks from non-active projects)
    let analysisData = [...taskRows, ...subtaskRows, ...completionRows, ...subtaskCompletionRows, ...hackathonRows].filter((item: any) => item !== null);

    // Sort: by tickedAt/completedAt date (newest first, oldest last)
    analysisData.sort((a: any, b: any) => {
      // Sort by tickedAt/completedAt date (newest first)
      const getTickedDate = (item: any): Date => {
        // Prefer tickedAt for sorting (when task was actually completed)
        if (item.tickedAt) {
          const d = new Date(item.tickedAt);
          if (!isNaN(d.getTime())) return d;
        }
        if (item.completedAt) {
          const d = new Date(item.completedAt);
          if (!isNaN(d.getTime())) return d;
        }
        // Fallback to assignedAtDateISO
        if (item.assignedAtDateISO) {
          const d = new Date(item.assignedAtDateISO);
          if (!isNaN(d.getTime())) return d;
        }
        if (item.createdAt) {
          const d = new Date(item.createdAt);
          if (!isNaN(d.getTime())) return d;
        }
        // Default to epoch if no valid date found
        return new Date(0);
      };
      
      const aDate = getTickedDate(a);
      const bDate = getTickedDate(b);
      
      // Sort by ticked date descending (newest first, oldest last)
      return bDate.getTime() - aDate.getTime();
    });

    // Apply filters on server side
    analysisData = analysisData.filter((task: any) => {
      // Project filter
      if (projectFilter !== "all" && task.projectName !== projectFilter) {
        return false;
      }

      // Employee filter
      if (
        employeeFilter !== "all" &&
        task.personAssignedTo &&
        task.personAssignedTo !== employeeFilter
      ) {
        return false;
      }

      // Deadline filter
      if (deadlineFilter !== "all") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toDateString();

        const deadlineStr = task.deadlineDate || task.dateDue;
        if (!deadlineStr) {
          if (deadlineFilter === "no_deadline") return true;
          return false;
        }

        try {
          const d = new Date(deadlineStr);
          d.setHours(0, 0, 0, 0);

          if (deadlineFilter === "overdue") {
            return d < today;
          }
          if (deadlineFilter === "today") {
            return d.toDateString() === todayStr;
          }
          if (deadlineFilter === "upcoming") {
            return d > today;
          }
          if (deadlineFilter === "no_deadline") {
            return false; // Already handled above
          }
        } catch (e) {
          // Invalid date, skip this task for deadline filter
          if (deadlineFilter !== "no_deadline") {
            return false;
          }
        }
      }

      return true;
    });

    // Get total count after filtering (before pagination)
    const total = analysisData.length;
    
    // Apply pagination
    const paginatedData = analysisData.slice(skip, skip + limit);


    return NextResponse.json({
      success: true,
      tasks: paginatedData,
      total: total,
      showing: paginatedData.length,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching task analysis:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

