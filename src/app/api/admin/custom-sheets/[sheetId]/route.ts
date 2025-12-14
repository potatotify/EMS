import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import clientPromise from '@/lib/mongodb';
import CustomSheet from '@/models/CustomSheet';
import { ObjectId } from 'mongodb';

// Get a specific custom sheet
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sheetId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { sheetId } = params;

    if (!ObjectId.isValid(sheetId)) {
      return NextResponse.json({ error: 'Invalid sheet ID' }, { status: 400 });
    }

    await dbConnect();
    const sheet = await CustomSheet.findById(sheetId).lean();

    if (!sheet) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    }

    // Manually populate createdBy
    let createdBy = null;
    if (sheet.createdBy) {
      const client = await clientPromise;
      const db = client.db('worknest');
      const usersCollection = db.collection('users');
      try {
        // Handle different types: ObjectId, string, or FlattenMaps<ObjectId>
        let createdById: ObjectId;
        if (sheet.createdBy instanceof ObjectId) {
          createdById = sheet.createdBy;
        } else if (typeof sheet.createdBy === 'string') {
          createdById = new ObjectId(sheet.createdBy);
        } else {
          // Handle FlattenMaps<ObjectId> or other types - convert to string first
          createdById = new ObjectId(String(sheet.createdBy));
        }
        
        const user = await usersCollection.findOne(
          { _id: createdById },
          { projection: { name: 1, email: 1 } }
        );
        if (user) {
          createdBy = {
            _id: user._id.toString(),
            name: user.name || 'Unknown',
            email: user.email || ''
          };
        }
      } catch (e) {
        console.error('Error populating createdBy:', e);
      }
    }

    // Fetch data based on dataSource
    let data = [];
    if (sheet.dataSource && sheet.dataSource.type === 'static') {
      data = sheet.dataSource.data || [];
    } else if (sheet.dataSource && sheet.dataSource.type === 'api' && sheet.dataSource.endpoint) {
      // In a real implementation, you'd fetch from the endpoint
      // For now, return empty array
      data = [];
    }

    // Convert _id to string
    const sheetResponse = {
      ...sheet,
      _id: sheet._id.toString(),
      createdBy: createdBy || { name: 'Unknown', email: '' },
      data
    };

    return NextResponse.json({ 
      sheet: sheetResponse
    });
  } catch (error) {
    console.error('Error fetching custom sheet:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Update a custom sheet
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ sheetId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = await context.params;
    const { sheetId } = params;

    if (!ObjectId.isValid(sheetId)) {
      return NextResponse.json({ error: 'Invalid sheet ID' }, { status: 400 });
    }

    await dbConnect();
    const body = await request.json();
    const { name, description, columns, dataSource } = body;

    const sheet = await CustomSheet.findByIdAndUpdate(
      sheetId,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(columns && { columns }),
        ...(dataSource && { dataSource }),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!sheet) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      sheet 
    });
  } catch (error) {
    console.error('Error updating custom sheet:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Delete a custom sheet
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sheetId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = await context.params;
    const { sheetId } = params;

    if (!ObjectId.isValid(sheetId)) {
      return NextResponse.json({ error: 'Invalid sheet ID' }, { status: 400 });
    }

    await dbConnect();
    const sheet = await CustomSheet.findByIdAndDelete(sheetId);

    if (!sheet) {
      return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Sheet deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting custom sheet:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

