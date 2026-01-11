import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import DailyUpdate from "@/models/DailyUpdate";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Convert employeeId to ObjectId (could be userId or employeeProfileId)
    let userId: ObjectId;
    try {
      // First check if it's an employeeProfile ID
      const profile = await db.collection("employeeProfiles").findOne({
        _id: new ObjectId(employeeId),
      });

      if (profile && profile.userId) {
        userId = profile.userId instanceof ObjectId ? profile.userId : new ObjectId(profile.userId);
      } else {
        // Assume it's a userId directly
        userId = new ObjectId(employeeId);
      }
    } catch (error) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
    }

    // Set up date range (default to today if not provided)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = startDate ? new Date(startDate) : new Date(today);
    start.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : new Date(today);
    end.setHours(23, 59, 59, 999);

    const submissions: any[] = [];

    // 1. Fetch Daily Updates
    await dbConnect();
    const dailyUpdates = await DailyUpdate.find({
      employeeId: userId,
      date: {
        $gte: start,
        $lte: end,
      },
    })
      .sort({ date: -1 })
      .lean();

    dailyUpdates.forEach((update: any) => {
      submissions.push({
        date: update.date,
        type: "daily_update",
        title: "Daily Update",
        details: update.additionalNotes || update.tasksForTheDay || "Daily update submitted",
        status: update.status || "pending",
        hoursWorked: update.hoursWorked || 0,
        tasksCompleted: update.tasksForTheDay ? [update.tasksForTheDay] : [],
        checklistItems: update.checklist || [],
      });
    });

    // 2. Fetch Project Updates (from dailyUpdates collection with projectId)
    const projectUpdates = await db
      .collection("dailyUpdates")
      .find({
        employeeId: userId,
        projectId: { $exists: true },
        date: {
          $gte: start,
          $lte: end,
        },
      })
      .sort({ date: -1 })
      .toArray();

    projectUpdates.forEach((update: any) => {
      // Skip if already added as daily update
      const alreadyAdded = dailyUpdates.some(
        (du: any) => du._id.toString() === update._id.toString()
      );
      if (!alreadyAdded) {
        submissions.push({
          date: update.date,
          type: "project_update",
          title: "Project Update",
          details: update.notes || update.tasksCompleted?.join(", ") || "Project update submitted",
          status: update.status || "pending",
          hoursWorked: update.hoursWorked || 0,
          tasksCompleted: update.tasksCompleted || [],
        });
      }
    });

    // 3. Fetch Tasks (from tasks collection)
    const tasks = await db
      .collection("tasks")
      .find({
        assignedTo: userId,
        completedAt: {
          $gte: start,
          $lte: end,
        },
      })
      .sort({ completedAt: -1 })
      .toArray();

    tasks.forEach((task: any) => {
      submissions.push({
        date: task.completedAt || task.createdAt,
        type: "task",
        title: "Task Completed",
        details: task.title || task.description || "Task completed",
        status: task.status || "completed",
      });
    });

    // 4. Fetch Attendance Records
    const attendanceRecords = await db
      .collection("attendance")
      .find({
        userId: userId,
        date: {
          $gte: start,
          $lte: end,
        },
      })
      .sort({ date: -1 })
      .toArray();

    attendanceRecords.forEach((record: any) => {
      submissions.push({
        date: record.date,
        type: "attendance",
        title: "Attendance",
        details: record.workDetails || `Attendance marked as ${record.status || "present"}`,
        status: record.status || "present",
        hoursWorked: record.hoursWorked || 0,
        attendanceStatus: record.status || "present",
      });
    });

    // 5. Aggregate hours worked per day (from daily updates and attendance)
    const hoursByDate = new Map<string, number>();
    
    dailyUpdates.forEach((update: any) => {
      const dateStr = new Date(update.date).toISOString().split("T")[0];
      const hours = update.hoursWorked || 0;
      hoursByDate.set(dateStr, (hoursByDate.get(dateStr) || 0) + hours);
    });

    attendanceRecords.forEach((record: any) => {
      const dateStr = new Date(record.date).toISOString().split("T")[0];
      const hours = record.hoursWorked || 0;
      hoursByDate.set(dateStr, (hoursByDate.get(dateStr) || 0) + hours);
    });

    // Add hours worked entries
    hoursByDate.forEach((hours, dateStr) => {
      if (hours > 0) {
        submissions.push({
          date: dateStr,
          type: "hours_worked",
          title: "Hours Worked",
          details: `${hours} hours worked`,
          hoursWorked: hours,
        });
      }
    });

    // Sort all submissions by date (most recent first)
    submissions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      submissions,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching employee report:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee report" },
      { status: 500 }
    );
  }
}
