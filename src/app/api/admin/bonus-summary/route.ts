import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import DailyUpdate from "@/models/DailyUpdate";
import ChecklistConfig from "@/models/ChecklistConfig";
import Task from "@/models/Task";
import Subtask from "@/models/Subtask";
import TaskCompletion from "@/models/TaskCompletion";
import SubtaskCompletion from "@/models/SubtaskCompletion";

// Helper function to parse "What Employee Got" string and extract bonus/fine amounts
// Examples: "+₹10 Bonus", "-₹50 Fine", "+10 Reward", "-45 Penalty", "0 Points", "Not Completed"
function parseEmployeeGot(employeeGot: string): { bonusPoints: number; bonusCurrency: number; finePoints: number; fineCurrency: number } {
  const result = {
    bonusPoints: 0,
    bonusCurrency: 0,
    finePoints: 0,
    fineCurrency: 0,
  };

  if (!employeeGot || employeeGot === "Not Completed" || employeeGot === "0 Points") {
    return result;
  }

  // Match patterns like: +₹10 Bonus, -₹50 Fine, +10 Reward, -45 Penalty
  const currencyMatch = employeeGot.match(/[+-]₹(\d+)\s*(Bonus|Fine)/);
  const pointsMatch = employeeGot.match(/[+-](\d+)\s*(Reward|Penalty)/);

  if (currencyMatch) {
    const amount = parseFloat(currencyMatch[1]);
    const type = currencyMatch[2].toLowerCase();
    if (type === "bonus") {
      result.bonusCurrency = amount;
    } else if (type === "fine") {
      result.fineCurrency = amount;
    }
  } else if (pointsMatch) {
    const amount = parseFloat(pointsMatch[1]);
    const type = pointsMatch[2].toLowerCase();
    if (type === "reward") {
      result.bonusPoints = amount;
    } else if (type === "penalty") {
      result.finePoints = amount;
    }
  }

  return result;
}

