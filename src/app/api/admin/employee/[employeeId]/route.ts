import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { dbConnect } from "@/lib/mongodb";
import { DailyUpdate, User } from "@/models";
import { ObjectId } from "mongodb";
import { isAdminOrHasPermission } from "@/lib/permission-helpers";
import { PERMISSIONS } from "@/lib/permission-constants";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ employeeId: string }> }
) {
  try {
    const params = await context.params;
    const { employeeId } = params;

    console.log("Received employeeId:", employeeId);

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if admin or has VIEW_EMPLOYEES or MANAGE_EMPLOYEES permission
    const hasAccess = await isAdminOrHasPermission(PERMISSIONS.VIEW_EMPLOYEES) || 
                      await isAdminOrHasPermission(PERMISSIONS.MANAGE_EMPLOYEES);
    if (!hasAccess) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Connect to DB first
    await dbConnect();
    const client = await clientPromise;
    const db = client.db("worknest");

    // Validate ObjectId format
    if (!ObjectId.isValid(employeeId)) {
      console.error("Invalid ObjectId format:", employeeId);
      return NextResponse.json(
        { error: "Invalid employee ID format" },
        { status: 400 }
      );
    }

    // Find employee profile by _id
    let profile = await db.collection("employeeProfiles").findOne({
      _id: new ObjectId(employeeId)
    });

    console.log("Found profile:", profile ? "Yes" : "No");

    if (!profile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // The userId from employeeProfile is the actual user ID in our system
    const dailyUpdates = await DailyUpdate.find({ employeeId: profile.userId })
      .sort({ date: -1 })
      .limit(30);

    // Fetch attendance records
    const attendanceRecords = await db
      .collection("attendance")
      .find({ userId: profile.userId })
      .sort({ date: -1 })
      .limit(30)
      .toArray();

    // Fetch user to get email using native MongoDB driver
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(profile.userId) });
    const userEmail = user?.email || profile.email || "";

    console.log("Found daily updates:", dailyUpdates.length);
    console.log("Found attendance records:", attendanceRecords.length);
    console.log("User email:", userEmail);

    // Return profile and daily updates
    return NextResponse.json({
      profile: {
        _id: profile._id,
        fullName: profile.fullName || "Employee",
        email: userEmail,
        designation: profile.designation || "Employee",
        department: profile.department || "Engineering",
        phone: profile.phone || "",
        joiningDate: profile.createdAt || profile.joiningDate || ""
      },
      attendanceRecords: attendanceRecords.map((record: any) => ({
        _id: record._id,
        userId: record.userId,
        date: record.date,
        workDetails: record.workDetails || "",
        status: record.status || "present",
        createdAt: record.createdAt || record.date,
        hoursWorked: record.hoursWorked || 0
      })),
      dailyUpdates: dailyUpdates.map((update: any) => ({
        _id: update._id,
        date: update.date,
        tasksCompleted: update.tasksForTheDay ? [update.tasksForTheDay] : [],
        adminApproved: update.adminApproved,
        status: update.status,
        hoursWorked: update.hoursWorked || 0
      }))
    });
  } catch (error) {
    console.error("Error in employee detail API:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
