import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import Task from "@/models/Task";
import User from "@/models/User";

// GET - Fetch all tasks across all projects the employee has access to
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();
    if (!User) {
      throw new Error("User model not registered");
    }

    const userId = session.user.id;
    const client = await clientPromise;
    const db = client.db("worknest");

    // Find all projects the employee is assigned to
    const projects = await db.collection("projects").find({
      $or: [
        { leadAssignee: new ObjectId(userId) },
        { vaIncharge: new ObjectId(userId) },
        { updateIncharge: new ObjectId(userId) },
        { assignees: new ObjectId(userId) },
      ],
    }).toArray();

    if (projects.length === 0) {
      return NextResponse.json({
        success: true,
        tasks: {},
        projects: [],
      });
    }

    const projectIds = projects.map((p) => p._id);

    // Fetch ALL tasks for these projects
    const tasks = await Task.find({
      projectId: { $in: projectIds },
    })
      .sort({ projectId: 1, section: 1, order: 1, createdAt: 1 })
      .lean();

    // Fetch ALL subtasks for these tasks
    const taskIds = tasks.map((t: any) => t._id);
    const subtasks = await db.collection("subtasks").find({
      taskId: { $in: taskIds },
    })
      .sort({ createdAt: 1 })
      .toArray();

    // Manually populate user references
    const usersCollection = db.collection("users");
    const tasksCollection = db.collection("tasks");

    const populatedTasks = await Promise.all(
      tasks.map(async (task: any) => {
        // Populate assignedTo
        if (task.assignedTo) {
          try {
            const assignedToId =
              task.assignedTo instanceof ObjectId
                ? task.assignedTo
                : new ObjectId(task.assignedTo);
            const assignedUser = await usersCollection.findOne({
              _id: assignedToId,
            });
            if (assignedUser) {
              task.assignedTo = {
                _id: assignedUser._id.toString(),
                name: assignedUser.name || "Unknown",
                email: assignedUser.email || "",
              };
            }
          } catch (e) {
            console.error("Error populating assignedTo:", e);
            task.assignedTo = null;
          }
        }

        // Populate assignees array
        if (task.assignees && Array.isArray(task.assignees)) {
          task.assignees = await Promise.all(
            task.assignees.map(async (assigneeId: any) => {
              try {
                const assigneeObjId =
                  assigneeId instanceof ObjectId
                    ? assigneeId
                    : new ObjectId(assigneeId);
                const assigneeUser = await usersCollection.findOne({
                  _id: assigneeObjId,
                });
                if (assigneeUser) {
                  return {
                    _id: assigneeUser._id.toString(),
                    name: assigneeUser.name || "Unknown",
                    email: assigneeUser.email || "",
                  };
                }
              } catch (e) {
                console.error("Error populating assignee:", e);
              }
              return null;
            })
          );
          task.assignees = task.assignees.filter((a: any) => a !== null);
        }

        // Populate completedBy
        if (task.completedBy) {
          try {
            const completedById =
              task.completedBy instanceof ObjectId
                ? task.completedBy
                : new ObjectId(task.completedBy);
            const completedUser = await usersCollection.findOne({
              _id: completedById,
            });
            if (completedUser) {
              task.completedBy = {
                _id: completedUser._id.toString(),
                name: completedUser.name || "Unknown",
                email: completedUser.email || "",
              };
            }
          } catch (e) {
            console.error("Error populating completedBy:", e);
            task.completedBy = null;
          }
        }

        // Populate createdBy
        if (task.createdBy) {
          try {
            const createdById =
              task.createdBy instanceof ObjectId
                ? task.createdBy
                : new ObjectId(task.createdBy);
            const createdUser = await usersCollection.findOne({
              _id: createdById,
            });
            if (createdUser) {
              task.createdBy = {
                _id: createdUser._id.toString(),
                name: createdUser.name || "Unknown",
                email: createdUser.email || "",
              };
            }
          } catch (e) {
            console.error("Error populating createdBy:", e);
            task.createdBy = null;
          }
        }

        return task;
      })
    );

    // Populate subtasks with user info
    const subtasksMap = new Map();
    await Promise.all(
      subtasks.map(async (subtask: any) => {
        const taskIdStr = subtask.taskId.toString();
        
        // Populate assignee (single user, not array)
        if (subtask.assignee) {
          try {
            const assigneeId = subtask.assignee instanceof ObjectId ? subtask.assignee : new ObjectId(subtask.assignee);
            const assigneeUser = await usersCollection.findOne({ _id: assigneeId });
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
            const completedUser = await usersCollection.findOne({ _id: completedById });
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

    // Get project details
    const projectsMap = new Map();
    projects.forEach((p) => {
      projectsMap.set(p._id.toString(), {
        _id: p._id.toString(),
        projectName: p.projectName || "Unnamed Project",
        clientName: p.clientName || "Unknown Client",
        sections: p.sections || [],
        leadAssignee: p.leadAssignee || null, // Include leadAssignee for permission checks
      });
    });

    // Group tasks by project and section, and add canTick flag
    const tasksByProject: Record<string, Record<string, any[]>> = {};
    populatedTasks.forEach((task: any) => {
      const projectId = task.projectId.toString();
      const project = projectsMap.get(projectId);
      const projectName = project?.projectName || "Unknown Project";
      const section = task.section || "No Section";

      if (!tasksByProject[projectName]) {
        tasksByProject[projectName] = {};
      }
      if (!tasksByProject[projectName][section]) {
        tasksByProject[projectName][section] = [];
      }

      // Check if task is assigned to current user (for canTick flag)
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
      const canTick = isAssignedToUser || !task.assignedTo || (Array.isArray(task.assignees) && task.assignees.length === 0);

      // Attach subtasks to this task
      const taskIdStr = task._id.toString();
      const taskSubtasks = subtasksMap.get(taskIdStr) || [];

      tasksByProject[projectName][section].push({
        ...task,
        _id: task._id.toString(),
        projectId: projectId,
        projectName: projectName,
        subtasks: taskSubtasks,
        canTick: canTick,
      });
    });

    // Add empty sections from stored project sections
    projects.forEach((project) => {
      const projectName = project.projectName || "Unnamed Project";
      const storedSections = project.sections || [];
      
      if (!tasksByProject[projectName]) {
        tasksByProject[projectName] = {};
      }
      
      // Ensure all stored sections exist in the tasks object, even if empty
      storedSections.forEach((section: string) => {
        if (!tasksByProject[projectName][section]) {
          tasksByProject[projectName][section] = [];
        }
      });
    });

    return NextResponse.json({
      success: true,
      tasks: tasksByProject,
      projects: Array.from(projectsMap.values()),
    });
  } catch (error) {
    console.error("Error fetching all tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

