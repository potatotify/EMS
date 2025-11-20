import {getServerSession} from "next-auth";
import {NextRequest, NextResponse} from "next/server";
import {authOptions} from "../../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export async function POST(
  request: NextRequest,
  {params}: {params: Promise<{employeeId: string}>}
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {employeeId} = await params;
    const {title, description, dueDate, priority} = await request.json();

    if (!title) {
      return NextResponse.json(
        {error: "Task title is required"},
        {status: 400}
      );
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Verify employee exists - check employeeProfiles collection
    const employeeProfile = await db.collection("employeeProfiles").findOne({
      _id: new ObjectId(employeeId)
    });

    if (!employeeProfile) {
      return NextResponse.json({error: "Employee not found"}, {status: 404});
    }

    // Get user details for employee name
    const user = await db.collection("users").findOne({
      _id: new ObjectId(employeeProfile.userId)
    });

    // Create task - store both employeeProfileId and userId for flexibility
    // IMPORTANT: Convert all IDs to strings for consistent querying
    const userIdString =
      typeof employeeProfile.userId === "string"
        ? employeeProfile.userId
        : employeeProfile.userId.toString();

    const task = {
      employeeProfileId: employeeId, // This is the employeeProfiles._id as string
      userId: userIdString, // This is the users._id as string
      employeeId: userIdString, // For querying - use userId as string
      employeeName: employeeProfile.fullName || user?.email || "Unknown",
      title,
      description: description || "",
      dueDate: dueDate || null,
      priority: priority || "medium",
      status: "pending",
      completed: false,
      assignedBy: session.user?.email,
      assignedAt: new Date(),
      completedAt: null
    };

    console.log("Creating task with employeeProfileId:", employeeId);
    console.log("Original userId:", employeeProfile.userId);
    console.log("userId as string:", userIdString);
    console.log("Full task object:", task);

    const result = await db.collection("employeeTasks").insertOne(task);

    console.log("Task created with _id:", result.insertedId);

    return NextResponse.json({
      message: "Task assigned successfully",
      taskId: result.insertedId,
      debug: {
        employeeProfileId: employeeId,
        userId: employeeProfile.userId,
        storedEmployeeId: task.employeeId
      }
    });
  } catch (error) {
    console.error("Error assigning task:", error);
    return NextResponse.json({error: "Failed to assign task"}, {status: 500});
  }
}

export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{employeeId: string}>}
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {employeeId} = await params;
    const client = await clientPromise;
    const db = client.db("worknest");

    // Get employee profile to find userId
    const employeeProfile = await db.collection("employeeProfiles").findOne({
      _id: new ObjectId(employeeId)
    });

    if (!employeeProfile) {
      return NextResponse.json({error: "Employee not found"}, {status: 404});
    }

    // Fetch tasks using userId
    const tasks = await db
      .collection("employeeTasks")
      .find({employeeId: employeeProfile.userId})
      .sort({assignedAt: -1})
      .toArray();

    return NextResponse.json({tasks});
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({error: "Failed to fetch tasks"}, {status: 500});
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {searchParams} = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId || !ObjectId.isValid(taskId)) {
      return NextResponse.json({error: "Invalid task ID"}, {status: 400});
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    const result = await db.collection("employeeTasks").deleteOne({
      _id: new ObjectId(taskId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({error: "Task not found"}, {status: 404});
    }

    return NextResponse.json({message: "Task deleted successfully"});
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({error: "Failed to delete task"}, {status: 500});
  }
}
