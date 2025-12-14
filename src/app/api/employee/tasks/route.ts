import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import Task from "@/models/Task";
import User from "@/models/User";

// GET - Fetch tasks for a project (employee view)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    await dbConnect();
    // Ensure User model is registered
    if (!User) {
      throw new Error("User model not registered");
    }

    const userId = session.user.id;

    // Check if employee is part of this project
    const client = await clientPromise;
    const db = client.db("worknest");
    const userIdObj = new ObjectId(userId);
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      $or: [
        { leadAssignee: userIdObj },
        { vaIncharge: userIdObj },
        { updateIncharge: userIdObj },
        { assignees: userIdObj }, // Check if user is in assignees array
      ],
    });

    if (!project) {
      return NextResponse.json({ error: "You are not assigned to this project" }, { status: 403 });
    }

    // Fetch ALL tasks for the project (not just assigned ones)
    const tasks = await Task.find({ projectId: new ObjectId(projectId) })
      .sort({ section: 1, order: 1, createdAt: 1 })
      .lean();

    // Fetch ALL subtasks for the project tasks
    const tasksCollection = db.collection("tasks");
    const taskIds = tasks.map((t: any) => t._id);
    const subtasks = await db.collection("subtasks").find({
      taskId: { $in: taskIds },
    })
      .sort({ createdAt: 1 })
      .toArray();

    // Manually populate user references
    const usersCollection = db.collection("users");

    const populatedTasks = await Promise.all(
      tasks.map(async (task: any) => {
        // Populate assignedTo
        if (task.assignedTo) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.assignedTo instanceof ObjectId ? task.assignedTo : new ObjectId(task.assignedTo) },
              { projection: { name: 1, email: 1 } }
            );
            if (user) {
              task.assignedTo = {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
              };
            } else {
              task.assignedTo = null;
            }
          } catch (e) {
            task.assignedTo = null;
          }
        }

        // Populate createdBy
        if (task.createdBy) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.createdBy instanceof ObjectId ? task.createdBy : new ObjectId(task.createdBy) },
              { projection: { name: 1, email: 1 } }
            );
            if (user) {
              task.createdBy = {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
              };
            } else {
              task.createdBy = null;
            }
          } catch (e) {
            task.createdBy = null;
          }
        }

        // Populate completedBy
        if (task.completedBy) {
          try {
            const user = await usersCollection.findOne(
              { _id: task.completedBy instanceof ObjectId ? task.completedBy : new ObjectId(task.completedBy) },
              { projection: { name: 1, email: 1 } }
            );
            if (user) {
              task.completedBy = {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
              };
            } else {
              task.completedBy = null;
            }
          } catch (e) {
            task.completedBy = null;
          }
        }

        return task;
      })
    );

    // Populate subtasks with user info and group by task
    const subtasksMap = new Map();
    await Promise.all(
      subtasks.map(async (subtask: any) => {
        const taskIdStr = subtask.taskId.toString();
        
        // Populate assignee (single user, not array)
        if (subtask.assignee) {
          try {
            const assigneeId = subtask.assignee instanceof ObjectId ? subtask.assignee : new ObjectId(subtask.assignee);
            const assigneeUser = await usersCollection.findOne(
              { _id: assigneeId },
              { projection: { name: 1, email: 1 } }
            );
            if (assigneeUser) {
              subtask.assignee = {
                _id: assigneeUser._id.toString(),
                name: assigneeUser.name || "Unknown",
                email: assigneeUser.email || "",
              };
              subtask.assigneeName = assigneeUser.name || "Unknown";
            }
          } catch (e) {
            console.error("Error populating assignee:", e);
            subtask.assignee = null;
          }
        }

        // Populate completedBy
        if (subtask.completedBy) {
          try {
            const completedById = subtask.completedBy instanceof ObjectId ? subtask.completedBy : new ObjectId(subtask.completedBy);
            const completedUser = await usersCollection.findOne(
              { _id: completedById },
              { projection: { name: 1, email: 1 } }
            );
            if (completedUser) {
              subtask.completedBy = {
                _id: completedUser._id.toString(),
                name: completedUser.name || "Unknown",
                email: completedUser.email || "",
              };
            }
          } catch (e) {
            console.error("Error populating completedBy:", e);
            subtask.completedBy = null;
          }
        }

        const populatedSubtask = {
          ...subtask,
          _id: subtask._id.toString(),
          taskId: taskIdStr,
        };

        if (!subtasksMap.has(taskIdStr)) {
          subtasksMap.set(taskIdStr, []);
        }
        subtasksMap.get(taskIdStr).push(populatedSubtask);
      })
    );

    // Show ALL tasks for the project (no filtering by assignment)
    // But mark which tasks the employee can tick (assigned to them)
    const filteredTasks = populatedTasks.map((task: any) => {
      // Check if task is assigned to current user
      let isAssignedToUser = false;
      
      if (task.assignedTo) {
        let assignedToId: string | null = null;
        if (typeof task.assignedTo === 'string') {
          assignedToId = task.assignedTo;
        } else if (task.assignedTo && typeof task.assignedTo === 'object') {
          assignedToId = task.assignedTo._id || task.assignedTo.toString();
        }
        if (assignedToId && userId && assignedToId.toString() === userId.toString()) {
          isAssignedToUser = true;
        }
      }

      // Check multi-assignees
      if (!isAssignedToUser && Array.isArray(task.assignees) && userId) {
        const userIdStr = userId.toString();
        isAssignedToUser = task.assignees.some((assignee: any) => {
          if (!assignee) return false;
          if (typeof assignee === 'string') return assignee === userIdStr;
          if (assignee._id) return assignee._id.toString() === userIdStr;
          if (assignee.toString) return assignee.toString() === userIdStr;
          return false;
        });
      }

      // Add flag to indicate if employee can tick this task
      task.canTick = isAssignedToUser || !task.assignedTo || (Array.isArray(task.assignees) && task.assignees.length === 0);
      
      return task;
    });

    // Group tasks by section
    const tasksBySection: Record<string, any[]> = {};
    filteredTasks.forEach((task: any) => {
      const section = task.section || "No Section";
      if (!tasksBySection[section]) {
        tasksBySection[section] = [];
      }
      
      // Attach subtasks to this task
      const taskIdStr = task._id.toString();
      const taskSubtasks = subtasksMap.get(taskIdStr) || [];
      
      tasksBySection[section].push({
        ...task,
        _id: task._id.toString(),
        projectId: task.projectId.toString(),
        subtasks: taskSubtasks,
      });
    });

    // Add empty sections from stored project sections
    const storedSections = project.sections || [];
    storedSections.forEach((section: string) => {
      if (!tasksBySection[section]) {
        tasksBySection[section] = [];
      }
    });

    // Merge task-based sections with stored sections
    const allSections = [...new Set([...Object.keys(tasksBySection), ...storedSections])];

    return NextResponse.json({
      success: true,
      tasks: tasksBySection,
      sections: allSections,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
