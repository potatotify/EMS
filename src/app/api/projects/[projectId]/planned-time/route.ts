import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * POST /api/projects/[projectId]/planned-time
 * Save or update planned time for a project (lead assignee only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { projectId } = await params;
    const body = await request.json();
    const { plannedDate, plannedTime } = body;

    if (!plannedDate || !plannedTime) {
      return NextResponse.json(
        { error: "Planned date and time are required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("worknest");
    const userId = session.user.id;
    const userIdObj = new ObjectId(userId);

    // Get project and verify user is lead assignee
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId)
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is lead assignee
    let isLeadAssignee = false;
    if (project.leadAssignee) {
      if (Array.isArray(project.leadAssignee)) {
        isLeadAssignee = project.leadAssignee.some((lead: any) => {
          const leadId = lead instanceof ObjectId ? lead.toString() : 
                        (typeof lead === 'object' && lead._id ? lead._id.toString() : lead.toString());
          return leadId === userId;
        });
      } else {
        const leadId = project.leadAssignee instanceof ObjectId 
          ? project.leadAssignee.toString() 
          : (typeof project.leadAssignee === 'object' && project.leadAssignee._id 
              ? project.leadAssignee._id.toString() 
              : project.leadAssignee.toString());
        isLeadAssignee = leadId === userId;
      }
    }

    if (!isLeadAssignee && session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Only lead assignees can set planned time" },
        { status: 403 }
      );
    }

    // Update project with planned time
    const plannedDateTime = new Date(`${plannedDate}T${plannedTime}`);

    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          plannedDate: plannedDate,
          plannedTime: plannedTime,
          plannedDateTime: plannedDateTime,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: "Planned time saved successfully"
    });
  } catch (error) {
    console.error("Error saving planned time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[projectId]/planned-time
 * Get planned time for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { projectId } = await params;

    const client = await clientPromise;
    const db = client.db("worknest");

    const project = await db.collection("projects").findOne(
      { _id: new ObjectId(projectId) },
      { projection: { plannedDate: 1, plannedTime: 1, plannedDateTime: 1 } }
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      plannedDate: project.plannedDate || null,
      plannedTime: project.plannedTime || null,
      plannedDateTime: project.plannedDateTime || null
    });
  } catch (error) {
    console.error("Error fetching planned time:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

