import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { isAdminOrHasPermission } from "@/lib/permission-helpers";
import { PERMISSIONS } from "@/lib/permission-constants";

export async function GET() {
  try {
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

    const client = await clientPromise;
    const db = client.db("worknest");

    // Fetch employees from employeeProfiles and join with users collection
    const profiles = await db
      .collection("employeeProfiles")
      .find({})
      .toArray();

    // Get user IDs to fetch user details
    const userIds = profiles
      .map((p: any) => p.userId)
      .filter((id: any) => id);

    // Fetch user details (name, email) from users collection
    const users = await db
      .collection("users")
      .find({ _id: { $in: userIds } })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();

    // Create a map of userId to user details
    const userMap = new Map(
      users.map((u: any) => [u._id.toString(), { name: u.name, email: u.email }])
    );

    // Combine profile and user data
    const employees = profiles.map((profile: any) => {
      const userId = profile.userId ? profile.userId.toString() : null;
      const user = userId ? userMap.get(userId) : null;
      
      return {
        _id: profile._id,
        userId: userId || profile._id.toString(),
        fullName: profile.fullName || user?.name || "Unknown Employee",
        name: profile.fullName || user?.name || "Unknown Employee",
        email: user?.email || profile.email || "",
        designation: profile.designation || "",
        department: profile.department || "",
      };
    });

    // Return just the basic employee data - stats can be fetched on-demand
    return NextResponse.json({ employees });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
