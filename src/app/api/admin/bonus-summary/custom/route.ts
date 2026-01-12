import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

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
    
    // Normalize employeeId to handle both ObjectId and string formats
    const normalizeEmployeeId = (id: any): string => {
      if (!id) return '';
      if (typeof id === 'string') return id;
      if (id instanceof ObjectId) return id.toString();
      return String(id);
    };

    const normalizedEmployeeId = normalizeEmployeeId(employeeId);
    
    console.log(`[Custom Bonus/Fine Update] employeeId=${normalizedEmployeeId}, date=${date}, field=${field}, entries.length=${entries.length}`);
    
    // Try to find existing document with multiple query formats
    let existingDoc = await collection.findOne({ 
      employeeId: normalizedEmployeeId, 
      date 
    });
    
    // If not found, try with ObjectId format
    if (!existingDoc) {
      try {
        existingDoc = await collection.findOne({ 
          employeeId: new ObjectId(normalizedEmployeeId), 
          date 
        });
      } catch (e) {
        // If ObjectId conversion fails, continue with string
      }
    }

    console.log(`[Custom Bonus/Fine Update] Existing doc found: ${!!existingDoc}`);
    if (existingDoc) {
      console.log(`[Custom Bonus/Fine Update] Existing doc - bonus entries: ${existingDoc.customBonusEntries?.length || 0}, fine entries: ${existingDoc.customFineEntries?.length || 0}`);
    }
    
    if (existingDoc) {
      // Determine what the document will have after update
      const willHaveBonusEntries = field === 'customBonus' 
        ? entries.length > 0 
        : (existingDoc.customBonusEntries?.length > 0 || false);
      const willHaveFineEntries = field === 'customFine' 
        ? entries.length > 0 
        : (existingDoc.customFineEntries?.length > 0 || false);
      
      console.log(`[Custom Bonus/Fine Update] After update - will have bonus: ${willHaveBonusEntries}, fine: ${willHaveFineEntries}`);
      
      if (!willHaveBonusEntries && !willHaveFineEntries) {
        // Delete the document if both fields will be empty
        const deleteResult = await collection.deleteOne({ 
          $or: [
            { employeeId: normalizedEmployeeId, date },
            { employeeId: new ObjectId(normalizedEmployeeId), date }
          ]
        });
        console.log(`[Custom Bonus/Fine Update] Deleted document: ${deleteResult.deletedCount > 0}`);
      } else {
        // Update the document - explicitly set the field to the new entries array (even if empty)
        const updateQuery: any = {
          $set: {
            updatedAt: new Date(),
            updatedBy: session.user.id
          }
        };
        
        if (field === 'customBonus') {
          updateQuery.$set.customBonusEntries = entries; // Set to empty array if entries.length === 0
        } else {
          updateQuery.$set.customFineEntries = entries; // Set to empty array if entries.length === 0
        }
        
        const updateResult = await collection.updateOne(
          { 
            $or: [
              { employeeId: normalizedEmployeeId, date },
              { employeeId: new ObjectId(normalizedEmployeeId), date }
            ]
          },
          updateQuery
        );
        console.log(`[Custom Bonus/Fine Update] Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
        
        // Verify the update by reading the document back
        const verifyDoc = await collection.findOne({ 
          employeeId: normalizedEmployeeId, 
          date 
        });
        if (verifyDoc) {
          const fieldName = field === 'customBonus' ? 'customBonusEntries' : 'customFineEntries';
          console.log(`[Custom Bonus/Fine Update] Verification - ${fieldName} length: ${verifyDoc[fieldName]?.length || 0}`);
        } else {
          console.log(`[Custom Bonus/Fine Update] Verification - document not found after update`);
        }
      }
    } else if (entries.length > 0) {
      // Only create new document if there are entries to add
      const newDoc: any = {
        employeeId: normalizedEmployeeId,
        date,
        updatedAt: new Date(),
        updatedBy: session.user.id,
        createdAt: new Date()
      };
      
      if (field === 'customBonus') {
        newDoc.customBonusEntries = entries;
        newDoc.customFineEntries = [];
      } else {
        newDoc.customFineEntries = entries;
        newDoc.customBonusEntries = [];
      }
      
      await collection.insertOne(newDoc);
      console.log(`[Custom Bonus/Fine Update] Created new document`);
    } else {
      // No document exists and no entries to add - nothing to do
      console.log(`[Custom Bonus/Fine Update] No document exists and no entries to add - skipping`);
    }

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
