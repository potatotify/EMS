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

    // Get query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const days = searchParams.get("days");

    // Calculate date range
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate + "T23:59:59.999Z")
      };
    } else if (days) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      daysAgo.setHours(0, 0, 0, 0);
      dateFilter = { $gte: daysAgo };
    } else {
      // Default: 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      tenDaysAgo.setHours(0, 0, 0, 0);
      dateFilter = { $gte: tenDaysAgo };
    }

    // Fetch projects - either specific project or all projects
    let projects;
    if (projectId) {
      const project = await db
        .collection("projects")
        .findOne({ _id: new ObjectId(projectId) });
      projects = project ? [project] : [];
    } else {
      projects = await db
        .collection("projects")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
    }

    // For each project, fetch daily updates within date range
    const projectsWithUpdates = await Promise.all(
      projects.map(async (project) => {
        // Fetch daily updates for this project within date range
        const updates = await db
          .collection("dailyUpdates")
          .find({
            projectId: project._id,
            date: dateFilter,
          })
          .sort({ date: -1 })
          .toArray();

        // Populate employee name for each update
        const populatedUpdates = await Promise.all(
          updates.map(async (update) => {
            let employeeName = "Unknown";
            let employeeId = update.employeeId?.toString();
            let employeeEmail = "";
            
            if (update.employeeName) {
              employeeName = update.employeeName;
            }
            
            if (update.employeeId) {
              try {
                const employee = await db.collection("users").findOne({
                  _id: new ObjectId(update.employeeId),
                });
                if (employee) {
                  employeeName = employee.name || employee.email || "Unknown";
                  employeeEmail = employee.email || "";
                  employeeId = employee._id.toString();
                }
              } catch (err) {
                console.error("Error fetching employee:", err);
              }
            }

            return {
              employeeId,
              employeeName,
              employeeEmail,
              date: update.date || update.createdAt,
              hoursWorked: update.hoursWorked || 0,
              progress: update.progress || 0,
              tasksCompleted: update.tasksCompleted || [],
              notes: update.notes || update.additionalNotes || "",
              challenges: update.challenges || "",
              nextSteps: update.nextSteps || "",
            };
          })
        );

        // Populate lead assignee details (support both single and array)
        let leadAssignees: any[] = [];
        if (project.leadAssignee) {
          try {
            if (Array.isArray(project.leadAssignee)) {
              leadAssignees = await Promise.all(
                project.leadAssignee.map(async (leadId: any) => {
                  const id = leadId instanceof ObjectId ? leadId : new ObjectId(leadId);
                  const lead = await db.collection("users").findOne({ _id: id });
                  return lead ? {
                    _id: lead._id.toString(),
                    name: lead.name || lead.email,
                    email: lead.email,
                  } : null;
                })
              );
              leadAssignees = leadAssignees.filter(Boolean);
            } else {
              const leadId =
                project.leadAssignee instanceof ObjectId
                  ? project.leadAssignee
                  : new ObjectId(project.leadAssignee);
              const lead = await db.collection("users").findOne({ _id: leadId });
              if (lead) {
                leadAssignees = [{
                  _id: lead._id.toString(),
                  name: lead.name || lead.email,
                  email: lead.email,
                }];
              }
            }
          } catch (err) {
            console.error("Error fetching lead assignee:", err);
          }
        }

        // Populate all assignees
        let assignees: any[] = [];
        if (project.assignees && Array.isArray(project.assignees)) {
          try {
            assignees = await Promise.all(
              project.assignees.map(async (assigneeId: any) => {
                const id = assigneeId instanceof ObjectId ? assigneeId : new ObjectId(assigneeId);
                const employee = await db.collection("users").findOne({ _id: id });
                return employee ? {
                  _id: employee._id.toString(),
                  name: employee.name || employee.email,
                  email: employee.email,
                } : null;
              })
            );
            assignees = assignees.filter(Boolean);
          } catch (err) {
            console.error("Error fetching assignees:", err);
          }
        }

        return {
          _id: project._id.toString(),
          projectName: project.projectName,
          clientName: project.clientName,
          status: project.status || "pending_assignment",
          leadAssignees,
          assignees,
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
