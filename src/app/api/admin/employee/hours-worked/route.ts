import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    const client = await clientPromise;
    const db = client.db("worknest");
    const tasksCollection = db.collection("tasks");

    if (employeeId) {
      // Get hours for specific employee
      const employeeObjectId = new ObjectId(employeeId);
      const tasks = await tasksCollection
        .find({
          status: "completed",
          timeSpent: { $exists: true, $ne: null, $gt: 0 },
          completedBy: employeeObjectId
        })
        .toArray();

      const totalHours = tasks.reduce((sum, task) => {
        return sum + (task.timeSpent || 0);
      }, 0);

      return NextResponse.json({ employeeId, hours: totalHours });
    } else {
      // Get hours for all employees
      
      // First, let's check all completed tasks regardless of timeSpent
      const allCompletedTasks = await tasksCollection
        .find({ status: "completed" })
        .toArray();
      console.log(`[Hours Worked] Total completed tasks: ${allCompletedTasks.length}`);
      
      // Check how many have timeSpent
      const tasksWithTimeSpent = allCompletedTasks.filter(t => t.timeSpent !== undefined && t.timeSpent !== null && t.timeSpent > 0);
      console.log(`[Hours Worked] Completed tasks with valid timeSpent: ${tasksWithTimeSpent.length}`);
      
      // Check sample task structure
      if (allCompletedTasks.length > 0) {
        const sample = allCompletedTasks[0];
        console.log(`[Hours Worked] Sample task:`, {
          _id: sample._id,
          status: sample.status,
          timeSpent: sample.timeSpent,
          completedBy: sample.completedBy,
          completedAt: sample.completedAt
        });
      }
      
      const tasks = await tasksCollection
        .find({
          status: "completed",
          timeSpent: { $exists: true, $ne: null, $gt: 0 },
          completedBy: { $exists: true }
        })
        .toArray();

      console.log(`[Hours Worked] Found ${tasks.length} completed tasks with timeSpent`);

      const hoursMap: Record<string, number> = {};

      tasks.forEach((task) => {
        let completedById: string | null = null;
        
        if (task.completedBy) {
          // Handle ObjectId or string
          if (task.completedBy instanceof ObjectId || task.completedBy._bsontype === 'ObjectId') {
            completedById = task.completedBy.toString();
          } else if (typeof task.completedBy === 'string') {
            completedById = task.completedBy;
          } else if (task.completedBy._id) {
            completedById = task.completedBy._id.toString();
          }
        }
        
        if (completedById) {
          hoursMap[completedById] = (hoursMap[completedById] || 0) + (task.timeSpent || 0);
          console.log(`[Hours Worked] Employee ${completedById}: +${task.timeSpent}h (total: ${hoursMap[completedById]}h)`);
        }
      });

      console.log(`[Hours Worked] Final hoursMap:`, hoursMap);
      return NextResponse.json({ hoursMap });
    }
  } catch (error) {
    console.error("Error fetching hours worked:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
