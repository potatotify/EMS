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

    // Normalize employeeId to handle both ObjectId and string formats
    const normalizeEmployeeId = (id: any): string => {
      if (!id) return '';
      if (typeof id === 'string') return id;
      if (id instanceof ObjectId) return id.toString();
      return String(id);
    };

    const normalizedEmployeeId = normalizeEmployeeId(employeeId);
    
    // Normalize entries - filter out invalid entries (value must be != 0 and description must exist)
    const normalizeEntries = (entries: any[]): any[] => {
      return entries
        .map(entry => {
          // Parse value more carefully
          let value: number;
          if (typeof entry.value === 'number') {
            value = entry.value;
          } else if (typeof entry.value === 'string') {
            value = parseFloat(entry.value);
          } else {
            value = Number(entry.value);
          }
          
          // Check if value is valid
          if (isNaN(value) || value === null || value === undefined) {
            value = 0;
          }
          
          return {
            type: entry.type || 'points',
            value: value,
            description: String(entry.description || '').trim()
          };
        })
        .filter(entry => {
          // Only keep entries with non-zero value and non-empty description
          const isValidValue = entry.value !== 0 && !isNaN(entry.value) && entry.value !== null && entry.value !== undefined;
          const isValidDescription = entry.description.length > 0;
          return isValidValue && isValidDescription;
        });
    };
    
    const normalizedEntries = normalizeEntries(entries);
    
    console.log(`[Custom Bonus/Fine Update] employeeId=${normalizedEmployeeId}, date=${date}, field=${field}`);
    console.log(`[Custom Bonus/Fine Update] Input entries: ${entries.length}, Valid entries after normalization: ${normalizedEntries.length}`);
    console.log(`[Custom Bonus/Fine Update] Raw entries:`, JSON.stringify(entries.slice(0, 3)));
    console.log(`[Custom Bonus/Fine Update] Normalized entries:`, JSON.stringify(normalizedEntries.slice(0, 3)));
    
    const collection = db.collection("customBonusFine");
    
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

    // Convert date string (YYYY-MM-DD) to Date range for customFineRecords queries
    const dateObj = new Date(date + 'T00:00:00');
    const dateStart = new Date(dateObj);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateObj);
    dateEnd.setHours(23, 59, 59, 999);
    
    if (existingDoc) {
      const fieldName = field === 'customBonus' ? 'customBonusEntries' : 'customFineEntries';
      const previousEntries = existingDoc[fieldName] || [];
      
      console.log(`[Custom Bonus/Fine Update] Existing doc found - previous ${field} entries: ${previousEntries.length}, new entries: ${normalizedEntries.length}`);
      
      // If deleting fine entries, DELETE the corresponding customFineRecords (not just mark them)
      if (field === 'customFine') {
        // Try multiple approaches to find and delete customFineRecords
        // customFineRecords.employeeId can be either userId (ObjectId) or employeeProfile._id
        let totalDeleted = 0;
        
        // Approach 1: Try with employeeProfile._id (normalizedEmployeeId)
        try {
          const deleteResult1 = await db.collection('customFineRecords').deleteMany({
            employeeId: new ObjectId(normalizedEmployeeId),
            date: { $gte: dateStart, $lte: dateEnd }
          });
          totalDeleted += deleteResult1.deletedCount;
          
          const deleteResult2 = await db.collection('customFineRecords').deleteMany({
            employeeId: normalizedEmployeeId,
            date: { $gte: dateStart, $lte: dateEnd }
          });
          totalDeleted += deleteResult2.deletedCount;
        } catch (e) {
          console.error(`[Custom Bonus/Fine Update] Error deleting with employeeId:`, e);
        }
        
        // Approach 2: Get employee profile to find userId and try that too
        try {
          const employeeProfile = await db.collection('employeeProfiles').findOne({
            _id: new ObjectId(normalizedEmployeeId)
          });
          
          if (employeeProfile && employeeProfile.userId) {
            const userId = employeeProfile.userId instanceof ObjectId 
              ? employeeProfile.userId 
              : new ObjectId(employeeProfile.userId);
            
            const deleteResult3 = await db.collection('customFineRecords').deleteMany({
              employeeId: userId,
              date: { $gte: dateStart, $lte: dateEnd }
            });
            totalDeleted += deleteResult3.deletedCount;
            
            const deleteResult4 = await db.collection('customFineRecords').deleteMany({
              employeeId: userId.toString(),
              date: { $gte: dateStart, $lte: dateEnd }
            });
            totalDeleted += deleteResult4.deletedCount;
          }
        } catch (e) {
          console.error(`[Custom Bonus/Fine Update] Error deleting with userId:`, e);
        }
        
        console.log(`[Custom Bonus/Fine Update] Total deleted ${totalDeleted} customFineRecords for employee ${normalizedEmployeeId} on date ${date}`);
      }
      
      // Determine what the document will have after update
      const willHaveBonusEntries = field === 'customBonus' 
        ? normalizedEntries.length > 0 
        : (existingDoc.customBonusEntries?.length > 0 || false);
      const willHaveFineEntries = field === 'customFine' 
        ? normalizedEntries.length > 0 
        : (existingDoc.customFineEntries?.length > 0 || false);
      
      if (!willHaveBonusEntries && !willHaveFineEntries) {
        // Delete the document if both fields will be empty
        const deleteResult = await collection.deleteOne({ 
          _id: existingDoc._id
        });
        console.log(`[Custom Bonus/Fine Update] Deleted document: ${deleteResult.deletedCount > 0}`);
      } else {
        // Update the document - use $set to replace the entire array
        const updateQuery: any = {
          $set: {
            updatedAt: new Date(),
            updatedBy: session.user.id
          }
        };
        
        if (field === 'customBonus') {
          updateQuery.$set.customBonusEntries = normalizedEntries;
        } else {
          updateQuery.$set.customFineEntries = normalizedEntries;
        }
        
        const updateResult = await collection.updateOne(
          { _id: existingDoc._id },
          updateQuery
        );
        
        console.log(`[Custom Bonus/Fine Update] Update result - matched: ${updateResult.matchedCount}, modified: ${updateResult.modifiedCount}`);
        
        if (updateResult.matchedCount === 0) {
          return NextResponse.json(
            { error: "Document not found for update" },
            { status: 404 }
          );
        }
        
        // Verify the update
        const verifyDoc = await collection.findOne({ _id: existingDoc._id });
        if (verifyDoc) {
          const verifyEntries = verifyDoc[fieldName] || [];
          console.log(`[Custom Bonus/Fine Update] Verification - ${fieldName} length: ${verifyEntries.length}, expected: ${normalizedEntries.length}`);
          
          if (verifyEntries.length !== normalizedEntries.length) {
            console.error(`[Custom Bonus/Fine Update] WARNING: Entry count mismatch! Expected ${normalizedEntries.length}, got ${verifyEntries.length}`);
            // Try one more time with explicit replacement
            await collection.updateOne(
              { _id: existingDoc._id },
              { $set: { [fieldName]: normalizedEntries } }
            );
          }
        }
      }
    } else {
      // No existing document - create new one if we have entries
      if (normalizedEntries.length > 0) {
        const newDoc: any = {
          employeeId: normalizedEmployeeId,
          date,
          updatedAt: new Date(),
          updatedBy: session.user.id,
          createdAt: new Date()
        };
        
        if (field === 'customBonus') {
          newDoc.customBonusEntries = normalizedEntries;
          newDoc.customFineEntries = [];
        } else {
          newDoc.customFineEntries = normalizedEntries;
          newDoc.customBonusEntries = [];
        }
        
        await collection.insertOne(newDoc);
        console.log(`[Custom Bonus/Fine Update] Created new document with ${normalizedEntries.length} ${field} entries`);
      } else {
        console.log(`[Custom Bonus/Fine Update] No document exists and no valid entries to add - skipping`);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: "Custom field updated successfully",
      entriesSaved: normalizedEntries.length,
      entriesReceived: entries.length
    });
  } catch (error) {
    console.error("Error updating custom bonus/fine:", error);
    return NextResponse.json(
      { error: "Failed to update custom field", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
