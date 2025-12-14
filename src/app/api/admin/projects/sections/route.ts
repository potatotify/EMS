import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST - Add a new section to a project
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { projectId, sectionName } = await request.json();

    if (!projectId || !sectionName) {
      return NextResponse.json(
        { error: "Project ID and section name are required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("worknest");
    const projectsCollection = db.collection("projects");
    const userId = new ObjectId(session.user.id);

    // Get current project
    const project = await projectsCollection.findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is admin or lead assignee
    const isAdmin = session.user.role === "admin";
    const isLeadAssignee = project.leadAssignee?.toString() === userId.toString();

    if (!isAdmin && !isLeadAssignee) {
      return NextResponse.json(
        { error: "Only admin or lead assignee can create sections" },
        { status: 403 }
      );
    }

    // Check if section already exists
    const sections = project.sections || [];
    if (sections.includes(sectionName)) {
      return NextResponse.json(
        { error: "Section already exists" },
        { status: 400 }
      );
    }

    // Add section to project
    await projectsCollection.updateOne(
      { _id: new ObjectId(projectId) },
      {
        $addToSet: { sections: sectionName },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Section added successfully",
    });
  } catch (error) {
    console.error("Error adding section:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a section from a project
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { projectId, sectionName } = await request.json();

    if (!projectId || !sectionName) {
      return NextResponse.json(
        { error: "Project ID and section name are required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("worknest");
    const projectsCollection = db.collection("projects");
    const userId = new ObjectId(session.user.id);

    // Get current project to check permissions
    const project = await projectsCollection.findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is admin or lead assignee
    const isAdmin = session.user.role === "admin";
    const isLeadAssignee = project.leadAssignee?.toString() === userId.toString();

    if (!isAdmin && !isLeadAssignee) {
      return NextResponse.json(
        { error: "Only admin or lead assignee can delete sections" },
        { status: 403 }
      );
    }

    // Remove section from project
    await projectsCollection.updateOne(
      { _id: new ObjectId(projectId) },
      {
        $pull: { sections: sectionName },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Section removed successfully",
    });
  } catch (error) {
    console.error("Error removing section:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
