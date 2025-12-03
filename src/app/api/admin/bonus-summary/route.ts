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
  projectEarned: number;
  projectFine: number;
  // Daily checklist
  checklistRewardTotal: number;
  checklistEarned: number;
  checklistFine: number;
  // Tasks
  taskRewardTotal: number;
  taskEarned: number;
  taskFine: number;
  // Hackathon
  hackathonEarned: number;
  // Overall
  totalPoints: number;
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
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);

    const startDate = startParam ? new Date(startParam) : defaultStart;
    const endDate = endParam ? new Date(endParam) : now;

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
          projectEarned: 0,
          projectFine: 0,
          checklistRewardTotal: 0,
          checklistEarned: 0,
          checklistFine: 0,
          taskRewardTotal: 0,
          taskEarned: 0,
          taskFine: 0,
          hackathonEarned: 0,
          totalPoints: 0,
        };
        summaryMap.set(key, row);
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
      Map<string, { bonus: number; fine: number }>
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
      const rewardMap = new Map<string, { bonus: number; fine: number }>();
      for (const check of config.checks || []) {
        if (typeof check === "string") {
          // No bonus/fine info in legacy string format
          continue;
        }
        const label = normalizeLabel((check as any).text || "");
        if (!label) continue;
        const bonus =
          typeof (check as any).bonus === "number" ? (check as any).bonus : 0;
        const fine =
          typeof (check as any).fine === "number" ? (check as any).fine : 0;

        // Store the bonus/fine for this label
        rewardMap.set(label, { bonus, fine });
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

        // If checked: employee earns the bonus (count every checked item)
        if (item.checked && cfg.bonus > 0) {
          row.checklistEarned += cfg.bonus;
        }

        // If NOT checked: employee gets the fine (count every unchecked item)
        if (!item.checked && cfg.fine > 0) {
          row.checklistFine += cfg.fine;
        }
      }
    }

    // ----------------------------
    // 2) Task-based Rewards/Fines
    // ----------------------------
    const tasks = await Task.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    for (const task of tasks as any[]) {
      const bonus = typeof task.bonusPoints === "number" ? task.bonusPoints : 0;
      const penalty =
        typeof task.penaltyPoints === "number" ? task.penaltyPoints : 0;

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

      // Date for attribution - when the task was ticked/completed or created
      const baseDate =
        task.tickedAt || task.completedAt || task.assignedDate || task.createdAt;
      if (!baseDate) continue;
      const dateKey = toDateKey(baseDate);

      // Determine if this task resulted in reward or fine (similar logic to analysis route)
      let shouldGetPenalty = false;
      let shouldGetReward = false;

      const approvalStatus: string = task.approvalStatus || "pending";
      const nowLocal = new Date();

      if (approvalStatus === "approved") {
        if (task.status === "completed") {
          let deadlineDate: Date | null = null;

          if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            if (task.deadlineTime) {
              const [h, m] = task.deadlineTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
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
          } else if (bonus > 0) {
            shouldGetReward = true;
          }
        } else {
          // Not completed but approved - if deadline passed, treat as penalty if configured
          let deadlineDate: Date | null = null;
          if (task.deadlineDate) {
            deadlineDate = new Date(task.deadlineDate);
            if (task.deadlineTime) {
              const [h, m] = task.deadlineTime.split(":");
              deadlineDate.setHours(parseInt(h), parseInt(m), 0, 0);
            } else {
              deadlineDate.setHours(23, 59, 59, 999);
            }
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
          }
        }
      } else if (
        approvalStatus === "rejected" ||
        approvalStatus === "deadline_passed"
      ) {
        if (penalty > 0) {
          shouldGetPenalty = true;
        }
      }

      for (const empId of employeeIds) {
        const row = getOrCreateRow(empId, dateKey);
        // Total potential reward from tasks
        row.taskRewardTotal += bonus;

        if (shouldGetPenalty && penalty > 0) {
          row.taskFine += penalty;
        } else if (shouldGetReward && bonus > 0) {
          row.taskEarned += bonus;
        }
      }
    }

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

      const employeeId = lead.toString();
      const bonus =
        typeof project.bonusPoints === "number" ? project.bonusPoints : 0;
      const penalty =
        typeof project.penaltyPoints === "number" ? project.penaltyPoints : 0;

      const baseDate = project.assignedAt || project.updatedAt || project.createdAt;
      if (!baseDate) continue;
      const dateKey = toDateKey(baseDate);

      const row = getOrCreateRow(employeeId, dateKey);

      row.projectRewardTotal += bonus;

      // Simple heuristic:
      // - If project is completed, employee gets the bonus
      // - If not completed and penalty configured, count it as fine
      const status = project.status || "in_progress";
      if (status === "completed" && bonus > 0) {
        row.projectEarned += bonus;
      } else if (status !== "completed" && penalty > 0) {
        row.projectFine += penalty;
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

      const prizePool = typeof hackathon.prizePool === "number" ? hackathon.prizePool : 0;
      if (prizePool <= 0) continue;

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
        row.hackathonEarned += prizePool;
      }
    }

    // ----------------------------
    // 5) Attach employee names & compute totals
    // ----------------------------
    const summaryEmployeeIds = Array.from(
      new Set(Array.from(summaryMap.values()).map((r) => r.employeeId))
    );

    if (summaryEmployeeIds.length > 0) {
      const users = await db
        .collection("users")
        .find({ _id: { $in: summaryEmployeeIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1 })
        .toArray();

      const nameMap = new Map<string, string>();
      for (const u of users as any[]) {
        nameMap.set(u._id.toString(), u.name || "Unknown");
      }

      for (const row of summaryMap.values()) {
        row.employeeName = nameMap.get(row.employeeId) || "Unknown";
        const projectNet = row.projectEarned - row.projectFine;
        const checklistNet = row.checklistEarned - row.checklistFine;
        const taskNet = row.taskEarned - row.taskFine;
        row.totalPoints = projectNet + checklistNet + taskNet + row.hackathonEarned;
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


