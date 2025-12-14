import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Subtask from "@/models/Subtask";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET - Check if all subtasks are completed for a task
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    await dbConnect();

    const subtasks = await Subtask.find({ taskId });
    
    if (subtasks.length === 0) {
      // No subtasks means task can be completed
      return NextResponse.json({ 
        canComplete: true, 
        allCompleted: true,
        totalSubtasks: 0,
        completedSubtasks: 0
      }, { status: 200 });
    }

    const completedSubtasks = subtasks.filter((st) => st.status === "completed").length;
    const allCompleted = completedSubtasks === subtasks.length;

    return NextResponse.json({ 
      canComplete: allCompleted,
      allCompleted,
      totalSubtasks: subtasks.length,
      completedSubtasks
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error checking subtask completion:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
