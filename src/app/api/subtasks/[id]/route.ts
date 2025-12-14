import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise, { dbConnect } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// PATCH - Update a subtask (toggle completion)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { ticked } = body;

    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");

    // First, get the subtask to check assignment
    const subtask = await db.collection("subtasks").findOne({ _id: new ObjectId(id) });
    
    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    // Check if user is the assignee or admin
    const userId = new ObjectId(session.user.id);
    const isAssignee = subtask.assignee && subtask.assignee.toString() === userId.toString();
    const isAdmin = session.user.role === "admin";

    // Only assignee or admin can toggle the subtask
    if (!isAssignee && !isAdmin) {
      return NextResponse.json({ 
        error: "You can only tick subtasks assigned to you" 
      }, { status: 403 });
    }

    // Update the subtask
    const result = await db.collection("subtasks").findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          ticked: ticked,
          tickedAt: ticked ? new Date() : null,
          completedBy: ticked ? new ObjectId(session.user.id) : null,
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      subtask: {
        ...result,
        _id: result._id.toString(),
      },
    });
  } catch (error) {
    console.error("Error updating subtask:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
