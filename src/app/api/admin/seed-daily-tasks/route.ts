import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import Task from "@/models/Task";
import Subtask from "@/models/Subtask";
import User from "@/models/User";

// Daily tasks to create
const DAILY_TASKS = [
  "Make the daily tasks for this project before",
  "Meeting for this project",
  "Time table made for this project for the next day",
  "Loom recording for this project",
  "Tasks mentioned on WhatsApp or in zoom meeting added to EMS",
  "Responded to the client on WhatsApp on the same day if any message was sent",
  "Client meeting attended at the exact time",
  "Attended more than 3 hours",
  "Uploaded Project to Github",
];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");
    const projectsCollection = db.collection("projects");
    const usersCollection = db.collection("users");

    // Get all projects
    const projects = await projectsCollection.find({}).toArray();

    if (projects.length === 0) {
      return NextResponse.json(
        { error: "No projects found in database" },
        { status: 404 }
      );
    }

    let totalTasksCreated = 0;
    let totalSubtasksCreated = 0;
    const results: any[] = [];

    for (const project of projects) {
      const projectId = project._id;
      const projectName = project.projectName || "Unknown Project";

      // Get lead assignee (can be array or single)
      let leadAssignees: ObjectId[] = [];
      if (project.leadAssignee) {
        if (Array.isArray(project.leadAssignee)) {
          leadAssignees = project.leadAssignee
            .map((lead: any) => {
              if (lead instanceof ObjectId) return lead;
              if (typeof lead === "object" && lead._id) return new ObjectId(lead._id);
              return new ObjectId(lead);
            })
            .filter(Boolean);
        } else {
          const leadId =
            project.leadAssignee instanceof ObjectId
              ? project.leadAssignee
              : typeof project.leadAssignee === "object" && project.leadAssignee._id
              ? new ObjectId(project.leadAssignee._id)
              : new ObjectId(project.leadAssignee);
          leadAssignees = [leadId];
        }
      }

      // Skip projects without lead assignee
      if (leadAssignees.length === 0) {
        results.push({
          projectId: projectId.toString(),
          projectName,
          status: "skipped",
          reason: "No lead assignee found",
        });
        continue;
      }

      // Get all assignees (employees in the project)
      let allAssignees: ObjectId[] = [];
      if (project.assignees && Array.isArray(project.assignees)) {
        allAssignees = project.assignees
          .map((assignee: any) => {
            if (assignee instanceof ObjectId) return assignee;
            if (typeof assignee === "object" && assignee._id) return new ObjectId(assignee._id);
            return new ObjectId(assignee);
          })
          .filter(Boolean);
      }

      // Include lead assignees in the assignees list if not already there
      const assigneeIds = new Set(leadAssignees.map((id) => id.toString()));
      for (const assignee of allAssignees) {
        assigneeIds.add(assignee.toString());
      }
      const allEmployeeIds = Array.from(assigneeIds).map((id) => new ObjectId(id));

      // If no assignees found, use only lead assignees
      const employeesForSubtasks =
        allEmployeeIds.length > 0 ? allEmployeeIds : leadAssignees;

      // Create or update "Daily tasks" section
      const sectionName = "Daily tasks";
      const sections = project.sections || [];
      if (!sections.includes(sectionName)) {
        await projectsCollection.updateOne(
          { _id: projectId },
          { $addToSet: { sections: sectionName } }
        );
      }

      // Get the highest order for tasks in this section
      const lastTask = await Task.findOne({
        projectId: projectId,
        section: sectionName,
      })
        .sort({ order: -1 })
        .lean();

      let currentOrder = lastTask && !Array.isArray(lastTask) ? ((lastTask as any)?.order || 0) + 1 : 0;

      // Get admin user ID for createdBy (use session user)
      const createdBy = new ObjectId(session.user.id);

      // Get lead assignee names
      const leadAssigneeNames: string[] = [];
      for (const leadId of leadAssignees) {
        const leadUser = await usersCollection.findOne(
          { _id: leadId },
          { projection: { name: 1 } }
        );
        if (leadUser?.name) {
          leadAssigneeNames.push(leadUser.name);
        }
      }

      const projectTasksCreated: any[] = [];
      const projectSubtasksCreated: any[] = [];

      // Create each daily task
      for (let taskIndex = 0; taskIndex < DAILY_TASKS.length; taskIndex++) {
        const taskTitle = DAILY_TASKS[taskIndex];
        // First task gets deadline time of 10:00 AM, others get 22:00 (10 PM)
        const deadlineTime = taskIndex === 0 ? "10:00" : "22:00";

        // Check if task already exists (to avoid duplicates)
        const existingTask = await Task.findOne({
          projectId: projectId,
          section: sectionName,
          title: taskTitle,
        }).lean();

        // Skip if task already exists (to avoid duplicates)
        if (existingTask) {
          const taskId = Array.isArray(existingTask) ? existingTask[0]?._id : (existingTask as any)?._id;
          if (!taskId) continue;
          projectTasksCreated.push({
            taskId: taskId.toString(),
            title: taskTitle,
            status: "already_exists",
          });
          // Still create subtasks for existing tasks if they don't exist
          // This allows adding subtasks for new employees added to the project
          const existingTaskId = taskId;
          
          // Create subtasks for each employee (only if they don't exist)
          for (const employeeId of employeesForSubtasks) {
            const employeeUser = await usersCollection.findOne(
              { _id: employeeId },
              { projection: { name: 1 } }
            );
            const employeeName = employeeUser?.name || "Unknown";

            const existingSubtask = await Subtask.findOne({
              taskId: existingTaskId,
              assignee: employeeId,
            }).lean();

            if (!existingSubtask) {
              const lastSubtask = await Subtask.findOne({
                taskId: existingTaskId,
              })
                .sort({ order: -1 })
                .lean();
              const subtaskOrder = lastSubtask && !Array.isArray(lastSubtask) ? ((lastSubtask as any)?.order || 0) + 1 : 0;

              const subtaskData: any = {
                taskId: existingTaskId,
                projectId: projectId,
                title: taskTitle,
                description: "",
                assignee: employeeId,
                assigneeName: employeeName,
                taskKind: "daily",
                deadlineTime: deadlineTime, // First task: 10:00, others: 22:00
                bonusPoints: 5,
                penaltyPoints: 100,
                priority: 2,
                status: "pending",
                ticked: false,
                order: subtaskOrder,
                createdBy: createdBy,
                approvalStatus: "pending",
                recurringPattern: {
                  frequency: "daily",
                  interval: 1,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              const subtask = new Subtask(subtaskData);
              await subtask.save();
              totalSubtasksCreated++;
              projectSubtasksCreated.push({
                subtaskId: subtask._id.toString(),
                title: taskTitle,
                assignee: employeeName,
                status: "created",
              });
            }
          }
          continue;
        }

        // Create task
        const taskData: any = {
          projectId: projectId,
          projectName: projectName,
          section: sectionName,
          title: taskTitle,
          description: "",
          taskKind: "daily",
          assignedTo: leadAssignees[0], // Primary assignee (first lead)
          assignedToName: leadAssigneeNames.join(", "),
          assignees: leadAssignees,
          assigneeNames: leadAssigneeNames,
          assignedDate: new Date(),
          deadlineTime: deadlineTime, // First task: 10:00, others: 22:00
          bonusPoints: 5,
          penaltyPoints: 100,
          priority: 2,
          status: "pending",
          order: currentOrder++,
          createdBy: createdBy,
          createdByEmployee: false,
          approvalStatus: "pending",
          recurringPattern: {
            frequency: "daily",
            interval: 1,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const task = new Task(taskData);
        const savedTask = await task.save();
        totalTasksCreated++;
        projectTasksCreated.push({
          taskId: savedTask._id.toString(),
          title: taskTitle,
          status: "created",
        });

        // Create subtasks for each employee
        for (const employeeId of employeesForSubtasks) {
          // Get employee name
          const employeeUser = await usersCollection.findOne(
            { _id: employeeId },
            { projection: { name: 1 } }
          );
          const employeeName = employeeUser?.name || "Unknown";

          // Check if subtask already exists
          const existingSubtask = await Subtask.findOne({
            taskId: savedTask._id,
            assignee: employeeId,
            title: taskTitle,
          }).lean();

          if (existingSubtask) {
            const subtaskId = Array.isArray(existingSubtask) ? existingSubtask[0]?._id : (existingSubtask as any)?._id;
            if (subtaskId) {
              projectSubtasksCreated.push({
                subtaskId: subtaskId.toString(),
                title: taskTitle,
                assignee: employeeName,
                status: "already_exists",
              });
            }
            continue;
          }

          // Get the highest order for subtasks in this task
          const lastSubtask = await Subtask.findOne({
            taskId: savedTask._id,
          })
            .sort({ order: -1 })
            .lean();
          const subtaskOrder = lastSubtask && !Array.isArray(lastSubtask) ? ((lastSubtask as any)?.order || 0) + 1 : 0;

          // Create subtask
          const subtaskData: any = {
            taskId: savedTask._id,
            projectId: projectId,
            title: taskTitle,
            description: "",
            assignee: employeeId,
            assigneeName: employeeName,
            taskKind: "daily",
            deadlineTime: deadlineTime, // First task: 10:00, others: 22:00
            bonusPoints: 5, // Inherit from parent
            penaltyPoints: 100, // Inherit from parent
            priority: 2,
            status: "pending",
            ticked: false,
            order: subtaskOrder,
            createdBy: createdBy,
            approvalStatus: "pending",
            recurringPattern: {
              frequency: "daily",
              interval: 1,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const subtask = new Subtask(subtaskData);
          const savedSubtask = await subtask.save();
          totalSubtasksCreated++;
          projectSubtasksCreated.push({
            subtaskId: savedSubtask._id.toString(),
            title: taskTitle,
            assignee: employeeName,
            status: "created",
          });
        }
      }

      results.push({
        projectId: projectId.toString(),
        projectName,
        status: "success",
        tasksCreated: projectTasksCreated.length,
        subtasksCreated: projectSubtasksCreated.length,
        details: {
          tasks: projectTasksCreated,
          subtasks: projectSubtasksCreated,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Seeding completed for ${projects.length} projects`,
      summary: {
        totalProjects: projects.length,
        totalTasksCreated,
        totalSubtasksCreated,
      },
      results,
    });
  } catch (error: any) {
    console.error("Error seeding daily tasks:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
