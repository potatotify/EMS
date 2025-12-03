import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import Task from "@/models/Task";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
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
      priority,
      dueDate,
      dueTime,
      deadlineDate,
      deadlineTime,
      customFields,
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: "Project ID and title are required" }, { status: 400 });
    }

    await dbConnect();

    const userId = session.user.id;

    // Verify employee is part of this project
    const client = await clientPromise;
    const db = client.db("worknest");
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      $or: [
        { leadAssignee: new ObjectId(userId) },
        { vaIncharge: new ObjectId(userId) },
        { updateIncharge: new ObjectId(userId) },
      ],
    });

    if (!project) {
      return NextResponse.json({ error: "You are not assigned to this project" }, { status: 403 });
    }

    // Get max order for the section
    const maxOrderTask = await Task.findOne({ projectId: new ObjectId(projectId), section: section || "No Section" })
      .sort({ order: -1 })
      .lean();

    // Type assertion for maxOrderTask
    const maxOrderTaskAny = maxOrderTask as any;

    const now = new Date();
    const assignedDate = now.toISOString().split("T")[0];
    const assignedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Create task - employee-created tasks have no bonus/penalty and are assigned to the creator
    const newTask = new Task({
      projectId: new ObjectId(projectId),
      projectName: projectName || project.projectName || "",
      section: section || "No Section",
      title,
      description: description || "",
      taskKind: taskKind || "one-time",
      assignedTo: new ObjectId(userId), // Employee who creates it
      assignees: [new ObjectId(userId)],
      assignedDate,
      assignedTime,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      dueTime: dueTime || undefined,
      deadlineDate: deadlineDate ? new Date(deadlineDate) : undefined,
      deadlineTime: deadlineTime || undefined,
      priority: priority || 2,
      // No bonusPoints or penaltyPoints for employee-created tasks
      status: "pending",
      order: maxOrderTaskAny ? (maxOrderTaskAny.order || 0) + 1 : 0,
      createdBy: new ObjectId(userId),
      createdByEmployee: true, // Flag to distinguish employee-created tasks
      customFields: customFields && Array.isArray(customFields) && customFields.length > 0
        ? customFields
            .filter((f: any) => f && f.name && f.name.trim() !== "" && f.type)
            .map((f: any) => ({
              name: String(f.name).trim(),
              type: f.type,
              defaultValue: f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== "" 
                ? f.defaultValue 
                : undefined,
            }))
        : undefined,
    });

    if (newTask.customFields) {
      newTask.markModified("customFields");
    }

    await newTask.save();

    // Populate assignedTo
    const usersCollection = db.collection("users");
    let populatedAssignedTo = null;
    try {
      const user = await usersCollection.findOne(
        { _id: new ObjectId(userId) },
        { projection: { name: 1, email: 1 } }
      );
      if (user) {
        populatedAssignedTo = {
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
        };
      }
    } catch (e) {
      // Ignore
    }

    const taskObj = newTask.toObject();

    return NextResponse.json({
      success: true,
      task: {
        ...taskObj,
        _id: taskObj._id.toString(),
        projectId: taskObj.projectId.toString(),
        assignedTo: populatedAssignedTo,
        canTick: true, // Employee can always tick their own tasks
        createdByEmployee: true,
      },
    });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

