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
      // Employee sees projects assigned to them (as lead, VA incharge, or update incharge)
      const user = await db.collection("users").findOne({
        _id: new ObjectId(session.user.id)
      });
      const userName = user?.name || "";
      
      projects = await db
        .collection("projects")
        .find({
          $or: [
            {leadAssignee: new ObjectId(session.user.id)},
            {vaIncharge: new ObjectId(session.user.id)},
            {updateIncharge: new ObjectId(session.user.id)},
            // Legacy support: also check by name (for old data)
            {updateIncharge: userName}
          ]
        })
        .sort({createdAt: -1})
        .limit(100)
        .toArray();
    }

    // Helper function to populate employee details
    const populateEmployee = async (employeeId: any) => {
      if (!employeeId) return null;
      try {
        const employee = await db.collection("users").findOne({
          _id: new ObjectId(employeeId)
        });
        if (employee) {
          return {
            _id: employee._id.toString(),
            name: employee.name,
            email: employee.email
          };
        }
      } catch (error) {
        // If not a valid ObjectId, might be a string (legacy data)
        if (typeof employeeId === 'string') {
          return { _id: employeeId, name: employeeId, email: "" };
        }
      }
      return null;
    };

    // Populate employee details for all projects
    const populatedProjects = await Promise.all(
      (projects || []).map(async (project) => {
        // Populate lead assignee
        if (project.leadAssignee) {
          project.leadAssignee = await populateEmployee(project.leadAssignee) || project.leadAssignee;
        }
        // Populate VA Incharge
        if (project.vaIncharge) {
          project.vaIncharge = await populateEmployee(project.vaIncharge) || project.vaIncharge;
        }
        // Populate Update Incharge
        if (project.updateIncharge) {
          project.updateIncharge = await populateEmployee(project.updateIncharge) || project.updateIncharge;
        }
        return project;
      })
    );

    return NextResponse.json({projects: populatedProjects});
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
