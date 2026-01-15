import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import DailyUpdate from "@/models/DailyUpdate";
import ChecklistConfig from "@/models/ChecklistConfig";
import Task from "@/models/Task";

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

    if (!session || session.user.role !== "employee") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const employeeId = session.user.id;

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
      // Default to 30 days ago
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);
      defaultStart.setHours(0, 0, 0, 0);
      startDate = defaultStart;
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

    // Map: dateKey -> SummaryRow
    const summaryMap = new Map<string, SummaryRow>();

    const getOrCreateRow = (dateKey: string): SummaryRow => {
      let row = summaryMap.get(dateKey);
      if (!row) {
        row = {
          employeeId,
          employeeName: session.user.name || "Employee",
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
        summaryMap.set(dateKey, row);
      }
      return row;
    };

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
        .replace(/\s+/g, " ");
    };

    // Helper to find the appropriate checklist config for this employee
    const getEmployeeChecklistConfig = (
      employeeSkills: string[]
    ): any => {
      // 1. Check for custom config
      const customConfigs = checklistConfigs.filter((c: any) => c.type === "custom");
      const customConfig = customConfigs.find((config: any) => {
        if (config.employeeIds && Array.isArray(config.employeeIds)) {
          return config.employeeIds.some(
            (id: any) =>
              (id.toString ? id.toString() : String(id)) === employeeId
          );
        }
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

    // Fetch employee profile to get skills
    const employeeProfile = await db
      .collection("employeeProfiles")
      .findOne({ userId: new ObjectId(employeeId) });
    const employeeSkills = (employeeProfile?.skills || [])
      .filter((s: string) => s && typeof s === "string")
      .map((s: string) => s.toLowerCase().trim())
      .filter((s: string) => s.length > 0);

    const config = getEmployeeChecklistConfig(employeeSkills);
    const rewardMap = new Map<string, { bonus: number; bonusCurrency: number; fine: number; fineCurrency: number }>();
    if (config) {
      for (const check of config.checks || []) {
        if (typeof check === "string") {
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
        rewardMap.set(label, { bonus, bonusCurrency, fine, fineCurrency });
      }
    }

    // Process daily updates
    // Normalize dates for MongoDB query (ensure endDate includes the full day)
    const startDateForQuery = new Date(startDate);
    startDateForQuery.setHours(0, 0, 0, 0);
    const endDateForQuery = new Date(endDate);
    endDateForQuery.setHours(23, 59, 59, 999);
    
    const dailyUpdates = await DailyUpdate.find({
      employeeId: new ObjectId(employeeId),
      date: { $gte: startDateForQuery, $lte: endDateForQuery },
      adminApproved: true,
    }).lean();

    for (const du of dailyUpdates as any[]) {
      const dateKey = toDateKey(du.date || du.createdAt || new Date());
      const row = getOrCreateRow(dateKey);

      for (const item of du.checklist || []) {
        const labelKey = normalizeLabel(item.label || "");
        if (!labelKey) continue;
        const cfg = rewardMap.get(labelKey);
        if (!cfg) continue;

        if (cfg.bonus > 0) {
          row.checklistRewardTotal += cfg.bonus;
        }
        if (cfg.bonusCurrency > 0) {
          row.checklistRewardTotalCurrency += cfg.bonusCurrency;
        }

        if (item.checked && cfg.bonus > 0) {
          row.checklistEarned += cfg.bonus;
        }
        if (item.checked && cfg.bonusCurrency > 0) {
          row.checklistEarnedCurrency += cfg.bonusCurrency;
        }

        if (!item.checked && cfg.fine > 0) {
          row.checklistFine += cfg.fine;
        }
        if (!item.checked && cfg.fineCurrency > 0) {
          row.checklistFineCurrency += cfg.fineCurrency;
        }
      }
    }

    // ----------------------------
    // 2) Task-based Rewards/Fines
    // ----------------------------
    // Query all tasks assigned to this employee - we'll filter by penalty/reward event date later
    // This ensures we don't miss tasks where the penalty event occurred in the period
    // even if the task was created/completed outside the period
    const allTasks = await Task.find({
      $or: [
        { assignedTo: new ObjectId(employeeId) },
        { assignees: new ObjectId(employeeId) },
      ],
    }).lean();

    for (const task of allTasks as any[]) {
      const bonus = typeof task.bonusPoints === "number" ? task.bonusPoints : 0;
      const bonusCurrency = typeof task.bonusCurrency === "number" ? task.bonusCurrency : 0;
      let penalty = typeof task.penaltyPoints === "number" ? task.penaltyPoints : 0;
      let penaltyCurrency = typeof task.penaltyCurrency === "number" ? task.penaltyCurrency : 0;
      
      // If penaltyCurrency is 0 but penaltyPoints exists, use penaltyPoints as fallback
      if (penaltyCurrency <= 0 && penalty > 0) {
        penaltyCurrency = penalty;
      }

      // Determine if this task resulted in reward or fine FIRST
      // Then determine the event date and whether it's in the period
      let baseDate: Date | null = null;
      let penaltyEventInPeriod = false;
      let rewardEventInPeriod = false;

      // Determine if this task resulted in reward or fine
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      // Skip tasks marked as not applicable - they don't contribute to bonus/penalty
      const taskAny = task as any;
      if (taskAny.notApplicable === true) {
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

          const completedAt = task.tickedAt || task.completedAt || task.updatedAt || nowLocal;

          if (deadlineDate && completedAt > deadlineDate) {
            shouldGetPenalty = true;
            // Penalty event is when task was completed late
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
            // Normalize dates for comparison
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
            // Calculate the deadline date that passed
            let deadlinePassedDate: Date | null = null;
            
            if (task.deadlineTime) {
              // For recurring tasks, use today's date if deadlineTime exists
              if (isRecurring) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                deadlinePassedDate = task.deadlineDate ? new Date(task.deadlineDate) : today;
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else if (task.deadlineDate) {
                deadlinePassedDate = new Date(task.deadlineDate);
                deadlinePassedDate.setHours(0, 0, 0, 0);
              } else {
                deadlinePassedDate = new Date();
                deadlinePassedDate.setHours(0, 0, 0, 0);
              }
              
              // Parse deadline time
              const [h, m] = task.deadlineTime.split(":");
              deadlinePassedDate.setHours(parseInt(h), parseInt(m), 0, 0);
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
            
            // Use the deadline date that passed, or fallback to approval/update date
            if (deadlinePassedDate) {
              baseDate = deadlinePassedDate;
              // Normalize dates for comparison
              const deadlineDateNormalized = new Date(deadlinePassedDate);
              deadlineDateNormalized.setHours(0, 0, 0, 0);
              const startDateNormalized = new Date(startDate);
              startDateNormalized.setHours(0, 0, 0, 0);
              const endDateNormalized = new Date(endDate);
              endDateNormalized.setHours(23, 59, 59, 999);
              
              // Check if this deadline date is within the selected period
              if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
                penaltyEventInPeriod = true;
              }
            } else {
              // Fallback to approval/update date if we can't determine deadline
              baseDate = task.approvedAt || task.updatedAt || task.createdAt;
              if (baseDate) {
                const approvedDate = new Date(baseDate);
                if (approvedDate >= startDate && approvedDate <= endDate) {
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
      const row = getOrCreateRow(dateKey);
      
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

    // ----------------------------
    // 2.5) TaskCompletion Records (Historical tasks that were reset)
    // ----------------------------
    const TaskCompletion = (await import("@/models/TaskCompletion")).default;
    const taskCompletions = await TaskCompletion.find({
      $or: [
        { assignedTo: new ObjectId(employeeId) },
        { assignees: new ObjectId(employeeId) },
        { completedBy: new ObjectId(employeeId) },
      ],
    }).lean();

    for (const completion of taskCompletions as any[]) {
      // Check if completion event occurred within the period (same as admin route)
      const completionDate = completion.approvedAt || completion.tickedAt || completion.completedAt || completion.createdAt;
      if (!completionDate) continue;
      
      const eventDate = new Date(completionDate);
      if (eventDate < startDate || eventDate > endDate) {
        continue; // Skip if outside period
      }

      const bonus = typeof completion.bonusPoints === "number" ? completion.bonusPoints : 0;
      const bonusCurrency = typeof completion.bonusCurrency === "number" ? completion.bonusCurrency : 0;
      const penalty = typeof completion.penaltyPoints === "number" ? completion.penaltyPoints : 0;
      let penaltyCurrency = typeof completion.penaltyCurrency === "number" ? completion.penaltyCurrency : 0;
      
      // Use penaltyPoints as fallback if penaltyCurrency is 0
      if (penaltyCurrency <= 0 && penalty > 0) {
        penaltyCurrency = penalty;
      }

      // Determine if this completion resulted in reward or fine (same logic as admin route)
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
        if (penaltyCurrency > 0 || penalty > 0) {
          shouldGetPenalty = true;
        }
      }

      const dateKey = toDateKey(completionDate);
      const row = getOrCreateRow(dateKey);
      
      // Add to totals
      row.taskRewardTotal += bonus;
      row.taskRewardTotalCurrency += bonusCurrency;

      if (shouldGetPenalty) {
        // Apply penalty points if available
        if (penalty > 0) {
          row.taskFine += penalty;
        }
        // Apply penalty currency
        if (penaltyCurrency > 0) {
          row.taskFineCurrency += penaltyCurrency;
        }
      } else if (shouldGetReward) {
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

    // ----------------------------
    // 3) Project-level Rewards/Fines
    // ----------------------------
    // Query all projects assigned to this employee - we'll filter by event date later
    const allProjects = await db
      .collection("projects")
      .find({
        $or: [
          { leadAssignee: new ObjectId(employeeId) },
          { leadAssignee: { $in: [new ObjectId(employeeId)] } }
        ],
      })
      .toArray();

    for (const project of allProjects as any[]) {
      const bonus =
        typeof project.bonusPoints === "number" ? project.bonusPoints : 0;
      const bonusCurrency =
        typeof project.bonusCurrency === "number" ? project.bonusCurrency : 0;
      const penalty =
        typeof project.penaltyPoints === "number" ? project.penaltyPoints : 0;
      const penaltyCurrency =
        typeof project.penaltyCurrency === "number" ? project.penaltyCurrency : 0;

      const status = project.status || "in_progress";
      const now = new Date();
      
      // Check if deadline has passed
      let deadlinePassed = false;
      let deadlineDate: Date | null = null;
      if (project.deadline) {
        deadlineDate = new Date(project.deadline);
        deadlinePassed = now > deadlineDate;
      } else if (project.dueDate) {
        deadlineDate = new Date(project.dueDate);
        deadlinePassed = now > deadlineDate;
      }

      // Determine event date and whether it's in the period
      let eventDate: Date | null = null;
      let eventInPeriod = false;

      if (status === "completed") {
        // Reward event is when project was completed
        eventDate = project.completedAt || project.updatedAt || project.assignedAt || project.createdAt;
        if (eventDate) {
          const eventDateNormalized = new Date(eventDate);
          eventDateNormalized.setHours(0, 0, 0, 0);
          const startDateNormalized = new Date(startDate);
          startDateNormalized.setHours(0, 0, 0, 0);
          const endDateNormalized = new Date(endDate);
          endDateNormalized.setHours(23, 59, 59, 999);
          if (eventDateNormalized >= startDateNormalized && eventDateNormalized <= endDateNormalized) {
            eventInPeriod = true;
          }
        }
      } else if (status !== "completed" && deadlinePassed && deadlineDate) {
        // Penalty event is when deadline passed
        eventDate = deadlineDate;
        const deadlineDateNormalized = new Date(deadlineDate);
        deadlineDateNormalized.setHours(0, 0, 0, 0);
        const startDateNormalized = new Date(startDate);
        startDateNormalized.setHours(0, 0, 0, 0);
        const endDateNormalized = new Date(endDate);
        endDateNormalized.setHours(23, 59, 59, 999);
        if (deadlineDateNormalized >= startDateNormalized && deadlineDateNormalized <= endDateNormalized) {
          eventInPeriod = true;
        }
      }

      // Only process if event occurred in the period
      if (!eventInPeriod) {
        continue;
      }

      if (!eventDate) {
        eventDate = project.assignedAt || project.updatedAt || project.createdAt;
      }
      if (!eventDate) continue;
      
      const dateKey = toDateKey(eventDate);
      const row = getOrCreateRow(dateKey);

      row.projectRewardTotal += bonus;
      row.projectRewardTotalCurrency += bonusCurrency;

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

    // ----------------------------
    // 4) Hackathon Prizes (only for declared winners)
    // ----------------------------
    const hackathons = await db
      .collection("hackathons")
      .find({
        winnerId: new ObjectId(employeeId),
        winnerDeclaredAt: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    for (const hackathon of hackathons as any[]) {
      const prizePoints = typeof hackathon.prizePoints === "number" ? hackathon.prizePoints : 0;
      const prizeCurrency = typeof hackathon.prizeCurrency === "number" ? hackathon.prizeCurrency : 0;
      const prizePool = typeof hackathon.prizePool === "number" ? hackathon.prizePool : 0;
      
      const actualPrizePoints = prizePoints > 0 ? prizePoints : prizePool;
      const actualPrizeCurrency = prizeCurrency;
      
      if (actualPrizePoints <= 0 && actualPrizeCurrency <= 0) continue;

      const winnerDeclaredAt = hackathon.winnerDeclaredAt || hackathon.updatedAt || hackathon.createdAt;
      if (!winnerDeclaredAt) continue;
      const dateKey = toDateKey(winnerDeclaredAt);

      const row = getOrCreateRow(dateKey);
      // Hackathon prizes are tracked separately
      row.hackathonEarned += actualPrizePoints;
      row.hackathonEarnedCurrency += actualPrizeCurrency;
    }

    // ----------------------------
    // 5) Compute totals
    // ----------------------------
    for (const row of summaryMap.values()) {
      const projectNet = row.projectEarned - row.projectFine;
      const checklistNet = row.checklistEarned - row.checklistFine;
      const taskNet = row.taskEarned - row.taskFine;
      row.totalPoints = projectNet + checklistNet + taskNet + row.hackathonEarned;
      
      const projectNetCurr = row.projectEarnedCurrency - row.projectFineCurrency;
      const checklistNetCurr = row.checklistEarnedCurrency - row.checklistFineCurrency;
      const taskNetCurr = row.taskEarnedCurrency - row.taskFineCurrency;
      row.totalCurrency = projectNetCurr + checklistNetCurr + taskNetCurr + row.hackathonEarnedCurrency;
    }

    // ----------------------------
    // 6) Fetch and merge custom bonus/fine data
    // ----------------------------
    // Normalize employeeId for comparison
    const normalizeEmployeeId = (id: any): string => {
      if (!id) return "";
      return id.toString ? id.toString() : String(id);
    };
    
    const employeeIdStr = normalizeEmployeeId(employeeId);
    
    // Fetch custom bonus/fine entries
    const customBonusFineData = await db
      .collection("customBonusFine")
      .find({})
      .toArray();

    // Filter and merge custom bonus/fine into rows
    for (const custom of customBonusFineData) {
      const customEmployeeId = normalizeEmployeeId(custom.employeeId);
      if (customEmployeeId !== employeeIdStr) continue;
      
      // Check if the custom entry date is within the selected period
      const customDate = custom.date;
      if (!customDate) continue;
      
      // Convert custom date to Date object for comparison
      const customDateObj = new Date(customDate);
      customDateObj.setHours(0, 0, 0, 0);
      const startDateNormalized = new Date(startDate);
      startDateNormalized.setHours(0, 0, 0, 0);
      const endDateNormalized = new Date(endDate);
      endDateNormalized.setHours(23, 59, 59, 999);
      
      // Skip if outside the period
      if (customDateObj < startDateNormalized || customDateObj > endDateNormalized) {
        continue;
      }
      
      const dateKey = toDateKey(customDate);
      const row = getOrCreateRow(dateKey);
      
      // Merge custom entries
      if (custom.customBonusEntries && Array.isArray(custom.customBonusEntries)) {
        (row as any).customBonusEntries = custom.customBonusEntries;
      }
      if (custom.customFineEntries && Array.isArray(custom.customFineEntries)) {
        (row as any).customFineEntries = custom.customFineEntries;
      }
    }

    // Convert to sorted array (latest date first)
    const rows = Array.from(summaryMap.values()).sort((a, b) => {
      return a.date < b.date ? 1 : -1;
    });

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("Error fetching employee bonus summary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

