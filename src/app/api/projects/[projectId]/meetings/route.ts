import {NextRequest, NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

// GET /api/projects/[projectId]/meetings - fetch all meetings for a project
export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{projectId: string}>}
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({error: "Unauthorized"}, {status: 403});
    }

    const {projectId} = await params;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return NextResponse.json({error: "Invalid project ID"}, {status: 400});
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    const meetings = await db
      .collection("projectMeetings")
      .find({projectId: new ObjectId(projectId)})
      .sort({meetingDate: 1})
      .toArray();

    return NextResponse.json({meetings});
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// POST /api/projects/[projectId]/meetings - schedule a new meeting
export async function POST(
  request: NextRequest,
  {params}: {params: Promise<{projectId: string}>}
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({error: "Unauthorized"}, {status: 403});
    }

    const {projectId} = await params;
    const {meetingDate, meetingTime, topic, meetingLink} = await request.json();

    if (!projectId || !ObjectId.isValid(projectId)) {
      return NextResponse.json({error: "Invalid project ID"}, {status: 400});
    }

    if (!meetingDate || !meetingTime || !topic || !meetingLink) {
      return NextResponse.json(
        {error: "All fields are required"},
        {status: 400}
      );
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Verify project exists
    const project = await db
      .collection("projects")
      .findOne({_id: new ObjectId(projectId)});
    if (!project) {
      return NextResponse.json({error: "Project not found"}, {status: 404});
    }

    const meeting = {
      projectId: new ObjectId(projectId),
      meetingDate: new Date(meetingDate),
      meetingTime,
      topic,
      meetingLink,
      createdBy: new ObjectId(session.user.id),
      createdAt: new Date()
    };

    const result = await db.collection("projectMeetings").insertOne(meeting);

    return NextResponse.json({
      success: true,
      meetingId: result.insertedId
    });
  } catch (error) {
    console.error("Error scheduling meeting:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}

// DELETE /api/projects/[projectId]/meetings - delete a meeting
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({error: "Unauthorized"}, {status: 403});
    }

    const {searchParams} = new URL(request.url);
    const meetingId = searchParams.get("meetingId");

    if (!meetingId || !ObjectId.isValid(meetingId)) {
      return NextResponse.json({error: "Invalid meeting ID"}, {status: 400});
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    await db
      .collection("projectMeetings")
      .deleteOne({_id: new ObjectId(meetingId)});

    return NextResponse.json({success: true});
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
