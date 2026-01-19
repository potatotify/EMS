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
    let hasAccess = false;
    try {
      const hasViewAccess = await isAdminOrHasPermission(PERMISSIONS.VIEW_EMPLOYEES);
      const hasManageAccess = await isAdminOrHasPermission(PERMISSIONS.MANAGE_EMPLOYEES);
      hasAccess = hasViewAccess || hasManageAccess;
    } catch (permError: any) {
      console.error("[Employees API] Error checking permissions:", permError);
      // If permission check fails, allow admin access as fallback
      hasAccess = session.user.role === 'admin';
    }
    
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

    // Get user IDs to fetch user details - convert to ObjectId and filter out invalid ones
    const userIds = profiles
      .map((p: any) => {
        if (!p.userId) return null;
        try {
          return p.userId instanceof ObjectId ? p.userId : new ObjectId(p.userId);
        } catch (e) {
          console.warn(`Invalid userId in profile ${p._id}:`, p.userId);
          return null;
        }
      })
      .filter((id: any) => id !== null);

    // Fetch user details (name, email) from users collection
    const users = userIds.length > 0 
      ? await db
          .collection("users")
          .find({ _id: { $in: userIds } })
          .project({ _id: 1, name: 1, email: 1 })
          .toArray()
      : [];

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
  } catch (error: any) {
    console.error("[Employees API] Error fetching employees:", error);
    console.error("[Employees API] Error stack:", error?.stack);
    return NextResponse.json({ 
      error: "Internal server error",
      message: error?.message || "Unknown error"
    }, { status: 500 });
  }
}