// Helper function to fetch task analysis data directly from the task analysis API
// This ensures we use the exact same logic and data as the task analysis page
async function fetchTaskAnalysisData(startDate: Date, endDate: Date, db: any) {
  // Import task analysis models
  const Task = (await import("@/models/Task")).default;
  const Subtask = (await import("@/models/Subtask")).default;
  const TaskCompletion = (await import("@/models/TaskCompletion")).default;
  const SubtaskCompletion = (await import("@/models/SubtaskCompletion")).default;
  
  // Reuse the same logic as task analysis API to get all task/subtask entries
  // This ensures consistency with the task analysis page
  
  // Fetch task completions (same query as task analysis)
  const allTaskCompletions = await TaskCompletion.find({
    $or: [
      { tickedAt: { $exists: true, $ne: null } },
      { notTicked: true, approvalStatus: "deadline_passed" }
    ]
  })
    .sort({ createdAt: -1 })
    .lean();
  
  // Fetch subtask completions
  const allSubtaskCompletions = await SubtaskCompletion.find({})
    .sort({ createdAt: -1 })
    .lean();
  
  // Deduplicate (same logic as task analysis)
  const taskCompletionMap = new Map<string, any>();
  for (const completion of allTaskCompletions) {
    if (!completion.taskId) continue;
    const taskId = completion.taskId.toString();
    const existing = taskCompletionMap.get(taskId);
    const completionDate = completion.tickedAt ? new Date(completion.tickedAt) : new Date(completion.createdAt);
    const existingDate = existing?.tickedAt ? new Date(existing.tickedAt) : (existing?.createdAt ? new Date(existing.createdAt) : null);
    if (!existing || !existingDate || completionDate > existingDate) {
      taskCompletionMap.set(taskId, completion);
    }
  }
  
  const subtaskCompletionMap = new Map<string, any>();
  for (const completion of allSubtaskCompletions) {
    if (!completion.subtaskId) continue;
    const subtaskId = completion.subtaskId.toString();
    const existing = subtaskCompletionMap.get(subtaskId);
    const completionDate = completion.tickedAt ? new Date(completion.tickedAt) : new Date(completion.createdAt);
    const existingDate = existing?.tickedAt ? new Date(existing.tickedAt) : (existing?.createdAt ? new Date(existing.createdAt) : null);
    if (!existing || !existingDate || completionDate > existingDate) {
      subtaskCompletionMap.set(subtaskId, completion);
    }
  }
  
  const tasksWithCompletions = new Set(
    Array.from(taskCompletionMap.values())
      .filter((tc: any) => tc.taskId)
      .map((tc: any) => tc.taskId.toString())
  );
  
  const subtasksWithCompletions = new Set(
    Array.from(subtaskCompletionMap.values())
      .filter((sc: any) => sc.subtaskId)
      .map((sc: any) => sc.subtaskId.toString())
  );
  
  // Fetch active tasks (same as task analysis)
  const tasks = await Task.find({
    $or: [
      { taskKind: { $in: ["daily", "weekly", "monthly"] } },
      { _id: { $nin: Array.from(tasksWithCompletions).map(id => new ObjectId(id)) } }
    ],
    status: "completed",
    tickedAt: { $exists: true, $ne: null }
  }).lean();
  
  // Fetch active subtasks (same as task analysis)
  const subtasks = await db.collection("subtasks").find({
    $or: [
      { ticked: true },
      { tickedAt: { $exists: true, $ne: null } }
    ],
    _id: { $nin: Array.from(subtasksWithCompletions).map(id => new ObjectId(id)) }
  }).toArray();
  
  const taskAnalysisRows: any[] = [];
  const usersCollection = db.collection("users");
  const projectsCollection = db.collection("projects");
  const tasksCollection = db.collection("tasks");
  
  // Batch fetch all task IDs and project IDs for status checks
  const taskIdsToCheck = Array.from(taskCompletionMap.values())
    .filter((c: any) => c.taskId)
    .map((c: any) => c.taskId instanceof ObjectId ? c.taskId : new ObjectId(c.taskId));
  
  const projectIdsToCheck = Array.from(taskCompletionMap.values())
    .filter((c: any) => c.projectId)
    .map((c: any) => c.projectId instanceof ObjectId ? c.projectId : new ObjectId(c.projectId));
  
  // Batch fetch task statuses
  const tasksStatusMap = new Map<string, any>();
  if (taskIdsToCheck.length > 0) {
    const tasks = await tasksCollection.find(
      { _id: { $in: taskIdsToCheck } },
      { projection: { _id: 1, status: 1, tickedAt: 1, completedAt: 1 } }
    ).toArray();
    for (const task of tasks) {
      tasksStatusMap.set(task._id.toString(), task);
    }
  }
  
  // Batch fetch project statuses
  const projectsStatusMap = new Map<string, string>();
  if (projectIdsToCheck.length > 0) {
    const projects = await projectsCollection.find(
      { _id: { $in: projectIdsToCheck } },
      { projection: { _id: 1, status: 1 } }
    ).toArray();
    for (const project of projects) {
      projectsStatusMap.set(project._id.toString(), project.status || null);
    }
  }
  
  // Process task completions - extract employeeGot and date
  for (const completion of taskCompletionMap.values()) {
    // Check if task still exists and is ticked (using cached data)
    if (completion.taskId) {
      const taskId = completion.taskId.toString();
      const originalTask = tasksStatusMap.get(taskId);
      if (!originalTask) continue;
      
      const taskStillTicked = !!(originalTask.tickedAt || originalTask.completedAt || originalTask.status === "completed");
      if (!taskStillTicked) continue;
    }
    
    // Check project status (using cached data)
    let projectStatus = null;
    if (completion.projectId) {
      const projectId = completion.projectId.toString();
      projectStatus = projectsStatusMap.get(projectId) || null;
    }
    
    if (projectStatus !== "active") continue;
    
    // Calculate employeeGot (same as task analysis)
    const employeeGot = calculateEmployeeGotFromCompletion(completion);
    const parsed = parseEmployeeGot(employeeGot);
    
    // Get employee ID
    const employeeIds = new Set<string>();
    if (Array.isArray(completion.assignees) && completion.assignees.length > 0) {
      for (const id of completion.assignees) {
        if (id) employeeIds.add(id.toString());
      }
    } else if (completion.assignedTo) {
      employeeIds.add(completion.assignedTo.toString());
    } else if (completion.completedBy) {
      employeeIds.add(completion.completedBy.toString());
    }
    
    // Determine date for attribution
    let completionDate: Date | null = null;
    if (completion.approvalStatus === "deadline_passed") {
      if (completion.deadlineDate) {
        completionDate = new Date(completion.deadlineDate);
      } else if (completion.assignedDate) {
        completionDate = new Date(completion.assignedDate);
      } else {
        completionDate = completion.tickedAt ? new Date(completion.tickedAt) : new Date(completion.createdAt);
      }
    } else {
      completionDate = completion.tickedAt ? new Date(completion.tickedAt) : (completion.completedAt ? new Date(completion.completedAt) : new Date(completion.createdAt));
    }
    
    // Normalize dates for comparison
    const completionDateNormalized = new Date(completionDate);
    completionDateNormalized.setHours(0, 0, 0, 0);
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(23, 59, 59, 999);
    
    if (completionDateNormalized < startDateNormalized || completionDateNormalized > endDateNormalized) {
      continue;
    }
    
    for (const empId of employeeIds) {
      taskAnalysisRows.push({
        employeeId: empId,
        date: completionDate,
        bonusPoints: parsed.bonusPoints,
        bonusCurrency: parsed.bonusCurrency,
        finePoints: parsed.finePoints,
        fineCurrency: parsed.fineCurrency,
        rewardTotal: completion.bonusPoints || 0,
        rewardTotalCurrency: completion.bonusCurrency || 0,
      });
    }
  }
  
  // Batch fetch subtask IDs and parent task IDs for status checks
  const subtaskIdsToCheck = Array.from(subtaskCompletionMap.values())
    .filter((c: any) => c.subtaskId)
    .map((c: any) => c.subtaskId instanceof ObjectId ? c.subtaskId : new ObjectId(c.subtaskId));
  
  const parentTaskIdsToCheck = Array.from(subtaskCompletionMap.values())
    .filter((c: any) => c.taskId)
    .map((c: any) => c.taskId instanceof ObjectId ? c.taskId : new ObjectId(c.taskId));
  
  // Batch fetch subtask statuses
  const subtasksStatusMap = new Map<string, any>();
  if (subtaskIdsToCheck.length > 0) {
    const subtasks = await db.collection("subtasks").find(
      { _id: { $in: subtaskIdsToCheck } },
      { projection: { _id: 1, status: 1, tickedAt: 1, completedAt: 1, ticked: 1 } }
    ).toArray();
    for (const subtask of subtasks) {
      subtasksStatusMap.set(subtask._id.toString(), subtask);
    }
  }
  
  // Batch fetch parent tasks to get project IDs
  const parentTasksMap = new Map<string, any>();
  if (parentTaskIdsToCheck.length > 0) {
    const parentTasks = await tasksCollection.find(
      { _id: { $in: parentTaskIdsToCheck } },
      { projection: { _id: 1, projectId: 1 } }
    ).toArray();
    for (const task of parentTasks) {
      parentTasksMap.set(task._id.toString(), task);
    }
  }
  
  // Get all unique project IDs from subtask completions
  const subtaskProjectIds = new Set<string>();
  for (const completion of subtaskCompletionMap.values()) {
    if (completion.projectId) {
      subtaskProjectIds.add(completion.projectId.toString());
    } else if (completion.taskId) {
      const parentTask = parentTasksMap.get(completion.taskId.toString());
      if (parentTask && parentTask.projectId) {
        subtaskProjectIds.add(parentTask.projectId.toString());
      }
    }
  }
  
  // Batch fetch project statuses for subtasks
  const subtaskProjectsStatusMap = new Map<string, string>();
  if (subtaskProjectIds.size > 0) {
    const subtaskProjects = await projectsCollection.find(
      { _id: { $in: Array.from(subtaskProjectIds).map(id => new ObjectId(id)) } },
      { projection: { _id: 1, status: 1 } }
    ).toArray();
    for (const project of subtaskProjects) {
      subtaskProjectsStatusMap.set(project._id.toString(), project.status || null);
    }
  }
  
  // Process subtask completions
  for (const completion of subtaskCompletionMap.values()) {
    // Check if subtask still exists and is ticked (using cached data)
    if (completion.subtaskId) {
      const subtaskId = completion.subtaskId.toString();
      const originalSubtask = subtasksStatusMap.get(subtaskId);
      if (!originalSubtask) continue;
      
      const subtaskStillTicked = !!(originalSubtask.tickedAt || originalSubtask.completedAt || originalSubtask.ticked === true || originalSubtask.status === "completed");
      if (!subtaskStillTicked) continue;
    }
    
    // Check project status (using cached data)
    let projectStatus = null;
    if (completion.projectId) {
      const projectId = completion.projectId.toString();
      projectStatus = subtaskProjectsStatusMap.get(projectId) || null;
    } else if (completion.taskId) {
      const parentTask = parentTasksMap.get(completion.taskId.toString());
      if (parentTask && parentTask.projectId) {
        const projectId = parentTask.projectId.toString();
        projectStatus = subtaskProjectsStatusMap.get(projectId) || null;
      }
    }
    
    if (projectStatus !== "active") continue;
    
    const employeeGot = calculateEmployeeGotFromSubtaskCompletion(completion);
    const parsed = parseEmployeeGot(employeeGot);
    
    const employeeIds = new Set<string>();
    if (Array.isArray(completion.assignees) && completion.assignees.length > 0) {
      for (const id of completion.assignees) {
        if (id) employeeIds.add(id.toString());
      }
    } else if (completion.completedBy) {
      employeeIds.add(completion.completedBy.toString());
    }
    
    let completionDate: Date | null = null;
    if (completion.approvalStatus === "deadline_passed") {
      if (completion.deadlineDate) {
        completionDate = new Date(completion.deadlineDate);
      } else if (completion.createdAt) {
        completionDate = new Date(completion.createdAt);
      } else {
        completionDate = completion.tickedAt ? new Date(completion.tickedAt) : new Date(completion.createdAt);
      }
    } else {
      completionDate = completion.tickedAt ? new Date(completion.tickedAt) : (completion.completedAt ? new Date(completion.completedAt) : new Date(completion.createdAt));
    }
    
    // Normalize dates for comparison
    const completionDateNormalized = new Date(completionDate);
    completionDateNormalized.setHours(0, 0, 0, 0);
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(23, 59, 59, 999);
    
    if (completionDateNormalized < startDateNormalized || completionDateNormalized > endDateNormalized) {
      continue;
    }
    
    for (const empId of employeeIds) {
      taskAnalysisRows.push({
        employeeId: empId,
        date: completionDate,
        bonusPoints: parsed.bonusPoints,
        bonusCurrency: parsed.bonusCurrency,
        finePoints: parsed.finePoints,
        fineCurrency: parsed.fineCurrency,
        rewardTotal: completion.bonusPoints || 0,
        rewardTotalCurrency: completion.bonusCurrency || 0,
      });
    }
  }
  
  // Batch fetch project statuses for active tasks
  const activeTaskProjectIds = tasks
    .filter((t: any) => t.projectId)
    .map((t: any) => t.projectId instanceof ObjectId ? t.projectId : new ObjectId(t.projectId));
  
  const activeTaskProjectsStatusMap = new Map<string, string>();
  if (activeTaskProjectIds.length > 0) {
    const activeTaskProjects = await projectsCollection.find(
      { _id: { $in: activeTaskProjectIds } },
      { projection: { _id: 1, status: 1 } }
    ).toArray();
    for (const project of activeTaskProjects) {
      activeTaskProjectsStatusMap.set(project._id.toString(), project.status || null);
    }
  }
  
  // Process active tasks (only ticked ones)
  for (const task of tasks) {
    // Check project status (using cached data)
    const projectId = task.projectId?.toString();
    const projectStatus = projectId ? (activeTaskProjectsStatusMap.get(projectId) || null) : null;
    
    if (projectStatus !== "active") continue;
    
    const employeeGot = calculateEmployeeGotFromTask(task);
    const parsed = parseEmployeeGot(employeeGot);
    
    const employeeIds = new Set<string>();
    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      for (const id of task.assignees) {
        if (id) employeeIds.add(id.toString());
      }
    } else if (task.assignedTo) {
      employeeIds.add(task.assignedTo.toString());
    }
    
    if (employeeIds.size === 0) continue;
    
    // Determine date for attribution
    let baseDate: Date | null = null;
    const approvalStatus = task.approvalStatus || "pending";
    
    if (approvalStatus === "approved" && task.status === "completed" && task.tickedAt) {
      baseDate = task.tickedAt ? new Date(task.tickedAt) : (task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt));
    } else if (approvalStatus === "deadline_passed") {
      if (task.deadlineDate) {
        baseDate = new Date(task.deadlineDate);
      } else if (task.assignedDate) {
        baseDate = new Date(task.assignedDate);
      } else {
        baseDate = new Date(task.createdAt);
      }
    } else {
      baseDate = task.assignedDate ? new Date(task.assignedDate) : new Date(task.createdAt);
    }
    
    // Normalize dates for comparison
    if (!baseDate) continue;
    const baseDateNormalized = new Date(baseDate);
    baseDateNormalized.setHours(0, 0, 0, 0);
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(23, 59, 59, 999);
    
    if (baseDateNormalized < startDateNormalized || baseDateNormalized > endDateNormalized) {
      continue;
    }
    
    for (const empId of employeeIds) {
      taskAnalysisRows.push({
        employeeId: empId,
        date: baseDate,
        bonusPoints: parsed.bonusPoints,
        bonusCurrency: parsed.bonusCurrency,
        finePoints: parsed.finePoints,
        fineCurrency: parsed.fineCurrency,
        rewardTotal: task.bonusPoints || 0,
        rewardTotalCurrency: task.bonusCurrency || 0,
      });
    }
  }
  
  // Batch fetch parent tasks for active subtasks
  const activeSubtaskTaskIds = subtasks
    .filter((s: any) => s.taskId)
    .map((s: any) => s.taskId instanceof ObjectId ? s.taskId : new ObjectId(s.taskId));
  
  const activeSubtaskParentTasksMap = new Map<string, any>();
  if (activeSubtaskTaskIds.length > 0) {
    const activeSubtaskParentTasks = await tasksCollection.find(
      { _id: { $in: activeSubtaskTaskIds } },
      { projection: { _id: 1, projectId: 1 } }
    ).toArray();
    for (const task of activeSubtaskParentTasks) {
      activeSubtaskParentTasksMap.set(task._id.toString(), task);
    }
  }
  
  // Get all unique project IDs from active subtasks
  const activeSubtaskProjectIds = new Set<string>();
  for (const subtask of subtasks) {
    if (subtask.taskId) {
      const parentTask = activeSubtaskParentTasksMap.get(subtask.taskId.toString());
      if (parentTask && parentTask.projectId) {
        activeSubtaskProjectIds.add(parentTask.projectId.toString());
      }
    }
  }
  
  // Batch fetch project statuses for active subtasks
  const activeSubtaskProjectsStatusMap = new Map<string, string>();
  if (activeSubtaskProjectIds.size > 0) {
    const activeSubtaskProjects = await projectsCollection.find(
      { _id: { $in: Array.from(activeSubtaskProjectIds).map(id => new ObjectId(id)) } },
      { projection: { _id: 1, status: 1 } }
    ).toArray();
    for (const project of activeSubtaskProjects) {
      activeSubtaskProjectsStatusMap.set(project._id.toString(), project.status || null);
    }
  }
  
  // Process active subtasks (only ticked ones)
  for (const subtask of subtasks) {
    // Check project status (using cached data)
    let projectStatus = null;
    if (subtask.taskId) {
      const parentTask = activeSubtaskParentTasksMap.get(subtask.taskId.toString());
      if (parentTask && parentTask.projectId) {
        const projectId = parentTask.projectId.toString();
        projectStatus = activeSubtaskProjectsStatusMap.get(projectId) || null;
      }
    }
    
    if (projectStatus !== "active") continue;
    
    const employeeGot = calculateEmployeeGotFromSubtask(subtask);
    const parsed = parseEmployeeGot(employeeGot);
    
    if (!subtask.assignee) continue;
    const employeeId = subtask.assignee.toString();
    
    let baseDate: Date | null = null;
    const approvalStatus = subtask.approvalStatus || "pending";
    
    if (approvalStatus === "approved" && subtask.status === "completed" && subtask.tickedAt) {
      baseDate = subtask.tickedAt ? new Date(subtask.tickedAt) : (subtask.completedAt ? new Date(subtask.completedAt) : new Date(subtask.createdAt));
    } else if (approvalStatus === "deadline_passed") {
      if (subtask.deadlineDate) {
        baseDate = new Date(subtask.deadlineDate);
      } else if (subtask.createdAt) {
        baseDate = new Date(subtask.createdAt);
      }
    } else {
      baseDate = subtask.createdAt ? new Date(subtask.createdAt) : new Date();
    }
    
    // Normalize dates for comparison
    if (!baseDate) continue;
    const baseDateNormalized = new Date(baseDate);
    baseDateNormalized.setHours(0, 0, 0, 0);
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(23, 59, 59, 999);
    
    if (baseDateNormalized < startDateNormalized || baseDateNormalized > endDateNormalized) {
      continue;
    }
    
    taskAnalysisRows.push({
      employeeId: employeeId,
      date: baseDate,
      bonusPoints: parsed.bonusPoints,
      bonusCurrency: parsed.bonusCurrency,
      finePoints: parsed.finePoints,
      fineCurrency: parsed.fineCurrency,
      rewardTotal: subtask.bonusPoints || 0,
      rewardTotalCurrency: subtask.bonusCurrency || 0,
    });
  }
  
  return taskAnalysisRows;
}

