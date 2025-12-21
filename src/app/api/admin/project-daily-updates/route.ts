import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Calculate date 10 days ago
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);

    // Fetch all projects
    const projects = await db
      .collection("projects")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // For each project, fetch daily updates from the last 10 days
    const projectsWithUpdates = await Promise.all(
      projects.map(async (project) => {
        // Fetch daily updates for this project from the last 10 days
        const updates = await db
          .collection("dailyUpdates")
          .find({
            projectId: project._id,
            date: { $gte: tenDaysAgo },
          })
          .sort({ date: -1 })
          .limit(10)
          .toArray();

        // Populate employee name for each update
        const populatedUpdates = await Promise.all(
          updates.map(async (update) => {
            let employeeName = "Unknown";
            
            if (update.employeeName) {
              employeeName = update.employeeName;
            } else if (update.employeeId) {
              try {
                const employee = await db.collection("users").findOne({
                  _id: new ObjectId(update.employeeId),
                });
                if (employee) {
                  employeeName = employee.name || employee.email || "Unknown";
                }
              } catch (err) {
                console.error("Error fetching employee:", err);
              }
            }

            return {
              date: update.date || update.createdAt,
              hoursWorked: update.hoursWorked || 0,
              tasksCompleted: update.tasksCompleted || [],
              notes: update.notes || update.additionalNotes || "",
              challenges: update.challenges || "",
              nextSteps: update.nextSteps || "",
              employeeName,
            };
          })
        );

        // Populate lead assignee details
        let leadAssignee = null;
        if (project.leadAssignee) {
          try {
            const leadId =
              project.leadAssignee instanceof ObjectId
                ? project.leadAssignee
                : new ObjectId(project.leadAssignee);
            const lead = await db.collection("users").findOne({ _id: leadId });
            if (lead) {
              leadAssignee = {
                name: lead.name || lead.email,
                email: lead.email,
              };
            }
          } catch (err) {
            console.error("Error fetching lead assignee:", err);
          }
        }

        return {
          _id: project._id.toString(),
          projectName: project.projectName,
          clientName: project.clientName,
          status: project.status || "pending_assignment",
          leadAssignee,
          updates: populatedUpdates,
        };
      })
    );

    // Filter out projects with no updates (optional - you can remove this if you want to show all projects)
    // const projectsWithActualUpdates = projectsWithUpdates.filter(
    //   (p) => p.updates.length > 0
    // );

    return NextResponse.json({
      projects: projectsWithUpdates,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching project daily updates:", error);
    return NextResponse.json(
      { error: "Failed to fetch project daily updates" },
      { status: 500 }
    );
  }
}
