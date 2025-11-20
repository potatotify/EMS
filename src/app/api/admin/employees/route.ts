import {NextResponse} from "next/server";
import {getServerSession} from "next-auth";
import {authOptions} from "../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({error: "Unauthorized"}, {status: 403});
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Fetch employees without stats for better performance
    const employees = await db
      .collection("employeeProfiles")
      .find({})
      .toArray();

    // Return just the basic employee data - stats can be fetched on-demand
    return NextResponse.json({employees});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
