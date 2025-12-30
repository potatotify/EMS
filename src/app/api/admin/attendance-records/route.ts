import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Fetch all attendance records
    const attendanceRecords = await db
      .collection("attendance")
      .find({})
      .sort({ date: -1 })
      .toArray();

    // Transform the data to match the expected format
    const formattedRecords = attendanceRecords.map((record) => ({
      _id: record._id.toString(),
      userId: record.userId.toString(),
      date: record.date.toISOString(),
      workDetails: record.workDetails || "",
      dailyUpdate: record.dailyUpdate || "",
      link: record.link || "",
      createdAt: record.createdAt ? record.createdAt.toISOString() : record.date.toISOString(),
    }));

    return NextResponse.json({ attendanceRecords: formattedRecords });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
