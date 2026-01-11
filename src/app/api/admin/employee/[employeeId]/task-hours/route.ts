import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { dbConnect } from "@/lib/mongodb";
import { Task } from "@/models";
import { ObjectId } from "mongodb";
import { isAdminOrHasPermission } from "@/lib/permission-helpers";
import { PERMISSIONS } from "@/lib/permission-constants";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ employeeId: string }> }
) {
  try {
    const params = await context.params;
    const { employeeId } = params;
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if admin or has VIEW_EMPLOYEES or MANAGE_EMPLOYEES permission
    const hasAccess = await isAdminOrHasPermission(PERMISSIONS.VIEW_EMPLOYEES) || 
                      await isAdminOrHasPermission(PERMISSIONS.MANAGE_EMPLOYEES);
    if (!hasAccess) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");

    // Validate ObjectId format
    if (!ObjectId.isValid(employeeId)) {
      return NextResponse.json(
        { error: "Invalid employee ID format" },
        { status: 400 }
      );
    }

    // Find employee profile by _id
    const profile = await db.collection("employeeProfiles").findOne({
      _id: new ObjectId(employeeId)
    });

    if (!profile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const userId = profile.userId;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 404 });
    }

    // Build query for completed tasks
    const taskQuery: any = {
      status: "completed",
      completedBy: userId instanceof ObjectId ? userId : new ObjectId(userId),
      timeSpent: { $exists: true, $ne: null, $gt: 0 }
    };

    // Add date filter if provided
    if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      
      // Filter by tickedAt (when task was completed) or completedAt
      taskQuery.$or = [
        { tickedAt: { $gte: startDate, $lte: endDate } },
        { completedAt: { $gte: startDate, $lte: endDate } }
      ];
    }

    // Fetch completed tasks with timeSpent
    const tasks = await Task.find(taskQuery).select("timeSpent tickedAt completedAt");

    // Calculate total hours
    const totalHours = tasks.reduce((sum: number, task: any) => {
      return sum + (Number(task.timeSpent) || 0);
    }, 0);

    return NextResponse.json({ 
      employeeId: employeeId,
      userId: userId.toString(),
      totalHours: totalHours,
      taskCount: tasks.length
    });
  } catch (error) {
    console.error("Error fetching task hours:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