// Helper to calculate employeeGot from TaskCompletion (similar to task analysis route)
function calculateEmployeeGotFromCompletion(completion: any): string {
  if (completion.approvalStatus === "approved") {
    // Check if completed late
    let deadlineDate: Date | null = null;
    if (completion.deadlineDate) {
      deadlineDate = new Date(completion.deadlineDate);
      if (completion.deadlineTime) {
        const [h, m] = completion.deadlineTime.split(":");
        deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
      } else {
        deadlineDate.setHours(23, 59, 59, 999);
      }
    }
    
    const completedAt = completion.tickedAt || completion.completedAt;
    if (deadlineDate && completedAt && new Date(completedAt) > deadlineDate) {
      // Late - apply fine
      if (completion.penaltyCurrency && completion.penaltyCurrency > 0) {
        return `-₹${completion.penaltyCurrency} Fine`;
      } else if (completion.penaltyPoints && completion.penaltyPoints > 0) {
        return `-${completion.penaltyPoints} Penalty`;
      }
      return "0 Points";
    } else {
      // On time - apply bonus
      if (completion.bonusCurrency && completion.bonusCurrency > 0) {
        return `+₹${completion.bonusCurrency} Bonus`;
      } else if (completion.bonusPoints && completion.bonusPoints > 0) {
        return `+${completion.bonusPoints} Reward`;
      }
      return "0 Points";
    }
  } else if (completion.approvalStatus === "deadline_passed" || completion.approvalStatus === "rejected") {
    // Apply fine
    if (completion.penaltyCurrency && completion.penaltyCurrency > 0) {
      return `-₹${completion.penaltyCurrency} Fine`;
    } else if (completion.penaltyPoints && completion.penaltyPoints > 0) {
      return `-${completion.penaltyPoints} Penalty`;
    }
    return "0 Points";
  }
  return "Not Completed";
}

// Helper to calculate employeeGot from SubtaskCompletion
function calculateEmployeeGotFromSubtaskCompletion(completion: any): string {
  // Similar logic to TaskCompletion
  if (completion.approvalStatus === "approved") {
    let deadlineDate: Date | null = null;
    if (completion.deadlineDate) {
      deadlineDate = new Date(completion.deadlineDate);
      if (completion.deadlineTime) {
        const [h, m] = completion.deadlineTime.split(":");
        deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
      } else {
        deadlineDate.setHours(23, 59, 59, 999);
      }
    }
    
    const completedAt = completion.tickedAt || completion.completedAt;
    if (deadlineDate && completedAt && new Date(completedAt) > deadlineDate) {
      if (completion.penaltyCurrency && completion.penaltyCurrency > 0) {
        return `-₹${completion.penaltyCurrency} Fine`;
      } else if (completion.penaltyPoints && completion.penaltyPoints > 0) {
        return `-${completion.penaltyPoints} Penalty`;
      }
      return "0 Points";
    } else {
      if (completion.bonusCurrency && completion.bonusCurrency > 0) {
        return `+₹${completion.bonusCurrency} Bonus`;
      } else if (completion.bonusPoints && completion.bonusPoints > 0) {
        return `+${completion.bonusPoints} Reward`;
      }
      return "0 Points";
    }
  } else if (completion.approvalStatus === "deadline_passed" || completion.approvalStatus === "rejected") {
    if (completion.penaltyCurrency && completion.penaltyCurrency > 0) {
      return `-₹${completion.penaltyCurrency} Fine`;
    } else if (completion.penaltyPoints && completion.penaltyPoints > 0) {
      return `-${completion.penaltyPoints} Penalty`;
    }
    return "0 Points";
  }
  return "Not Completed";
}

// Helper to calculate employeeGot from Task
function calculateEmployeeGotFromTask(task: any): string {
  const now = new Date();
  let deadlineDate: Date | null = null;
  let deadlinePassed = false;
  
  if (task.deadlineTime) {
    const isRecurring = ["daily", "weekly", "monthly"].includes(task.taskKind);
    if (isRecurring && task.assignedDate) {
      deadlineDate = new Date(task.assignedDate);
      deadlineDate.setHours(0, 0, 0, 0);
    } else if (task.deadlineDate) {
      deadlineDate = new Date(task.deadlineDate);
      deadlineDate.setHours(0, 0, 0, 0);
    }
    
    if (deadlineDate) {
      const [h, m] = task.deadlineTime.split(":");
      deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
      deadlinePassed = now > deadlineDate;
    }
  } else if (task.deadlineDate) {
    deadlineDate = new Date(task.deadlineDate);
    deadlineDate.setHours(23, 59, 59, 999);
    deadlinePassed = now > deadlineDate;
  }
  
  if (task.status === "completed" && task.tickedAt) {
    const completedAt = task.tickedAt || task.completedAt || now;
    if (deadlineDate && completedAt > deadlineDate) {
      // Late
      if (task.penaltyCurrency && task.penaltyCurrency > 0) {
        return `-₹${task.penaltyCurrency} Fine`;
      } else if (task.penaltyPoints && task.penaltyPoints > 0) {
        return `-${task.penaltyPoints} Penalty`;
      }
      return "0 Points";
    } else {
      // On time
      if (task.bonusCurrency && task.bonusCurrency > 0) {
        return `+₹${task.bonusCurrency} Bonus`;
      } else if (task.bonusPoints && task.bonusPoints > 0) {
        return `+${task.bonusPoints} Reward`;
      }
      return "0 Points";
    }
  } else if (deadlinePassed && task.status !== "completed") {
    // Deadline passed, not completed
    if (task.penaltyCurrency && task.penaltyCurrency > 0) {
      return `-₹${task.penaltyCurrency} Fine`;
    } else if (task.penaltyPoints && task.penaltyPoints > 0) {
      return `-${task.penaltyPoints} Penalty`;
    }
    return "0 Points";
  }
  return "Not Completed";
}

// Helper to calculate employeeGot from Subtask
function calculateEmployeeGotFromSubtask(subtask: any): string {
  // Similar to task, but subtasks inherit from parent
  // For now, use subtask's own values (they should be inherited from parent)
  const now = new Date();
  let deadlineDate: Date | null = null;
  let deadlinePassed = false;
  
  // Get parent task deadline
  // For simplicity, use subtask's deadline if available
  if (subtask.deadlineTime) {
    if (subtask.deadlineDate) {
      deadlineDate = new Date(subtask.deadlineDate);
      deadlineDate.setHours(0, 0, 0, 0);
    }
    if (deadlineDate) {
      const [h, m] = subtask.deadlineTime.split(":");
      deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
      deadlinePassed = now > deadlineDate;
    }
  }
  
  if (subtask.status === "completed" && subtask.tickedAt) {
    const completedAt = subtask.tickedAt || subtask.completedAt || now;
    if (deadlineDate && completedAt > deadlineDate) {
      if (subtask.penaltyCurrency && subtask.penaltyCurrency > 0) {
        return `-₹${subtask.penaltyCurrency} Fine`;
      } else if (subtask.penaltyPoints && subtask.penaltyPoints > 0) {
        return `-${subtask.penaltyPoints} Penalty`;
      }
      return "0 Points";
    } else {
      if (subtask.bonusCurrency && subtask.bonusCurrency > 0) {
        return `+₹${subtask.bonusCurrency} Bonus`;
      } else if (subtask.bonusPoints && subtask.bonusPoints > 0) {
        return `+${subtask.bonusPoints} Reward`;
      }
      return "0 Points";
    }
  } else if (deadlinePassed && subtask.status !== "completed") {
    if (subtask.penaltyCurrency && subtask.penaltyCurrency > 0) {
      return `-₹${subtask.penaltyCurrency} Fine`;
    } else if (subtask.penaltyPoints && subtask.penaltyPoints > 0) {
      return `-${subtask.penaltyPoints} Penalty`;
    }
    return "0 Points";
  }
  return "Not Completed";
}

