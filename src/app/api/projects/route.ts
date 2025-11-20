import {NextRequest, NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({error: "Unauthorized"}, {status: 403});
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    let projects;

    if (session.user.role === "admin") {
      // Admin sees all projects - limit to 200 for performance
      projects = await db
        .collection("projects")
        .find()
        .sort({createdAt: -1})
        .limit(200)
        .toArray();
    } else if (session.user.role === "client") {
      // Client sees only their projects
      projects = await db
        .collection("projects")
        .find({clientId: new ObjectId(session.user.id)})
        .sort({createdAt: -1})
        .limit(100)
        .toArray();
    } else if (session.user.role === "employee") {
      // Employee sees projects assigned to them
      projects = await db
        .collection("projects")
        .find({
          $or: [
            {leadAssignee: new ObjectId(session.user.id)},
            {updateIncharge: session.user.name}
          ]
        })
        .sort({createdAt: -1})
        .limit(100)
        .toArray();
    }

    return NextResponse.json({projects});
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
