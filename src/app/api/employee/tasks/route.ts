import {getServerSession} from "next-auth";
import {NextRequest, NextResponse} from "next/server";
import {authOptions} from "../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "employee") {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Get employee's user ID
    const user = await db.collection("users").findOne({
      email: session.user.email
    });

    if (!user) {
      return NextResponse.json({error: "User not found"}, {status: 404});
    }

    const userIdString = user._id.toString();
    const userIdObj = user._id;

    // Try finding tasks with different ID formats
    let tasks = await db
      .collection("employeeTasks")
      .find({employeeId: userIdString})
      .sort({assignedAt: -1})
      .toArray();

    // If no tasks found with string, try with ObjectId
    if (tasks.length === 0) {
      tasks = await db
        .collection("employeeTasks")
        .find({employeeId: userIdObj})
        .sort({assignedAt: -1})
        .toArray();
    }

    return NextResponse.json({tasks});
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({error: "Failed to fetch tasks"}, {status: 500});
  }
}
