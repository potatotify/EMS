/**
 * Seed Daily Tasks Script
 * This script creates daily tasks and subtasks for all projects
 * Run with: npx tsx scripts/seed-daily-tasks.ts
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

import { dbConnect } from "../src/lib/mongodb";
import Task from "../src/models/Task";
import Subtask from "../src/models/Subtask";
import { ObjectId } from "mongodb";
import clientPromise from "../src/lib/mongodb";

const DAILY_TASKS = [
  "make the daily tasks for this project before 10 am",
  "Meeting for this project",
  "Time table made for this project for the next day",
  "Loom recording for this project",
  "Tasks mentioned on WhatsApp or in zoom meeting added to EMS",
  "Responded to the client on WhatsApp on the same day if any message was sent",
  "Client meeting attended at the exact time",
  "Attended more than 3 hours",
  "Uploaded Project to Github",
];

async function seedDailyTasks() {
  try {
    console.log("🔌 Connecting to database...");
    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");
    const projectsCollection = db.collection("projects");
    const usersCollection = db.collection("users");

    console.log("📋 Fetching all projects...");
    const projects = await projectsCollection.find({}).toArray();

    if (projects.length === 0) {
      console.log("❌ No projects found in database");
      process.exit(1);
    }

    console.log(`✅ Found ${projects.length} projects\n`);

    let totalTasksCreated = 0;
    let totalSubtasksCreated = 0;
    let projectsSkipped = 0;
    let projectsProcessed = 0;

    for (const project of projects) {
      const projectId = project._id;
      const projectName = project.projectName || "Unknown Project";

      console.log(`\n📁 Processing: ${projectName}`);

      // Get lead assignee
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

      if (leadAssignees.length === 0) {
        console.log("   ⏭️  Skipped: No lead assignee found");
        projectsSkipped++;
        continue;
      }

      // Get all assignees
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

      const assigneeIds = new Set(leadAssignees.map((id) => id.toString()));
      for (const assignee of allAssignees) {
        assigneeIds.add(assignee.toString());
      }
      const allEmployeeIds = Array.from(assigneeIds).map((id) => new ObjectId(id));
      const employeesForSubtasks = allEmployeeIds.length > 0 ? allEmployeeIds : leadAssignees;

      console.log(`   👥 Lead assignees: ${leadAssignees.length}`);
      console.log(`   👥 Total employees: ${employeesForSubtasks.length}`);

      // Create section
      const sectionName = "Daily tasks";
      const sections = project.sections || [];
      if (!sections.includes(sectionName)) {
        await projectsCollection.updateOne(
          { _id: projectId },
          { $addToSet: { sections: sectionName } }
        );
        console.log(`   ✅ Created section: "${sectionName}"`);
      }

      // Get order
      const lastTask = await Task.findOne({
        projectId: projectId,
        section: sectionName,
      })
        .sort({ order: -1 })
        .lean();

      let currentOrder = lastTask && !Array.isArray(lastTask) ? ((lastTask as any)?.order || 0) + 1 : 0;

      // Get admin user
      const adminUser = await usersCollection.findOne({ role: "admin" });
      const createdBy = adminUser ? new ObjectId(adminUser._id) : leadAssignees[0];

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

      let projectTasksCreated = 0;
      let projectSubtasksCreated = 0;

      // Create tasks
      for (let taskIndex = 0; taskIndex < DAILY_TASKS.length; taskIndex++) {
        const taskTitle = DAILY_TASKS[taskIndex];
        // First task gets deadline time of 10:00 AM, others get 23:00 (11 PM)
        const deadlineTime = taskIndex === 0 ? "10:00" : "23:00";

        // Find existing task by order (first task is order 0, second is order 1, etc.)
        // or by title if order doesn't match
        const existingTask = await Task.findOne({
          projectId: projectId,
          section: sectionName,
          $or: [
            { order: currentOrder + taskIndex },
            { title: taskTitle },
            // For first task, also check old title
            ...(taskIndex === 0 ? [{ title: "Make the daily tasks for this project before" }] : [])
          ]
        }).lean();

        if (existingTask) {
          // Update existing task: title, deadline, and ensure it's recurring
          const taskId = Array.isArray(existingTask) ? existingTask[0]?._id : (existingTask as any)?._id;
          if (!taskId) continue;
          await Task.updateOne(
            { _id: taskId },
            {
              $set: {
                title: taskTitle,
                deadlineTime: deadlineTime,
                taskKind: "daily",
                recurringPattern: {
                  frequency: "daily",
                  interval: 1,
                },
                updatedAt: new Date(),
              }
            }
          );
          console.log(`   🔄 Updated task: "${taskTitle}" (deadline: ${deadlineTime})`);

          // Update existing subtasks deadline time
          await Subtask.updateMany(
            { taskId: taskId },
            {
              $set: {
                deadlineTime: deadlineTime,
                taskKind: "daily",
                recurringPattern: {
                  frequency: "daily",
                  interval: 1,
                },
                updatedAt: new Date(),
              }
            }
          );

          // Create subtasks for existing task if missing
          for (const employeeId of employeesForSubtasks) {
            const existingSubtask = await Subtask.findOne({
              taskId: taskId,
              assignee: employeeId,
            }).lean();

            if (!existingSubtask) {
              const employeeUser = await usersCollection.findOne(
                { _id: employeeId },
                { projection: { name: 1 } }
              );
              const employeeName = employeeUser?.name || "Unknown";

              const lastSubtask = await Subtask.findOne({
                taskId: taskId,
              })
                .sort({ order: -1 })
                .lean();
              const subtaskOrder = lastSubtask && !Array.isArray(lastSubtask) ? ((lastSubtask as any)?.order || 0) + 1 : 0;

              const subtaskData: any = {
                taskId: taskId,
                projectId: projectId,
                title: taskTitle,
                description: "",
                assignee: employeeId,
                assigneeName: employeeName,
                taskKind: "daily",
                deadlineTime: deadlineTime, // First task: 10:00, others: 23:00
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
              projectSubtasksCreated++;
              totalSubtasksCreated++;
            }
          }
          continue;
        }

        // Create new task
        const taskData: any = {
          projectId: projectId,
          projectName: projectName,
          section: sectionName,
          title: taskTitle,
          description: "",
          taskKind: "daily",
          assignedTo: leadAssignees[0],
          assignedToName: leadAssigneeNames.join(", "),
          assignees: leadAssignees,
          assigneeNames: leadAssigneeNames,
          assignedDate: new Date(),
          deadlineTime: deadlineTime, // First task: 10:00, others: 23:00
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
        projectTasksCreated++;
        totalTasksCreated++;

        // Create subtasks
        for (const employeeId of employeesForSubtasks) {
          const employeeUser = await usersCollection.findOne(
            { _id: employeeId },
            { projection: { name: 1 } }
          );
          const employeeName = employeeUser?.name || "Unknown";

          const lastSubtask = await Subtask.findOne({
            taskId: savedTask._id,
          })
            .sort({ order: -1 })
            .lean();
          const subtaskOrder = lastSubtask && !Array.isArray(lastSubtask) ? ((lastSubtask as any)?.order || 0) + 1 : 0;

          const subtaskData: any = {
            taskId: savedTask._id,
            projectId: projectId,
            title: taskTitle,
            description: "",
            assignee: employeeId,
            assigneeName: employeeName,
            taskKind: "daily",
            deadlineTime: deadlineTime, // First task: 10:00, others: 23:00
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
          projectSubtasksCreated++;
          totalSubtasksCreated++;
        }
      }

      console.log(`   ✅ Created ${projectTasksCreated} tasks and ${projectSubtasksCreated} subtasks`);
      projectsProcessed++;
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total Projects: ${projects.length}`);
    console.log(`Projects Processed: ${projectsProcessed}`);
    console.log(`Projects Skipped: ${projectsSkipped}`);
    console.log(`Total Tasks Created: ${totalTasksCreated}`);
    console.log(`Total Subtasks Created: ${totalSubtasksCreated}`);
    console.log("=".repeat(50));
    console.log("\n✅ Seeding completed successfully!");

    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Error seeding daily tasks:", error);
    process.exit(1);
  }
}

// Run the script
seedDailyTasks();
