import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { employeeId, date, field, entries } = await request.json();

    if (!employeeId || !date || !field || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("worknest");

    // Update or insert custom bonus/fine entry with multiple entries
    const collection = db.collection("customBonusFine");
    
    await collection.updateOne(
      { employeeId, date },
      {
        $set: {
          employeeId,
          date,
          ...(field === 'customBonus' ? {
            customBonusEntries: entries
          } : {
            customFineEntries: entries
          }),
          updatedAt: new Date(),
          updatedBy: session.user.id
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true,
      message: "Custom field updated successfully"
    });
  } catch (error) {
    console.error("Error updating custom bonus/fine:", error);
    return NextResponse.json(
      { error: "Failed to update custom field" },
      { status: 500 }
    );
  }
}
