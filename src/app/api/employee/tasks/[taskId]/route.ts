import {getServerSession} from "next-auth";
import {NextRequest, NextResponse} from "next/server";
import {authOptions} from "../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export async function PATCH(
  request: NextRequest,
  {params}: {params: Promise<{taskId: string}>}
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "employee") {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {taskId} = await params;
    const {completed} = await request.json();

    if (!ObjectId.isValid(taskId)) {
      return NextResponse.json({error: "Invalid task ID"}, {status: 400});
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

    console.log("\n=== TASK UPDATE ===");
    console.log("TaskId:", taskId);
    console.log("User _id (String):", userIdString);
    console.log("User _id (Object):", userIdObj);
    console.log("Completed:", completed);

    // Try updating with string ID first
    let result = await db.collection("employeeTasks").updateOne(
      {
        _id: new ObjectId(taskId),
        employeeId: userIdString
      },
      {
        $set: {
          completed,
          status: completed ? "completed" : "pending",
          completedAt: completed ? new Date() : null
        }
      }
    );

    console.log(
      "Update result with string ID - matched:",
      result.matchedCount,
      "modified:",
      result.modifiedCount
    );

    // If no match, try with ObjectId
    if (result.matchedCount === 0) {
      console.log("Trying with ObjectId format...");
      result = await db.collection("employeeTasks").updateOne(
        {
          _id: new ObjectId(taskId),
          employeeId: userIdObj
        },
        {
          $set: {
            completed,
            status: completed ? "completed" : "pending",
            completedAt: completed ? new Date() : null
          }
        }
      );
      console.log(
        "Update result with ObjectId - matched:",
        result.matchedCount,
        "modified:",
        result.modifiedCount
      );
    }

    console.log("=== END TASK UPDATE ===\n");

    if (result.matchedCount === 0) {
      return NextResponse.json(
        {error: "Task not found or unauthorized"},
        {status: 404}
      );
    }

    return NextResponse.json({
      message: "Task updated successfully"
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({error: "Failed to update task"}, {status: 500});
  }
}
