import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import { ObjectId } from "mongodb";

// GET - Fetch all tasks with full details for analysis
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();

    // Fetch all tasks
    const tasks = await Task.find({})
      .sort({ createdAt: -1 })
      .lean();

    // Manually populate user references and project details
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");
    const projectsCollection = db.collection("projects");

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

        // Populate createdBy (always admin)
        let createdByName = "Admin";
        if (task.createdBy) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.createdBy instanceof ObjectId ? task.createdBy : new ObjectId(task.createdBy) },
              { projection: { name: 1 } }
            );
            if (user) {
              createdByName = user.name || "Admin";
            }
          } catch (e) {
            // Keep default
          }
        }

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
        
        if (task.deadlineDate) {
          deadlineDate = new Date(task.deadlineDate);
          if (task.deadlineTime) {
            const [hours, minutes] = task.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
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

        return {
          _id: task._id.toString(),
          entryType: "task",
          projectName,
          personAssignedTo: assignedToName,
          taskAssignedBy: "Admin", // Always admin as per requirement
          taskName: task.title,
          taskKind: task.taskKind || "one-time",
          sectionName: task.section || "No Section",
          assignedAtDate: task.assignedDate ? formatDate(task.assignedDate) : "",
          assignedAtTime: task.assignedTime || (task.assignedDate ? formatTime(task.assignedDate) : ""),
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
          rewardsPoint: task.bonusPoints || 0,
          penaltyPoint: task.penaltyPoints || 0,
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

    const analysisData = [...taskRows, ...hackathonRows];

    return NextResponse.json({
      success: true,
      tasks: analysisData,
    });
  } catch (error) {
    console.error("Error fetching task analysis:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

