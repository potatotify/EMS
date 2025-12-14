import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import Task from "@/models/Task";
import User from "@/models/User"; // Import User model to register schema

// GET - Fetch tasks for a project
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
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

    const tasks = await Task.find({ projectId: new ObjectId(projectId) })
      .sort({ section: 1, order: 1, createdAt: 1 })
      .lean();

    // Manually populate user references
    const client = await clientPromise;
    const db = client.db("worknest");
    const usersCollection = db.collection("users");

    const populatedTasks = await Promise.all(
      tasks.map(async (task: any) => {
        // Populate assignees (multi-assign)
        if (Array.isArray(task.assignees) && task.assignees.length > 0) {
          try {
            const assigneeIds = task.assignees.map((id: any) =>
              id instanceof ObjectId ? id : new ObjectId(id)
            );
            const assignees = await usersCollection
              .find(
                { _id: { $in: assigneeIds } },
                { projection: { name: 1, email: 1 } }
              )
              .toArray();

            task.assignees = assignees.map((u) => ({
              _id: u._id.toString(),
              name: u.name,
              email: u.email,
            }));

            // Build combined names for display/grouping
            const names = assignees.map((u) => u.name).filter(Boolean);
            if (names.length > 0) {
              task.assigneeNames = names;
              task.assignedToName = names.join(", ");
            }
          } catch (e) {
            // Keep raw assignees if population fails
          }
        } else if (task.assignedTo) {
          // Fallback: single assignedTo
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
              task.assignedToName = task.assignedToName || user.name;
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

    // Group tasks by section
    const tasksBySection: Record<string, any[]> = {};
    populatedTasks.forEach((task: any) => {
      const section = task.section || "No Section";
      if (!tasksBySection[section]) {
        tasksBySection[section] = [];
      }
      tasksBySection[section].push({
        ...task,
        _id: task._id.toString(),
        projectId: task.projectId.toString(),
        createdByEmployee: task.createdByEmployee || false,
      });
    });

    // Get project to fetch stored sections (including empty ones)
    const projectsCollection = db.collection("projects");
    const project = await projectsCollection.findOne({ _id: new ObjectId(projectId) });
    const storedSections = project?.sections || [];
    
    // Merge task sections with stored sections
    const allSections = [...new Set([...Object.keys(tasksBySection), ...storedSections])];
    
    // Ensure all sections have an entry in tasksBySection (even if empty)
    allSections.forEach(section => {
      if (!tasksBySection[section]) {
        tasksBySection[section] = [];
      }
    });

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

// POST - Create a new task
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const {
      projectId,
      projectName,
      section,
      title,
      description,
      taskKind,
      assignedTo, // single assignee (backward compatibility)
      assignees,  // multiple assignees (array of user IDs)
      assignedDate,
      assignedTime,
      dueDate,
      dueTime,
      deadlineDate,
      deadlineTime,
      priority,
      bonusPoints,
      bonusCurrency,
      penaltyPoints,
      penaltyCurrency,
      recurringPattern,
      customRecurrence,
      customFields,
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: "Project ID and title are required" }, { status: 400 });
    }

    await dbConnect();
    // Ensure User model is registered
    if (!User) {
      throw new Error("User model not registered");
    }

    // Get project details
    const client = await clientPromise;
    const db = client.db("worknest");
    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get assigned employee details if provided
    let primaryAssignedTo: ObjectId | undefined = undefined;
    let assignedToName: string | null = null;
    let assigneeIds: ObjectId[] = [];
    let assigneeNames: string[] = [];

    // Normalize assignees: only allow single employee assignment
    let assigneeInput: string[] = [];
    if (Array.isArray(assignees) && assignees.length > 0) {
      // Only take the first assignee if multiple are provided
      assigneeInput = [assignees[0]].filter(Boolean);
    } else if (assignedTo) {
      assigneeInput = [assignedTo];
    }

    if (assigneeInput.length > 0) {
      // Only process the first (and only) assignee
      const objectId = new ObjectId(assigneeInput[0]);
      const employee = await db
        .collection("users")
        .findOne({ _id: objectId }, { projection: { name: 1, email: 1 } });

      if (employee) {
        assigneeIds = [objectId];
        assigneeNames = [employee.name || ""].filter(Boolean);
        primaryAssignedTo = objectId;
        assignedToName = assigneeNames.length > 0 ? assigneeNames[0] : null;
      }
    }

    // Get max order for the section
    const maxOrderTask = await Task.findOne({
      projectId: new ObjectId(projectId),
      section: section || "No Section",
    })
      .sort({ order: -1 })
      .lean();

    // Type assertion for maxOrderTask
    const maxOrderTaskAny = maxOrderTask as any;

    const newTask = new Task({
      projectId: new ObjectId(projectId),
      projectName: projectName || project.projectName,
      section: section || "No Section",
      title,
      description: description || "",
      taskKind: taskKind || "one-time",
      assignedTo: primaryAssignedTo,
      assignedToName,
      assignees: assigneeIds.length ? [assigneeIds[0]] : undefined, // Only first assignee
      assigneeNames: assigneeNames.length ? [assigneeNames[0]] : undefined, // Only first assignee name
      assignedDate: assignedDate ? new Date(assignedDate) : undefined,
      assignedTime: assignedTime || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      dueTime: dueTime || undefined,
      deadlineDate: deadlineDate ? new Date(deadlineDate) : undefined,
      deadlineTime: deadlineTime || undefined,
      priority: priority || 2,
      bonusPoints: bonusPoints || 0,
      bonusCurrency: bonusCurrency || 0,
      penaltyPoints: penaltyPoints || 0,
      penaltyCurrency: penaltyCurrency || 0,
      recurringPattern: recurringPattern || undefined,
      customRecurrence: taskKind === "custom" && customRecurrence ? {
        type: customRecurrence.type || "daysOfWeek",
        daysOfWeek: customRecurrence.daysOfWeek || [],
        daysOfMonth: customRecurrence.daysOfMonth || [],
        recurring: customRecurrence.recurring || false,
      } : undefined,
      customFields: customFields && Array.isArray(customFields) && customFields.length > 0
        ? customFields
            .filter((f: any) => f && f.name && f.name.trim() !== "" && f.type) // Only include valid fields
            .map((f: any) => ({
              name: String(f.name).trim(),
              type: f.type,
              defaultValue: f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== "" 
                ? f.defaultValue 
                : undefined,
            }))
        : undefined,
      order: maxOrderTaskAny ? (maxOrderTaskAny.order || 0) + 1 : 0,
      createdBy: new ObjectId(session.user.id),
      status: "pending",
    });

    // Explicitly mark customFields as modified to ensure it's saved
    if (newTask.customFields) {
      newTask.markModified("customFields");
    }
    
    if (newTask.customRecurrence) {
      newTask.markModified("customRecurrence");
    }
    
    await newTask.save();
    
    console.log("New task created. CustomFields:", newTask.customFields);

    // Manually populate instead of using Mongoose populate to avoid schema issues
    let populatedAssignedTo = null;
    let populatedCreatedBy = null;

    if (newTask.assignedTo) {
      const assignedUser = await db.collection("users").findOne(
        { _id: newTask.assignedTo },
        { projection: { name: 1, email: 1 } }
      );
      if (assignedUser) {
        populatedAssignedTo = {
          _id: assignedUser._id.toString(),
          name: assignedUser.name,
          email: assignedUser.email,
        };
      }
    }

    if (newTask.createdBy) {
      const createdUser = await db.collection("users").findOne(
        { _id: newTask.createdBy },
        { projection: { name: 1, email: 1 } }
      );
      if (createdUser) {
        populatedCreatedBy = {
          _id: createdUser._id.toString(),
          name: createdUser.name,
          email: createdUser.email,
        };
      }
    }

    const populatedTask = {
      ...newTask.toObject(),
      assignedTo: populatedAssignedTo,
      createdBy: populatedCreatedBy,
    };

    return NextResponse.json({
      success: true,
      task: {
        ...populatedTask,
        _id: populatedTask._id.toString(),
        projectId: populatedTask.projectId.toString(),
        assignedTo: populatedAssignedTo,
        createdBy: populatedCreatedBy,
        customFields: newTask.customFields || [],
        customFieldValues: newTask.customFieldValues || {},
      },
    });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

