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

    if (!session || session.user.role !== "employee") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const employeeId = session.user.id;

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
    const rewardMap = new Map<string, { bonus: number; fine: number }>();
    if (config) {
      for (const check of config.checks || []) {
        if (typeof check === "string") {
          continue;
        }
        const label = normalizeLabel((check as any).text || "");
        if (!label) continue;
        const bonus =
          typeof (check as any).bonus === "number" ? (check as any).bonus : 0;
        const fine =
          typeof (check as any).fine === "number" ? (check as any).fine : 0;
        rewardMap.set(label, { bonus, fine });
      }
    }

    // Process daily updates
    const dailyUpdates = await DailyUpdate.find({
      employeeId: new ObjectId(employeeId),
      date: { $gte: startDate, $lte: endDate },
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

        if (item.checked && cfg.bonus > 0) {
          row.checklistEarned += cfg.bonus;
        }

        if (!item.checked && cfg.fine > 0) {
          row.checklistFine += cfg.fine;
        }
      }
    }

    // ----------------------------
    // 2) Task-based Rewards/Fines
    // ----------------------------
    const tasks = await Task.find({
      $or: [
        { assignedTo: new ObjectId(employeeId) },
        { assignees: new ObjectId(employeeId) },
      ],
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    for (const task of tasks as any[]) {
      const bonus = typeof task.bonusPoints === "number" ? task.bonusPoints : 0;
      const penalty =
        typeof task.penaltyPoints === "number" ? task.penaltyPoints : 0;

      const baseDate =
        task.tickedAt || task.completedAt || task.assignedDate || task.createdAt;
      if (!baseDate) continue;
      const dateKey = toDateKey(baseDate);

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

      const row = getOrCreateRow(dateKey);
      row.taskRewardTotal += bonus;

      if (shouldGetPenalty && penalty > 0) {
        row.taskFine += penalty;
      } else if (shouldGetReward && bonus > 0) {
        row.taskEarned += bonus;
      }
    }

    // ----------------------------
    // 3) Project-level Rewards/Fines
    // ----------------------------
    const projects = await db
      .collection("projects")
      .find({
        leadAssignee: new ObjectId(employeeId),
        assignedAt: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    for (const project of projects as any[]) {
      const bonus =
        typeof project.bonusPoints === "number" ? project.bonusPoints : 0;
      const penalty =
        typeof project.penaltyPoints === "number" ? project.penaltyPoints : 0;

      const baseDate = project.assignedAt || project.updatedAt || project.createdAt;
      if (!baseDate) continue;
      const dateKey = toDateKey(baseDate);

      const row = getOrCreateRow(dateKey);

      row.projectRewardTotal += bonus;

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
        winnerId: new ObjectId(employeeId),
        winnerDeclaredAt: { $gte: startDate, $lte: endDate },
      })
      .toArray();

    for (const hackathon of hackathons as any[]) {
      const prizePool = typeof hackathon.prizePool === "number" ? hackathon.prizePool : 0;
      if (prizePool <= 0) continue;

      const winnerDeclaredAt = hackathon.winnerDeclaredAt || hackathon.updatedAt || hackathon.createdAt;
      if (!winnerDeclaredAt) continue;
      const dateKey = toDateKey(winnerDeclaredAt);

      const row = getOrCreateRow(dateKey);
      // Hackathon prizes are tracked separately
      row.hackathonEarned += prizePool;
    }

    // ----------------------------
    // 5) Compute totals
    // ----------------------------
    for (const row of summaryMap.values()) {
      const projectNet = row.projectEarned - row.projectFine;
      const checklistNet = row.checklistEarned - row.checklistFine;
      const taskNet = row.taskEarned - row.taskFine;
      row.totalPoints = projectNet + checklistNet + taskNet + row.hackathonEarned;
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

