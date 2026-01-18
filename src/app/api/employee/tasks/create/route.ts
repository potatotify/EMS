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
      customRecurrence,
      assignedTo, // Optional: employee ID to assign task to (only if lead assignee)
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: "Project ID and title are required" }, { status: 400 });
    }

    await dbConnect();

    const userId = session.user.id;

    // Verify employee is part of this project
    const client = await clientPromise;
    const db = client.db("worknest");
    const userIdObj = new ObjectId(userId);
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      $or: [
        { leadAssignee: userIdObj },
        { leadAssignee: { $in: [userIdObj] } }, // Multiple lead assignees
        { vaIncharge: userIdObj }, // Single VA incharge (legacy)
        { vaIncharge: { $in: [userIdObj] } }, // Multiple VA incharges
        { updateIncharge: userIdObj },
        { assignees: userIdObj }, // Check if user is in assignees array
      ],
    });

    if (!project) {
      return NextResponse.json({ error: "You are not assigned to this project" }, { status: 403 });
    }

    // Check if user is the lead assignee (can be array or single)
    let isLeadAssignee = false;
    if (project.leadAssignee) {
      if (Array.isArray(project.leadAssignee)) {
        const leadIds = project.leadAssignee.map((lead: any) => {
          if (lead instanceof ObjectId) {
            return lead.toString();
          } else if (typeof lead === 'object' && lead._id) {
            return lead._id.toString();
          } else if (typeof lead === 'object') {
            return lead.toString();
          } else {
            return lead.toString();
          }
        });
        isLeadAssignee = leadIds.includes(userId);
      } else {
        let leadId: string;
        if (project.leadAssignee instanceof ObjectId) {
          leadId = project.leadAssignee.toString();
        } else if (typeof project.leadAssignee === 'object' && project.leadAssignee._id) {
          leadId = project.leadAssignee._id.toString();
        } else if (typeof project.leadAssignee === 'object') {
          leadId = project.leadAssignee.toString();
        } else {
          leadId = project.leadAssignee.toString();
        }
        isLeadAssignee = leadId === userId;
      }
    }

    // Determine who to assign the task to
    let taskAssigneeId: ObjectId;
    if (assignedTo && assignedTo !== userId && assignedTo.trim() !== '') {
      // Employee wants to assign task to someone else
      if (!isLeadAssignee) {
        return NextResponse.json({ 
          error: "Only the lead assignee can assign tasks to other employees" 
        }, { status: 403 });
      }
      
      // Verify the target employee is assigned to this project
      const targetUserIdObj = new ObjectId(assignedTo);
      const targetIdStr = assignedTo;
      
      let targetIsInProject = false;
      
      // Check lead assignee (can be array or single)
      if (project.leadAssignee) {
        if (Array.isArray(project.leadAssignee)) {
          const leadIds = project.leadAssignee.map((lead: any) => {
            if (typeof lead === 'object') {
              return lead._id?.toString() || lead.toString();
            }
            return lead.toString();
          });
          if (leadIds.includes(targetIdStr)) targetIsInProject = true;
        } else {
          const leadId = typeof project.leadAssignee === 'object' 
            ? (project.leadAssignee._id?.toString() || project.leadAssignee.toString())
            : project.leadAssignee.toString();
          if (leadId === targetIdStr) targetIsInProject = true;
        }
      }
      
      // Check VA incharge (can be array or single)
      if (!targetIsInProject && project.vaIncharge) {
        if (Array.isArray(project.vaIncharge)) {
          const vaIds = project.vaIncharge.map((va: any) => {
            if (typeof va === 'object') {
              return va._id?.toString() || va.toString();
            }
            return va.toString();
          });
          if (vaIds.includes(targetIdStr)) targetIsInProject = true;
        } else {
          const vaId = typeof project.vaIncharge === 'object'
            ? (project.vaIncharge._id?.toString() || project.vaIncharge.toString())
            : project.vaIncharge.toString();
          if (vaId === targetIdStr) targetIsInProject = true;
        }
      }
      
      // Check update incharge
      if (!targetIsInProject && project.updateIncharge) {
        const updateId = typeof project.updateIncharge === 'object'
          ? (project.updateIncharge._id?.toString() || project.updateIncharge.toString())
          : project.updateIncharge.toString();
        if (updateId === targetIdStr) targetIsInProject = true;
      }
      
      // Check assignees array
      if (!targetIsInProject && Array.isArray(project.assignees)) {
        targetIsInProject = project.assignees.some((a: any) => {
          const aId = typeof a === 'object' 
            ? (a._id?.toString() || a.toString())
            : a.toString();
          return aId === targetIdStr;
        });
      }

      if (!targetIsInProject) {
        return NextResponse.json({ 
          error: "The selected employee is not assigned to this project" 
        }, { status: 403 });
      }

      taskAssigneeId = targetUserIdObj;
    } else {
      // Assign to self (default)
      taskAssigneeId = userIdObj;
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

    // For daily tasks, ALWAYS set deadlineDate to today in IST (ignore any provided deadlineDate)
    // For other recurring tasks, set to today if deadlineTime is set but deadlineDate is not
    let finalDeadlineDate = deadlineDate;
    if (taskKind === "daily" && deadlineTime) {
      // For daily tasks, ALWAYS use today's date in IST, regardless of what's provided
      const now = new Date();
      const istFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      finalDeadlineDate = istFormatter.format(now); // Returns YYYY-MM-DD in IST
    } else if ((["weekly", "monthly"].includes(taskKind || "")) && deadlineTime && !deadlineDate) {
      // For weekly/monthly tasks, use today if deadlineDate not provided
      const now = new Date();
      const istFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      finalDeadlineDate = istFormatter.format(now); // Returns YYYY-MM-DD in IST
    }

    // Create task - employee-created tasks have no bonus/penalty
    const newTask = new Task({
      projectId: new ObjectId(projectId),
      projectName: projectName || project.projectName || "",
      section: section || "No Section",
      title,
      description: description || "",
      taskKind: taskKind || "one-time",
      assignedTo: taskAssigneeId, // Assigned to selected employee or creator
      assignees: [taskAssigneeId],
      assignedDate,
      assignedTime,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      dueTime: dueTime || undefined,
      deadlineDate: finalDeadlineDate ? new Date(finalDeadlineDate) : undefined,
      deadlineTime: deadlineTime || undefined,
      priority: priority || 2,
      // No bonusPoints or penaltyPoints for employee-created tasks
      status: "pending",
      order: maxOrderTaskAny ? (maxOrderTaskAny.order || 0) + 1 : 0,
      createdBy: new ObjectId(userId),
      createdByEmployee: true, // Flag to distinguish employee-created tasks
      customRecurrence: taskKind === "custom" && customRecurrence ? {
        type: customRecurrence.type || "daysOfWeek",
        daysOfWeek: customRecurrence.daysOfWeek || [],
        daysOfMonth: customRecurrence.daysOfMonth || [],
        recurring: customRecurrence.recurring || false,
      } : undefined,
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

    if (newTask.customRecurrence) {
      newTask.markModified("customRecurrence");
    }

    await newTask.save();

    // Populate assignedTo
    const usersCollection = db.collection("users");
    let populatedAssignedTo = null;
    try {
      const user = await usersCollection.findOne(
        { _id: taskAssigneeId },
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