type SummaryRow = {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  // Project
  projectRewardTotal: number;
  projectRewardTotalCurrency: number;
  projectEarned: number;
  projectEarnedCurrency: number;
  projectFine: number;
  projectFineCurrency: number;
  // Daily checklist
  checklistRewardTotal: number;
  checklistRewardTotalCurrency: number;
  checklistEarned: number;
  checklistEarnedCurrency: number;
  checklistFine: number;
  checklistFineCurrency: number;
  // Tasks
  taskRewardTotal: number;
  taskRewardTotalCurrency: number;
  taskEarned: number;
  taskEarnedCurrency: number;
  taskFine: number;
  taskFineCurrency: number;
  // Hackathon
  hackathonEarned: number;
  hackathonEarnedCurrency: number;
  // Overall
  totalPoints: number;
  totalCurrency: number;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(request.url);
    const startParam = url.searchParams.get("startDate");
    const endParam = url.searchParams.get("endDate");

    const now = new Date();
    // Default to today (start and end both set to today)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Parse date parameters and ensure proper time boundaries
    let startDate: Date;
    let endDate: Date;
    
    if (startParam) {
      // Parse the date string and set to start of day (local time)
      const parsedStart = new Date(startParam);
      startDate = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate());
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = today;
    }
    
    if (endParam) {
      // Parse the date string and set to end of day (local time)
      const parsedEnd = new Date(endParam);
      endDate = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate());
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = todayEnd;
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");

    // Helper to normalize date to yyyy-mm-dd (local time)
    const toDateKey = (d: Date | string) => {
      const date = typeof d === "string" ? new Date(d) : d;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Map: employeeId|dateKey -> SummaryRow
    const summaryMap = new Map<string, SummaryRow>();

    const getOrCreateRow = (employeeId: string, dateKey: string): SummaryRow => {
      const key = `${employeeId}|${dateKey}`;
      let row = summaryMap.get(key);
      if (!row) {
        row = {
          employeeId,
          employeeName: "",
          date: dateKey,
          projectRewardTotal: 0,
          projectRewardTotalCurrency: 0,
          projectEarned: 0,
          projectEarnedCurrency: 0,
          projectFine: 0,
          projectFineCurrency: 0,
          checklistRewardTotal: 0,
          checklistRewardTotalCurrency: 0,
          checklistEarned: 0,
          checklistEarnedCurrency: 0,
          checklistFine: 0,
          checklistFineCurrency: 0,
          taskRewardTotal: 0,
          taskRewardTotalCurrency: 0,
          taskEarned: 0,
          taskEarnedCurrency: 0,
          taskFine: 0,
          taskFineCurrency: 0,
          hackathonEarned: 0,
          hackathonEarnedCurrency: 0,
          totalPoints: 0,
          totalCurrency: 0,
        };
        summaryMap.set(key, row);
      }
      return row;
    };

    // ----------------------------
    // 0) Initialize rows for ALL employees for the date range
    // ----------------------------
    // Fetch all approved employees
    const allEmployees = await db.collection('users')
      .find({ 
        role: 'employee',
        isApproved: true 
      })
      .project({ _id: 1, name: 1 })
      .toArray();

    console.log(`[Bonus Summary] Found ${allEmployees.length} approved employees`);

    // Generate all date keys in the range
    const dateKeys: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dateKeys.push(toDateKey(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Create rows for all employees for all dates in range
    for (const employee of allEmployees) {
      const employeeId = employee._id.toString();
      for (const dateKey of dateKeys) {
        getOrCreateRow(employeeId, dateKey);
      }
    }

    console.log(`[Bonus Summary] Initialized ${summaryMap.size} rows for ${allEmployees.length} employees across ${dateKeys.length} date(s)`);

    // ----------------------------
    // 1) Daily Checklist Rewards
    // ----------------------------
    const checklistConfigs = await ChecklistConfig.find({}).lean();

    // Normalize: trim, lowercase, remove extra spaces
    const normalizeLabel = (text: string): string => {
      return text
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " "); // Replace multiple spaces with single space
    };

    // Helper to find the appropriate checklist config for an employee
    // Priority: Custom > Skill-Based > Global
    const getEmployeeChecklistConfig = (
      employeeId: string,
      employeeSkills: string[]
    ): any => {
      // 1. Check for custom config (highest priority)
      const customConfigs = checklistConfigs.filter((c: any) => c.type === "custom");
      const customConfig = customConfigs.find((config: any) => {
        // Check if employee is in employeeIds array
        if (config.employeeIds && Array.isArray(config.employeeIds)) {
          return config.employeeIds.some(
            (id: any) =>
              (id.toString ? id.toString() : String(id)) === employeeId
          );
        }
        // Backward compatibility: check employeeId
        if (config.employeeId) {
          return (
            (config.employeeId.toString
              ? config.employeeId.toString()
              : String(config.employeeId)) === employeeId
          );
        }
        return false;
      });

      if (customConfig) {
        return customConfig;
      }

      // 2. Check for skill-based config
      if (employeeSkills.length > 0) {
        const skillConfigs = checklistConfigs.filter((c: any) => c.type === "skill");
        for (const skillConfig of skillConfigs) {
          if (skillConfig.skills && skillConfig.skills.length > 0) {
            const configSkills = skillConfig.skills.map((s: string) =>
              s.toLowerCase().trim()
            );
            // Check if any employee skill matches any config skill
            const hasMatchingSkill = employeeSkills.some((empSkill: string) =>
              configSkills.some(
                (configSkill: string) =>
                  empSkill.includes(configSkill) ||
                  configSkill.includes(empSkill)
              )
            );
            if (hasMatchingSkill) {
              return skillConfig;
            }
          }
        }
      }

      // 3. Fall back to global config
      const globalConfig = checklistConfigs.find((c: any) => c.type === "global");
      return globalConfig || null;
    };

    // Build employee-specific reward maps
    // Map: employeeId -> rewardMap (label -> {bonus, fine})
    const employeeRewardMaps = new Map<
      string,
      Map<string, { bonus: number; bonusCurrency: number; fine: number; fineCurrency: number }>
    >();

    // Fetch all employees and their skills
    const allEmployeeIds = new Set<string>();
    const dailyUpdates = await DailyUpdate.find({
      date: { $gte: startDate, $lte: endDate },
      adminApproved: true,
    })
      .select("employeeId")
      .lean();

    for (const du of dailyUpdates as any[]) {
      if (du.employeeId) {
        allEmployeeIds.add(du.employeeId.toString());
      }
    }

    // Batch fetch all employee profiles
    const employeeProfiles = await db
      .collection("employeeProfiles")
      .find({
        userId: { $in: Array.from(allEmployeeIds).map((id) => new ObjectId(id)) },
      })
      .toArray();

    const profileMap = new Map<string, string[]>();
    for (const profile of employeeProfiles as any[]) {
      const userId = profile.userId?.toString();
      if (!userId) continue;
      const skills = (profile.skills || [])
        .filter((s: string) => s && typeof s === "string")
        .map((s: string) => s.toLowerCase().trim())
        .filter((s: string) => s.length > 0);
      profileMap.set(userId, skills);
    }

    // Build reward maps for each employee based on their appropriate config
    for (const empId of allEmployeeIds) {
      const employeeSkills = profileMap.get(empId) || [];
      const config = getEmployeeChecklistConfig(empId, employeeSkills);
      if (!config) continue;

      // Build reward map for this employee's config
      const rewardMap = new Map<string, { bonus: number; bonusCurrency: number; fine: number; fineCurrency: number }>();
      for (const check of config.checks || []) {
        if (typeof check === "string") {
          // No bonus/fine info in legacy string format
          continue;
        }
        const label = normalizeLabel((check as any).text || "");
        if (!label) continue;
        const bonus =
          typeof (check as any).bonus === "number" ? (check as any).bonus : 0;
        const bonusCurrency =
          typeof (check as any).bonusCurrency === "number" ? (check as any).bonusCurrency : 0;
        const fine =
          typeof (check as any).fine === "number" ? (check as any).fine : 0;
        const fineCurrency =
          typeof (check as any).fineCurrency === "number" ? (check as any).fineCurrency : 0;

        // Store the bonus/fine for this label
        rewardMap.set(label, { bonus, bonusCurrency, fine, fineCurrency });
      }
      employeeRewardMaps.set(empId, rewardMap);
    }

    // Now process daily updates using employee-specific reward maps
    const allDailyUpdates = await DailyUpdate.find({
      date: { $gte: startDate, $lte: endDate },
      adminApproved: true,
    }).lean();

    for (const du of allDailyUpdates as any[]) {
      const employeeId = du.employeeId?.toString();
      if (!employeeId) continue;

      const dateKey = toDateKey(du.date || du.createdAt || new Date());
      const row = getOrCreateRow(employeeId, dateKey);

      // Get the reward map for this specific employee
      const rewardMap = employeeRewardMaps.get(employeeId);
      if (!rewardMap) continue;

      // Process each checklist item using the employee's specific config
      for (const item of du.checklist || []) {
        const labelKey = normalizeLabel(item.label || "");
        if (!labelKey) continue;
        const cfg = rewardMap.get(labelKey);
        if (!cfg) continue;

        // Add to total potential reward (all items with bonus configured)
        if (cfg.bonus > 0) {
          row.checklistRewardTotal += cfg.bonus;
        }
        if (cfg.bonusCurrency > 0) {
          row.checklistRewardTotalCurrency += cfg.bonusCurrency;
        }

        // If checked: employee earns the bonus (count every checked item)
        if (item.checked && cfg.bonus > 0) {
          row.checklistEarned += cfg.bonus;
        }
        if (item.checked && cfg.bonusCurrency > 0) {
          row.checklistEarnedCurrency += cfg.bonusCurrency;
        }

        // If NOT checked: employee gets the fine (count every unchecked item)
        if (!item.checked && cfg.fine > 0) {
          row.checklistFine += cfg.fine;
        }
        if (!item.checked && cfg.fineCurrency > 0) {
          row.checklistFineCurrency += cfg.fineCurrency;
        }
      }
    }

    // ----------------------------
    // 2) Task-based Rewards/Fines (from Task Analysis)
    // ----------------------------
    // Fetch all task analysis data to get accurate "What Employee Got" values
    // This ensures we use the same calculation logic as the task analysis page
    const taskAnalysisData = await fetchTaskAnalysisData(startDate, endDate, db);
    
    // Process task analysis data and aggregate by employee and date
    for (const taskData of taskAnalysisData) {
      const dateKey = toDateKey(taskData.date);
      const row = getOrCreateRow(taskData.employeeId, dateKey);
      
      // Add to total potential reward
      row.taskRewardTotal += taskData.rewardTotal || 0;
      row.taskRewardTotalCurrency += taskData.rewardTotalCurrency || 0;
      
      // Add earned bonuses (from employeeGot parsing)
      if (taskData.bonusPoints > 0) {
        row.taskEarned += taskData.bonusPoints;
      }
      if (taskData.bonusCurrency > 0) {
        row.taskEarnedCurrency += taskData.bonusCurrency;
      }
      
      // Add fines (from employeeGot parsing)
      if (taskData.finePoints > 0) {
        row.taskFine += taskData.finePoints;
      }
      if (taskData.fineCurrency > 0) {
        row.taskFineCurrency += taskData.fineCurrency;
      }
    }

    // OLD TASK CALCULATION LOGIC REMOVED - Now using task analysis data above
    // Subtask processing is now included in fetchTaskAnalysisData above
    // All old task/subtask calculation logic has been moved to fetchTaskAnalysisData function above
    
    /* REMOVED: Old task and subtask calculation logic - now handled in fetchTaskAnalysisData
      // Skip tasks that have been moved to TaskCompletion to avoid double counting
      if (completedTaskIds.has(task._id.toString())) {
        continue;
      }
      
      const bonus = typeof task.bonusPoints === "number" ? task.bonusPoints : 0;
      const bonusCurrency = typeof task.bonusCurrency === "number" ? task.bonusCurrency : 0;
      let penalty =
        typeof task.penaltyPoints === "number" ? task.penaltyPoints : 0;
      let penaltyCurrency = typeof task.penaltyCurrency === "number" ? task.penaltyCurrency : 0;
      
      // If penaltyCurrency is 0 but penaltyPoints exists, use penaltyPoints as fallback
      // This handles cases where tasks have penaltyPoints but penaltyCurrency wasn't set
      if (penaltyCurrency <= 0 && penalty > 0) {
        penaltyCurrency = penalty; // Use points as currency (1 point = 1 currency unit)
      }

      // Determine which employees this task should be attributed to
      const employeeIds = new Set<string>();
      if (Array.isArray(task.assignees) && task.assignees.length > 0) {
        for (const id of task.assignees) {
          if (id) employeeIds.add(id.toString());
        }
      } else if (task.assignedTo) {
        employeeIds.add(task.assignedTo.toString());
      }

      if (employeeIds.size === 0) continue;

      // Determine if this task resulted in reward or fine FIRST
      // Then determine the event date and whether it's in the period
      let baseDate: Date | null = null;
      let penaltyEventInPeriod = false;
      let rewardEventInPeriod = false;

      // Determine if this task resulted in reward or fine (similar logic to analysis route)
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      // Skip tasks marked as not applicable - they don't contribute to bonus/penalty
      const taskAny = task as any;
      if (taskAny.notApplicable === true) {
        continue;
      }

      // Check project status - only process tasks from "active" projects
      let projectStatus = null;
      try {
        const project = await db.collection("projects").findOne(
          { _id: task.projectId instanceof ObjectId ? task.projectId : new ObjectId(task.projectId) },
          { projection: { status: 1 } }
        );
        if (project) {
          projectStatus = project.status || null;
        }
      } catch (e) {
        // Couldn't fetch project status, skip this task
        continue;
      }

      // Skip tasks from projects that are not "active"
      if (projectStatus !== "active") {
        continue;
      }

      const approvalStatus: string = task.approvalStatus || "pending";
      const nowLocal = new Date();

      // For recurring tasks (daily/weekly/monthly), use assigned date for deadlineDate if deadlineTime exists
      const isRecurring = ["daily", "weekly", "monthly"].includes(task.taskKind);
      
      if (approvalStatus === "approved") {
        if (task.status === "completed") {
          let deadlineDate: Date | null = null;

          if (task.deadlineTime) {
            // For recurring tasks, use assigned date
            if (isRecurring && task.assignedDate) {
              deadlineDate = new Date(task.assignedDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (task.deadlineDate) {
              deadlineDate = new Date(task.deadlineDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else {
              deadlineDate = new Date();
              deadlineDate.setHours(0, 0, 0, 0);
            }
            
            // Parse deadline time
            const [h, m] = task.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          } else if (task.dueDate) {
            deadlineDate = new Date(task.dueDate);
            if (task.dueTime) {
              const [h, m] = task.dueTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
          }

          const completedAt =
            task.tickedAt || task.completedAt || task.updatedAt || nowLocal;

          if (deadlineDate && completedAt > deadlineDate) {
            shouldGetPenalty = true;
            // Penalty event is when task was completed late
            // Include penalty if completion date OR deadline date is in the period
            baseDate = completedAt;
            const completedDate = new Date(completedAt);
            const deadlineDateObj = deadlineDate;
            
            // Normalize dates for comparison
            const completedDateNormalized = new Date(completedDate);
            completedDateNormalized.setHours(0, 0, 0, 0);
            const deadlineDateNormalized = new Date(deadlineDateObj);
            deadlineDateNormalized.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            
            // Include if completion happened in period OR deadline was in period
            if ((completedDateNormalized >= startDateNormalized && completedDateNormalized <= endDateNormalized) ||
                (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized)) {
              penaltyEventInPeriod = true;
            }
          } else if (bonus > 0 || bonusCurrency > 0) {
            shouldGetReward = true;
            // Reward event is when task was completed on time
            baseDate = completedAt;
            const completedDate = new Date(completedAt);
            completedDate.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            if (completedDate >= startDateNormalized && completedDate <= endDateNormalized) {
              rewardEventInPeriod = true;
            }
          }
          
          // Set baseDate if not set yet (for date attribution)
          if (!baseDate) {
            baseDate = completedAt || task.assignedDate || task.createdAt;
          }
        } else {
          // Not completed but approved - if deadline passed, treat as penalty if configured
          let deadlineDate: Date | null = null;
          if (task.deadlineTime) {
            // For recurring tasks, use today's date
            if (isRecurring) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              deadlineDate = task.deadlineDate ? new Date(task.deadlineDate) : today;
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (task.deadlineDate) {
              deadlineDate = new Date(task.deadlineDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else {
              deadlineDate = new Date();
              deadlineDate.setHours(0, 0, 0, 0);
            }
            
            // Parse deadline time
            const [h, m] = task.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          } else if (task.dueDate) {
            deadlineDate = new Date(task.dueDate);
            if (task.dueTime) {
              const [h, m] = task.dueTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
          }
          if (deadlineDate && nowLocal > deadlineDate) {
            shouldGetPenalty = true;
            // Penalty event is when deadline passed
            baseDate = deadlineDate;
            // For recurring tasks, ensure we check if the deadline date (which is today) is in the period
            // Normalize deadlineDate to start of day for comparison
            const deadlineDateNormalized = new Date(deadlineDate);
            deadlineDateNormalized.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            
            if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
              penaltyEventInPeriod = true;
            }
          }
          
          // Set baseDate if not set yet
          if (!baseDate) {
            baseDate = task.assignedDate || task.createdAt;
          }
        }
      } else if (
        approvalStatus === "rejected" ||
        approvalStatus === "deadline_passed"
      ) {
        if (penalty > 0 || penaltyCurrency > 0) {
          shouldGetPenalty = true;
          
          // For deadline_passed status, determine when the deadline actually passed
          if (approvalStatus === "deadline_passed") {
            // Calculate the actual deadline date that passed - this is when the fine should be attributed
            let deadlinePassedDate: Date | null = null;
            
            if (task.deadlineTime) {
              // For recurring tasks, use assigned date as the deadline date
              if (isRecurring && task.assignedDate) {
                deadlinePassedDate = new Date(task.assignedDate);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else if (task.deadlineDate) {
                deadlinePassedDate = new Date(task.deadlineDate);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else if (task.assignedDate) {
                deadlinePassedDate = new Date(task.assignedDate);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              }
              
              if (deadlinePassedDate) {
                // Parse deadline time
                const [h, m] = task.deadlineTime.split(":");
                deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
              }
            } else if (task.deadlineDate) {
              deadlinePassedDate = new Date(task.deadlineDate);
              deadlinePassedDate.setHours(23, 59, 59, 999);
            } else if (task.dueDate) {
              deadlinePassedDate = new Date(task.dueDate);
              if (task.dueTime) {
                const [h, m] = task.dueTime.split(":");
                deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
              } else {
                deadlinePassedDate.setHours(23, 59, 59, 999);
              }
            }
            
            // Use the deadline date that passed as baseDate
            if (deadlinePassedDate) {
              baseDate = deadlinePassedDate;
              // Normalize the deadline date for comparison
              const deadlineDateNormalized = new Date(deadlinePassedDate);
              deadlineDateNormalized.setHours(0, 0, 0, 0);
              const startDateNormalized = new Date(startDate);
              startDateNormalized.setHours(0, 0, 0, 0);
              const endDateNormalized = new Date(endDate);
              endDateNormalized.setHours(23, 59, 59, 999);
              
              // Check if the deadline date is within the selected period
              if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
                penaltyEventInPeriod = true;
              }
            } else {
              // Fallback to assigned date if we can't determine deadline
              baseDate = task.assignedDate || task.createdAt;
              if (baseDate) {
                const assignedDateNormalized = new Date(baseDate);
                assignedDateNormalized.setHours(0, 0, 0, 0);
                const startDateNormalized = new Date(startDate);
                startDateNormalized.setHours(0, 0, 0, 0);
                const endDateNormalized = new Date(endDate);
                endDateNormalized.setHours(23, 59, 59, 999);
                
                if (assignedDateNormalized >= startDateNormalized && assignedDateNormalized <= endDateNormalized) {
                  penaltyEventInPeriod = true;
                }
              }
            }
          } else {
            // For rejected status, use approval/update date
            baseDate = task.approvedAt || task.updatedAt || task.createdAt;
            if (baseDate) {
              const approvedDate = new Date(baseDate);
              if (approvedDate >= startDate && approvedDate <= endDate) {
                penaltyEventInPeriod = true;
              }
            }
          }
        }
        
        // Set baseDate if not set yet
        if (!baseDate) {
          baseDate = task.assignedDate || task.createdAt;
        }
      } else {
        // Task not approved yet - set baseDate for potential future processing
        baseDate = task.assignedDate || task.createdAt;
      }

      if (!baseDate) continue;
      
      // Only process if penalty/reward event occurred in the period
      if (shouldGetPenalty && !penaltyEventInPeriod) {
        continue; // Skip if penalty event was outside the period
      }
      
      if (shouldGetReward && !rewardEventInPeriod) {
        continue; // Skip if reward event was outside the period
      }
      
      const dateKey = toDateKey(baseDate);

      for (const empId of employeeIds) {
        const row = getOrCreateRow(empId, dateKey);
        // Total potential reward from tasks
        row.taskRewardTotal += bonus;
        row.taskRewardTotalCurrency += bonusCurrency;

        if (shouldGetPenalty && penaltyEventInPeriod) {
          // Apply penalty points if available
          if (penalty > 0) {
            row.taskFine += penalty;
          }
          // Apply penalty currency (use penaltyCurrency which may have been set from penaltyPoints)
          if (penaltyCurrency > 0) {
            row.taskFineCurrency += penaltyCurrency;
          }
        } else if (shouldGetReward && rewardEventInPeriod) {
          // Apply reward points if available
          if (bonus > 0) {
            row.taskEarned += bonus;
          }
          // Apply reward currency
          if (bonusCurrency > 0) {
            row.taskEarnedCurrency += bonusCurrency;
          }
        }
      }
    }

    // ----------------------------
    // 2.3) Subtask-based Rewards/Fines (inherited from parent task)
    // ----------------------------
    const subtasks = await Subtask.find({}).lean();
    
    // Get all subtask IDs that have SubtaskCompletion records to avoid double counting
    const SubtaskCompletion = (await import("@/models/SubtaskCompletion")).default;
    const completedSubtaskIds = new Set<string>();
    const existingSubtaskCompletions = await SubtaskCompletion.find({}).select('subtaskId').lean();
    for (const comp of existingSubtaskCompletions as any[]) {
      if (comp.subtaskId) {
        completedSubtaskIds.add(comp.subtaskId.toString());
      }
    }

    for (const subtask of subtasks as any[]) {
      // Skip subtasks that have been moved to SubtaskCompletion to avoid double counting
      if (completedSubtaskIds.has(subtask._id.toString())) {
        continue;
      }
      
      const bonus = typeof subtask.bonusPoints === "number" ? subtask.bonusPoints : 0;
      const bonusCurrency = typeof subtask.bonusCurrency === "number" ? subtask.bonusCurrency : 0;
      let penalty = typeof subtask.penaltyPoints === "number" ? subtask.penaltyPoints : 0;
      let penaltyCurrency = typeof subtask.penaltyCurrency === "number" ? subtask.penaltyCurrency : 0;
      
      // If penaltyCurrency is 0 but penaltyPoints exists, use penaltyPoints as fallback
      if (penaltyCurrency <= 0 && penalty > 0) {
        penaltyCurrency = penalty;
      }

      // Subtasks have a single assignee
      if (!subtask.assignee) continue;
      const employeeId = subtask.assignee.toString();

      // Skip subtasks marked as not applicable
      if (subtask.notApplicable === true) {
        continue;
      }

      // Check project status for subtask - need to get parent task first
      let projectStatus = null;
      try {
        const parentTask = await db.collection("tasks").findOne(
          { _id: subtask.taskId instanceof ObjectId ? subtask.taskId : new ObjectId(subtask.taskId) },
          { projection: { projectId: 1 } }
        );
        if (parentTask && parentTask.projectId) {
          const project = await db.collection("projects").findOne(
            { _id: parentTask.projectId instanceof ObjectId ? parentTask.projectId : new ObjectId(parentTask.projectId) },
            { projection: { status: 1 } }
          );
          if (project) {
            projectStatus = project.status || null;
          }
        }
      } catch (e) {
        // Couldn't fetch project status, skip this subtask
        continue;
      }

      // Skip subtasks from projects that are not "active"
      if (projectStatus !== "active") {
        continue;
      }

      const approvalStatus: string = subtask.approvalStatus || "pending";
      const nowLocal = new Date();

      // For recurring subtasks, use assigned date for deadlineDate if deadlineTime exists
      const isRecurring = ["daily", "weekly", "monthly"].includes(subtask.taskKind);
      
      let baseDate: Date | null = null;
      let penaltyEventInPeriod = false;
      let rewardEventInPeriod = false;
      let shouldGetPenalty = false;
      let shouldGetReward = false;
      
      if (approvalStatus === "approved") {
        if (subtask.status === "completed") {
          let deadlineDate: Date | null = null;

          if (subtask.deadlineTime) {
            // For recurring subtasks, use created date (similar to assigned date for tasks)
            if (isRecurring && subtask.createdAt) {
              deadlineDate = new Date(subtask.createdAt);
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (subtask.deadlineDate) {
              deadlineDate = new Date(subtask.deadlineDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else {
              deadlineDate = new Date();
              deadlineDate.setHours(0, 0, 0, 0);
            }
            
            // Parse deadline time
            const [h, m] = subtask.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else if (subtask.deadlineDate) {
            deadlineDate = new Date(subtask.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          } else if (subtask.dueDate) {
            deadlineDate = new Date(subtask.dueDate);
            if (subtask.dueTime) {
              const [h, m] = subtask.dueTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
          }

          const completedAt = subtask.tickedAt || subtask.completedAt || subtask.updatedAt || nowLocal;

          if (deadlineDate && completedAt > deadlineDate) {
            shouldGetPenalty = true;
            baseDate = completedAt;
            const completedDate = new Date(completedAt);
            const deadlineDateObj = deadlineDate;
            
            const completedDateNormalized = new Date(completedDate);
            completedDateNormalized.setHours(0, 0, 0, 0);
            const deadlineDateNormalized = new Date(deadlineDateObj);
            deadlineDateNormalized.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            
            if ((completedDateNormalized >= startDateNormalized && completedDateNormalized <= endDateNormalized) ||
                (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized)) {
              penaltyEventInPeriod = true;
            }
          } else if (bonus > 0 || bonusCurrency > 0) {
            shouldGetReward = true;
            baseDate = completedAt;
            const completedDate = new Date(completedAt);
            completedDate.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            if (completedDate >= startDateNormalized && completedDate <= endDateNormalized) {
              rewardEventInPeriod = true;
            }
          }
          
          if (!baseDate) {
            baseDate = subtask.createdAt;
          }
        } else {
          // Not completed but approved - if deadline passed, treat as penalty if configured
          let deadlineDate: Date | null = null;
          if (subtask.deadlineTime) {
            if (isRecurring) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              deadlineDate = subtask.deadlineDate ? new Date(subtask.deadlineDate) : today;
              deadlineDate.setHours(0, 0, 0, 0);
            } else if (subtask.deadlineDate) {
              deadlineDate = new Date(subtask.deadlineDate);
              deadlineDate.setHours(0, 0, 0, 0);
            } else {
              deadlineDate = new Date();
              deadlineDate.setHours(0, 0, 0, 0);
            }
            
            const [h, m] = subtask.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else if (subtask.deadlineDate) {
            deadlineDate = new Date(subtask.deadlineDate);
            deadlineDate.setHours(23, 59, 59, 999);
          } else if (subtask.dueDate) {
            deadlineDate = new Date(subtask.dueDate);
            if (subtask.dueTime) {
              const [h, m] = subtask.dueTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
          }
          if (deadlineDate && nowLocal > deadlineDate) {
            shouldGetPenalty = true;
            baseDate = deadlineDate;
            const deadlineDateNormalized = new Date(deadlineDate);
            deadlineDateNormalized.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(23, 59, 59, 999);
            
            if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
              penaltyEventInPeriod = true;
            }
          }
          
          if (!baseDate) {
            baseDate = subtask.createdAt;
          }
        }
      } else if (approvalStatus === "rejected" || approvalStatus === "deadline_passed") {
        if (penalty > 0 || penaltyCurrency > 0) {
          shouldGetPenalty = true;
          
          if (approvalStatus === "deadline_passed") {
            let deadlinePassedDate: Date | null = null;
            
            if (subtask.deadlineTime) {
              if (isRecurring && subtask.createdAt) {
                deadlinePassedDate = new Date(subtask.createdAt);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else if (subtask.deadlineDate) {
                deadlinePassedDate = new Date(subtask.deadlineDate);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else if (subtask.createdAt) {
                deadlinePassedDate = new Date(subtask.createdAt);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              }
              
              if (deadlinePassedDate) {
                const [h, m] = subtask.deadlineTime.split(":");
                deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
              }
            } else if (subtask.deadlineDate) {
              deadlinePassedDate = new Date(subtask.deadlineDate);
              deadlinePassedDate.setHours(23, 59, 59, 999);
            } else if (subtask.dueDate) {
              deadlinePassedDate = new Date(subtask.dueDate);
              if (subtask.dueTime) {
                const [h, m] = subtask.dueTime.split(":");
                deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
              } else {
                deadlinePassedDate.setHours(23, 59, 59, 999);
              }
            }
            
            if (deadlinePassedDate) {
              baseDate = deadlinePassedDate;
              const deadlineDateNormalized = new Date(deadlinePassedDate);
              deadlineDateNormalized.setHours(0, 0, 0, 0);
              const startDateNormalized = new Date(startDate);
              startDateNormalized.setHours(0, 0, 0, 0);
              const endDateNormalized = new Date(endDate);
              endDateNormalized.setHours(23, 59, 59, 999);
              
              if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
                penaltyEventInPeriod = true;
              }
            } else {
              baseDate = subtask.createdAt;
            }
          } else {
            baseDate = subtask.createdAt;
          }
        }
      } else {
        baseDate = subtask.createdAt;
      }

      if (!baseDate) continue;
      
      // Only process if penalty/reward event occurred in the period
      if (shouldGetPenalty && !penaltyEventInPeriod) {
        continue;
      }
      
      if (shouldGetReward && !rewardEventInPeriod) {
        continue;
      }
      
      const dateKey = toDateKey(baseDate);
      const row = getOrCreateRow(employeeId, dateKey);
      
      // Total potential reward from subtasks
      row.taskRewardTotal += bonus;
      row.taskRewardTotalCurrency += bonusCurrency;

      if (shouldGetPenalty && penaltyEventInPeriod) {
        if (penalty > 0) {
          row.taskFine += penalty;
        }
        if (penaltyCurrency > 0) {
          row.taskFineCurrency += penaltyCurrency;
        }
      } else if (shouldGetReward && rewardEventInPeriod) {
        if (bonus > 0) {
          row.taskEarned += bonus;
        }
        if (bonusCurrency > 0) {
          row.taskEarnedCurrency += bonusCurrency;
        }
      }
    }
    */ // END OF REMOVED OLD TASK/SUBTASK CALCULATION LOGIC

    // TaskCompletion and SubtaskCompletion processing is now included in fetchTaskAnalysisData above
    /* REMOVED: Old TaskCompletion and SubtaskCompletion processing - now handled in fetchTaskAnalysisData
    // ----------------------------
    // 2.5) TaskCompletion Records (Historical tasks that were reset)
    // ----------------------------
    // Note: TaskCompletion is already imported above
    const taskCompletions = await TaskCompletion.find({
      approvalStatus: { $in: ["approved", "rejected", "deadline_passed"] }
    }).lean();

    for (const completion of taskCompletions as any[]) {
      // For deadline_passed completions, use the deadline date that passed
      // For other statuses, use completion date
      let completionDate: Date | null = null;
      
      if (completion.approvalStatus === "deadline_passed") {
        // Calculate the deadline date that passed
        let deadlinePassedDate: Date | null = null;
        
        if (completion.deadlineTime) {
          if (completion.deadlineDate) {
            deadlinePassedDate = new Date(completion.deadlineDate);
            deadlinePassedDate.setHours(0, 0, 0, 0);
          } else if (completion.assignedDate) {
            deadlinePassedDate = new Date(completion.assignedDate);
            deadlinePassedDate.setHours(0, 0, 0, 0);
          }
          
          if (deadlinePassedDate) {
            const [h, m] = completion.deadlineTime.split(":");
            deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
          }
        } else if (completion.deadlineDate) {
          deadlinePassedDate = new Date(completion.deadlineDate);
          deadlinePassedDate.setHours(23, 59, 59, 999);
        } else if (completion.dueDate) {
          deadlinePassedDate = new Date(completion.dueDate);
          if (completion.dueTime) {
            const [h, m] = completion.dueTime.split(":");
            deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlinePassedDate.setHours(23, 59, 59, 999);
          }
        }
        
        completionDate = deadlinePassedDate || completion.assignedDate || completion.createdAt;
      } else {
        completionDate = completion.approvedAt || completion.tickedAt || completion.completedAt || completion.createdAt;
      }
      
      if (!completionDate) continue;
      
      const eventDate = new Date(completionDate);
      if (eventDate < startDate || eventDate > endDate) {
        continue; // Skip if outside period
      }

      // Check project status - only process completions from "active" projects
      let projectStatus = null;
      try {
        if (completion.projectId) {
          const project = await db.collection("projects").findOne(
            { _id: completion.projectId instanceof ObjectId ? completion.projectId : new ObjectId(completion.projectId) },
            { projection: { status: 1 } }
          );
          if (project) {
            projectStatus = project.status || null;
          }
        }
      } catch (e) {
        // Couldn't fetch project status, skip this completion
        continue;
      }

      // Skip completions from projects that are not "active"
      if (projectStatus !== "active") {
        continue;
      }

      const bonusCurrency = typeof completion.bonusCurrency === "number" ? completion.bonusCurrency : 0;
      const penaltyCurrency = typeof completion.penaltyCurrency === "number" ? completion.penaltyCurrency : 0;
      
      // Use penaltyPoints as fallback if penaltyCurrency is 0
      let finalPenaltyCurrency = penaltyCurrency;
      if (penaltyCurrency <= 0 && completion.penaltyPoints > 0) {
        finalPenaltyCurrency = completion.penaltyPoints;
      }

      // Determine which employees this completion should be attributed to
      const employeeIds = new Set<string>();
      if (Array.isArray(completion.assignees) && completion.assignees.length > 0) {
        for (const id of completion.assignees) {
          if (id) employeeIds.add(id.toString());
        }
      } else if (completion.assignedTo) {
        employeeIds.add(completion.assignedTo.toString());
      } else if (completion.completedBy) {
        employeeIds.add(completion.completedBy.toString());
      }

      if (employeeIds.size === 0) continue;

      const dateKey = toDateKey(completionDate);
      const nowLocal = new Date();

      // Determine if this completion resulted in reward or fine
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      if (completion.approvalStatus === "approved") {
        // Check if task was completed late
        let deadlineDate: Date | null = null;
        if (completion.deadlineDate) {
          deadlineDate = new Date(completion.deadlineDate);
          if (completion.deadlineTime) {
            const [h, m] = completion.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        } else if (completion.dueDate) {
          deadlineDate = new Date(completion.dueDate);
          if (completion.dueTime) {
            const [h, m] = completion.dueTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        }

        const completedAt = completion.tickedAt || completion.completedAt || completionDate;
        if (deadlineDate && completedAt > deadlineDate) {
          shouldGetPenalty = true;
        } else if (bonusCurrency > 0) {
          shouldGetReward = true;
        }
      } else if (completion.approvalStatus === "rejected" || completion.approvalStatus === "deadline_passed") {
        if (finalPenaltyCurrency > 0) {
          shouldGetPenalty = true;
        }
      }

      for (const empId of employeeIds) {
        const row = getOrCreateRow(empId, dateKey);
        
        // Add to totals
        row.taskRewardTotal += completion.bonusPoints || 0;
        row.taskRewardTotalCurrency += bonusCurrency;

        if (shouldGetPenalty) {
          // Apply penalty points if available
          if (completion.penaltyPoints > 0) {
            row.taskFine += completion.penaltyPoints;
          }
          // Apply penalty currency
          if (finalPenaltyCurrency > 0) {
            row.taskFineCurrency += finalPenaltyCurrency;
          }
        } else if (shouldGetReward) {
          // Apply reward points if available
          if (completion.bonusPoints > 0) {
            row.taskEarned += completion.bonusPoints;
          }
          // Apply reward currency
          if (bonusCurrency > 0) {
            row.taskEarnedCurrency += bonusCurrency;
          }
        }
      }
    }

    // ----------------------------
    // 2.6) SubtaskCompletion Records (Historical subtasks that were reset)
    // ----------------------------
    const subtaskCompletions = await SubtaskCompletion.find({
      approvalStatus: { $in: ["approved", "rejected", "deadline_passed"] }
    }).lean();

    for (const completion of subtaskCompletions as any[]) {
      // For deadline_passed completions, use the deadline date that passed
      // For other statuses, use completion date
      let completionDate: Date | null = null;
      
      if (completion.approvalStatus === "deadline_passed") {
        // Calculate the deadline date that passed
        let deadlinePassedDate: Date | null = null;
        
        if (completion.deadlineTime) {
          if (completion.deadlineDate) {
            deadlinePassedDate = new Date(completion.deadlineDate);
            deadlinePassedDate.setHours(0, 0, 0, 0);
          } else if (completion.createdAt) {
            deadlinePassedDate = new Date(completion.createdAt);
            deadlinePassedDate.setHours(0, 0, 0, 0);
          }
          
          if (deadlinePassedDate) {
            const [h, m] = completion.deadlineTime.split(":");
            deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
          }
        } else if (completion.deadlineDate) {
          deadlinePassedDate = new Date(completion.deadlineDate);
          deadlinePassedDate.setHours(23, 59, 59, 999);
        } else if (completion.dueDate) {
          deadlinePassedDate = new Date(completion.dueDate);
          if (completion.dueTime) {
            const [h, m] = completion.dueTime.split(":");
            deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlinePassedDate.setHours(23, 59, 59, 999);
          }
        }
        
        completionDate = deadlinePassedDate || completion.tickedAt || completion.completedAt || completion.createdAt;
      } else {
        completionDate = completion.tickedAt || completion.completedAt || completion.createdAt;
      }
      
      if (!completionDate) continue;
      
      const eventDate = new Date(completionDate);
      if (eventDate < startDate || eventDate > endDate) {
        continue; // Skip if outside period
      }

      // Check project status for subtask completion - need to get parent task first
      let projectStatus = null;
      try {
        if (completion.projectId) {
          const project = await db.collection("projects").findOne(
            { _id: completion.projectId instanceof ObjectId ? completion.projectId : new ObjectId(completion.projectId) },
            { projection: { status: 1 } }
          );
          if (project) {
            projectStatus = project.status || null;
          }
        } else if (completion.taskId) {
          // Try to get project from parent task
          const parentTask = await db.collection("tasks").findOne(
            { _id: completion.taskId instanceof ObjectId ? completion.taskId : new ObjectId(completion.taskId) },
            { projection: { projectId: 1 } }
          );
          if (parentTask && parentTask.projectId) {
            const project = await db.collection("projects").findOne(
              { _id: parentTask.projectId instanceof ObjectId ? parentTask.projectId : new ObjectId(parentTask.projectId) },
              { projection: { status: 1 } }
            );
            if (project) {
              projectStatus = project.status || null;
            }
          }
        }
      } catch (e) {
        // Couldn't fetch project status, skip this completion
        continue;
      }

      // Skip subtask completions from projects that are not "active"
      if (projectStatus !== "active") {
        continue;
      }

      // Get bonus/fine from completion record (now stored in SubtaskCompletion)
      const bonusCurrency = typeof completion.bonusCurrency === "number" ? completion.bonusCurrency : 0;
      const penaltyCurrency = typeof completion.penaltyCurrency === "number" ? completion.penaltyCurrency : 0;
      const bonusPoints = typeof completion.bonusPoints === "number" ? completion.bonusPoints : 0;
      const penaltyPoints = typeof completion.penaltyPoints === "number" ? completion.penaltyPoints : 0;
      
      // Use penaltyPoints as fallback if penaltyCurrency is 0
      let finalPenaltyCurrency = penaltyCurrency;
      if (penaltyCurrency <= 0 && penaltyPoints > 0) {
        finalPenaltyCurrency = penaltyPoints;
      }

      // Subtasks have a single assignee
      const employeeIds = new Set<string>();
      if (Array.isArray(completion.assignees) && completion.assignees.length > 0) {
        for (const id of completion.assignees) {
          if (id) employeeIds.add(id.toString());
        }
      } else if (completion.completedBy) {
        employeeIds.add(completion.completedBy.toString());
      }

      if (employeeIds.size === 0) continue;

      const dateKey = toDateKey(completionDate);
      const nowLocal = new Date();

      // Determine if this completion resulted in reward or fine
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      if (completion.approvalStatus === "approved") {
        // Check if subtask was completed late
        let deadlineDate: Date | null = null;
        if (completion.deadlineDate) {
          deadlineDate = new Date(completion.deadlineDate);
          if (completion.deadlineTime) {
            const [h, m] = completion.deadlineTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        } else if (completion.dueDate) {
          deadlineDate = new Date(completion.dueDate);
          if (completion.dueTime) {
            const [h, m] = completion.dueTime.split(":");
            deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }
        }

        const completedAt = completion.tickedAt || completion.completedAt || completionDate;
        if (deadlineDate && completedAt > deadlineDate) {
          shouldGetPenalty = true;
        } else if (bonusCurrency > 0 || bonusPoints > 0) {
          shouldGetReward = true;
        }
      } else if (completion.approvalStatus === "rejected" || completion.approvalStatus === "deadline_passed") {
        if (finalPenaltyCurrency > 0 || penaltyPoints > 0) {
          shouldGetPenalty = true;
        }
      }

      for (const empId of employeeIds) {
        const row = getOrCreateRow(empId, dateKey);
        
        // Add to totals
        row.taskRewardTotal += bonusPoints;
        row.taskRewardTotalCurrency += bonusCurrency;

        if (shouldGetPenalty) {
          // Apply penalty points if available
          if (penaltyPoints > 0) {
            row.taskFine += penaltyPoints;
          }
          // Apply penalty currency
          if (finalPenaltyCurrency > 0) {
            row.taskFineCurrency += finalPenaltyCurrency;
          }
        } else if (shouldGetReward) {
          // Apply reward points if available
          if (bonusPoints > 0) {
            row.taskEarned += bonusPoints;
          }
          // Apply reward currency
          if (bonusCurrency > 0) {
            row.taskEarnedCurrency += bonusCurrency;
          }
        }
      }
    }
    */ // END OF REMOVED OLD COMPLETION RECORDS PROCESSING

    // ----------------------------
    // 3) Project-level Rewards/Fines
    // ----------------------------
    const projects = await db
      .collection("projects")
      .find({
        assignedAt: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    for (const project of projects as any[]) {
      const lead = project.leadAssignee;
      if (!lead) continue;

      // Handle both array and single leadAssignee
      const leadAssigneeIds: string[] = [];
      if (Array.isArray(lead)) {
        leadAssigneeIds.push(...lead.map((l: any) => l.toString()));
      } else {
        leadAssigneeIds.push(lead.toString());
      }

      const bonus =
        typeof project.bonusPoints === "number" ? project.bonusPoints : 0;
      const bonusCurrency =
        typeof project.bonusCurrency === "number" ? project.bonusCurrency : 0;
      const penalty =
        typeof project.penaltyPoints === "number" ? project.penaltyPoints : 0;
      const penaltyCurrency =
        typeof project.penaltyCurrency === "number" ? project.penaltyCurrency : 0;

      const baseDate = project.assignedAt || project.updatedAt || project.createdAt;
      if (!baseDate) continue;
      const dateKey = toDateKey(baseDate);

      // Attribute project rewards/fines to all lead assignees
      for (const employeeId of leadAssigneeIds) {
        const row = getOrCreateRow(employeeId, dateKey);

        row.projectRewardTotal += bonus;
        row.projectRewardTotalCurrency += bonusCurrency;

        // New logic:
        // - If project is completed, employee gets the bonus (reward)
        // - If project is NOT completed AND deadline has passed, employee gets fined
        // - No fine before deadline
        const status = project.status || "in_progress";
        const now = new Date();
        
        // Check if deadline has passed
        let deadlinePassed = false;
        if (project.deadline) {
          const deadline = new Date(project.deadline);
          deadlinePassed = now > deadline;
        } else if (project.dueDate) {
          const dueDate = new Date(project.dueDate);
          deadlinePassed = now > dueDate;
        }

        // Grant reward if project is completed
        if (status === "completed" && bonus > 0) {
          row.projectEarned += bonus;
        }
        // Apply fine only if deadline passed and project not completed
        else if (status !== "completed" && deadlinePassed && penalty > 0) {
          row.projectFine += penalty;
        }
        
        if (status === "completed" && bonusCurrency > 0) {
          row.projectEarnedCurrency += bonusCurrency;
        }
        // Apply currency fine only if deadline passed and project not completed
        else if (status !== "completed" && deadlinePassed && penaltyCurrency > 0) {
          row.projectFineCurrency += penaltyCurrency;
        }
      }
    }

    // ----------------------------
    // 4) Hackathon Prizes (only for declared winners)
    // ----------------------------
    const hackathons = await db
      .collection("hackathons")
      .find({
        winnerId: { $exists: true, $ne: null },
        winnerDeclaredAt: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    for (const hackathon of hackathons as any[]) {
      const winnerId = hackathon.winnerId;
      if (!winnerId) continue;

      const prizePoints = typeof hackathon.prizePoints === "number" ? hackathon.prizePoints : 0;
      const prizeCurrency = typeof hackathon.prizeCurrency === "number" ? hackathon.prizeCurrency : 0;
      const prizePool = typeof hackathon.prizePool === "number" ? hackathon.prizePool : 0;
      
      // Use prizePoints/prizeCurrency if set, otherwise fallback to prizePool as points
      const actualPrizePoints = prizePoints > 0 ? prizePoints : prizePool;
      const actualPrizeCurrency = prizeCurrency;
      
      if (actualPrizePoints <= 0 && actualPrizeCurrency <= 0) continue;

      const winnerDeclaredAt = hackathon.winnerDeclaredAt || hackathon.updatedAt || hackathon.createdAt;
      if (!winnerDeclaredAt) continue;
      const dateKey = toDateKey(winnerDeclaredAt);

      const employeeId = winnerId.toString();
      
      // Check if winner is an employee
      const employeeProfile = await db.collection("employeeProfiles").findOne({
        userId: winnerId
      });

      // Only award prize if winner is an employee
      if (employeeProfile) {
        const row = getOrCreateRow(employeeId, dateKey);
        // Hackathon prizes are tracked separately
        row.hackathonEarned += actualPrizePoints;
        row.hackathonEarnedCurrency += actualPrizeCurrency;
      }
    }

    // ----------------------------
    // 5) Attach employee names & compute totals
    // ----------------------------
    // Use the allEmployees we already fetched, or fetch again if needed
    const nameMap = new Map<string, string>();
    for (const emp of allEmployees) {
      nameMap.set(emp._id.toString(), emp.name || "Unknown");
    }

    // Ensure all rows have employee names and compute totals
    for (const row of summaryMap.values()) {
      row.employeeName = nameMap.get(row.employeeId) || "Unknown";
      const projectNet = row.projectEarned - row.projectFine;
      const checklistNet = row.checklistEarned - row.checklistFine;
      const taskNet = row.taskEarned - row.taskFine;
      row.totalPoints = projectNet + checklistNet + taskNet + row.hackathonEarned;
      
      const projectNetCurr = row.projectEarnedCurrency - row.projectFineCurrency;
      const checklistNetCurr = row.checklistEarnedCurrency - row.checklistFineCurrency;
      const taskNetCurr = row.taskEarnedCurrency - row.taskFineCurrency;
      row.totalCurrency = projectNetCurr + checklistNetCurr + taskNetCurr + row.hackathonEarnedCurrency;
    }

    // Fetch custom bonus/fine data (date is stored as YYYY-MM-DD string)
    const startDateKey = toDateKey(startDate);
    const endDateKey = toDateKey(endDate);
    
    // Fetch all custom bonus/fine records in the date range
    // Query without filtering by employeeId to get all records, then normalize IDs for matching
    const customBonusFineData = await db
      .collection("customBonusFine")
      .find({
        date: { $gte: startDateKey, $lte: endDateKey }
      })
      .toArray();
    
    console.log(`[Bonus Summary] Raw customBonusFine records found:`, customBonusFineData.length);
    console.log(`[Bonus Summary] Date range: ${startDateKey} to ${endDateKey}`);
    
    if (customBonusFineData.length > 0) {
      console.log(`[Bonus Summary] Sample customBonusFine records:`, customBonusFineData.slice(0, 5).map((c: any) => ({
        _id: c._id.toString(),
        employeeId: c.employeeId,
        employeeIdType: typeof c.employeeId,
        employeeIdIsObjectId: c.employeeId instanceof ObjectId,
        employeeIdString: c.employeeId instanceof ObjectId ? c.employeeId.toString() : String(c.employeeId),
        date: c.date,
        fineEntriesCount: (c.customFineEntries || []).length,
        fineEntries: (c.customFineEntries || []).slice(0, 2).map((e: any) => ({
          type: e.type,
          value: e.value,
          description: e.description?.substring(0, 50)
        }))
      })));
    } else {
      // Debug: Check if there are ANY customBonusFine records
      const allCustomBonusFine = await db.collection("customBonusFine").find({}).limit(5).toArray();
      console.log(`[Bonus Summary] No records in date range. Sample of all records:`, allCustomBonusFine.map((c: any) => ({
        employeeId: c.employeeId,
        date: c.date,
        fineEntries: (c.customFineEntries || []).length
      })));
    }

    console.log(`[Bonus Summary] Found ${customBonusFineData.length} custom bonus/fine records between ${startDateKey} and ${endDateKey}`);
    
    // Log some examples for debugging
    if (customBonusFineData.length > 0) {
      console.log(`[Bonus Summary] Sample custom fine records:`, customBonusFineData.slice(0, 3).map((c: any) => ({
        employeeId: c.employeeId,
        date: c.date,
        fineEntries: (c.customFineEntries || []).length,
        bonusEntries: (c.customBonusEntries || []).length
      })));
    }

    // Merge custom bonus/fine into rows AND create rows for employees/dates that only have custom fines
    const customDataMap = new Map();
    const employeesToFetch = new Set<string>();
    
    // Helper to normalize employeeId to string (handle both ObjectId and string)
    const normalizeEmployeeId = (id: any): string => {
      if (!id) return '';
      if (id instanceof ObjectId) return id.toString();
      if (typeof id === 'string') return id;
      if (id && typeof id === 'object' && id.toString) return id.toString();
      return String(id);
    };
    
    for (const custom of customBonusFineData) {
      // Normalize employeeId to ensure consistent matching
      const normalizedEmployeeId = normalizeEmployeeId(custom.employeeId);
      const key = `${normalizedEmployeeId}|${custom.date}`;
      customDataMap.set(key, custom);
      employeesToFetch.add(normalizedEmployeeId);
      
      // Ensure a row exists for this employee/date even if there's no other activity
      if (!summaryMap.has(key)) {
        console.log(`[Bonus Summary] Creating row for employee ${normalizedEmployeeId} on date ${custom.date} (only custom fines)`);
        getOrCreateRow(normalizedEmployeeId, custom.date);
      }
    }

    // Batch fetch employee names for custom fine entries
    if (employeesToFetch.size > 0) {
      const employeeUsers = await db.collection('users').find({
        _id: { $in: Array.from(employeesToFetch).map(id => new ObjectId(id)) }
      }).toArray();
      
      const employeeNameMap = new Map<string, string>();
      for (const user of employeeUsers as any[]) {
        employeeNameMap.set(user._id.toString(), user.name || 'Unknown');
      }
      
      // Update employee names for rows created from custom fines
      for (const custom of customBonusFineData) {
        const normalizedEmployeeId = normalizeEmployeeId(custom.employeeId);
        const key = `${normalizedEmployeeId}|${custom.date}`;
        const row = summaryMap.get(key);
        if (row && !row.employeeName) {
          row.employeeName = employeeNameMap.get(normalizedEmployeeId) || 'Unknown';
        }
      }
    }

    // Now merge custom fine data into all rows (including newly created ones)
    // Transform entries to ensure they match the expected format: { type: 'points'|'currency', value: number, description: string }
    const transformEntries = (entries: any[]) => {
      const transformed: any[] = [];
      for (const entry of entries) {
        // If entry already has the correct format, add as is
        if (entry.type && entry.value !== undefined) {
          transformed.push(entry);
        } else if (entry.finePoints !== undefined || entry.fineCurrency !== undefined) {
          // If entry has finePoints/fineCurrency (old format), convert to new format
          if (entry.finePoints > 0) {
            transformed.push({
              type: 'points',
              value: entry.finePoints,
              description: entry.description || 'Custom fine'
            });
          }
          if (entry.fineCurrency > 0) {
            transformed.push({
              type: 'currency',
              value: entry.fineCurrency,
              description: entry.description || 'Custom fine'
            });
          }
        }
      }
      return transformed;
    };

    // Debug: Log all custom data keys before matching
    console.log(`[Bonus Summary] Custom data map keys (first 10):`, Array.from(customDataMap.keys()).slice(0, 10));
    console.log(`[Bonus Summary] Summary map keys (first 10):`, Array.from(summaryMap.keys()).slice(0, 10));
    
    for (const row of summaryMap.values()) {
      // Normalize employeeId for matching
      const normalizedRowEmployeeId = normalizeEmployeeId(row.employeeId);
      const key = `${normalizedRowEmployeeId}|${row.date}`;
      const customData = customDataMap.get(key);
      if (customData) {
        // Transform bonus entries if needed
        const bonusEntries = transformEntries(customData.customBonusEntries || []);
        // Transform fine entries if needed
        const fineEntries = transformEntries(customData.customFineEntries || []);
        
        (row as any).customBonusEntries = bonusEntries;
        (row as any).customFineEntries = fineEntries;
        console.log(`[Bonus Summary] ✓ Merged custom fines for ${row.employeeName} (${normalizedRowEmployeeId}) on ${row.date}: ${fineEntries.length} fine entries, ${bonusEntries.length} bonus entries`);
        if (fineEntries.length > 0) {
          console.log(`[Bonus Summary] Fine entries details:`, fineEntries.map((e: any) => ({ type: e.type, value: e.value, description: e.description?.substring(0, 50) })));
        }
      } else {
        // Debug: log if we expected to find custom data but didn't
        const expectedKey = `${normalizedRowEmployeeId}|${row.date}`;
        const matchingKeys = Array.from(customDataMap.keys()).filter(k => {
          const [empId, date] = k.split('|');
          return date === row.date && normalizeEmployeeId(empId) === normalizedRowEmployeeId;
        });
        const hasCustomDataForDate = Array.from(customDataMap.keys()).some(k => k.includes(`|${row.date}`));
        
        if (hasCustomDataForDate || matchingKeys.length > 0) {
          console.log(`[Bonus Summary] ⚠️ Row ${row.employeeName} (${normalizedRowEmployeeId}) on ${row.date} - No custom data found.`);
          console.log(`[Bonus Summary] Expected key: ${expectedKey}`);
          console.log(`[Bonus Summary] Matching keys found:`, matchingKeys);
          console.log(`[Bonus Summary] All keys for this date:`, Array.from(customDataMap.keys()).filter(k => k.includes(`|${row.date}`)));
        }
      }
    }

    // Convert to sorted array (latest date first, then employee name)
    const rows = Array.from(summaryMap.values()).sort((a, b) => {
      if (a.date === b.date) {
        return a.employeeName.localeCompare(b.employeeName);
      }
      return a.date < b.date ? 1 : -1;
    });

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("Error fetching bonus summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


