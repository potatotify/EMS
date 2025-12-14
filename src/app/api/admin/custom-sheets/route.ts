import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import CustomSheet from '@/models/CustomSheet';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Get all custom sheets
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Fetch sheets without populate first to avoid errors
    let sheets = await CustomSheet.find({})
      .sort({ createdAt: -1 })
      .lean();
    
    // Manually populate createdBy if it exists
    const client = await clientPromise;
    const db = client.db('worknest');
    const usersCollection = db.collection('users');
    
    const populatedSheets = await Promise.all(
      sheets.map(async (sheet: any) => {
        // Convert _id to string
        if (sheet._id) {
          sheet._id = sheet._id.toString();
        }
        
        if (sheet.createdBy) {
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
              sheet.createdBy = {
                _id: user._id.toString(),
                name: user.name || 'Unknown',
                email: user.email || ''
              };
            } else {
              sheet.createdBy = {
                name: 'Unknown',
                email: ''
              };
            }
          } catch (e) {
            console.error('Error populating createdBy for sheet:', sheet._id, e);
            sheet.createdBy = {
              name: 'Unknown',
              email: ''
            };
          }
        }
        return sheet;
      })
    );

    return NextResponse.json({ sheets: populatedSheets });
  } catch (error) {
    console.error('Error fetching custom sheets:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Create a new custom sheet
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();
    const body = await req.json();
    const { name, description, columns, dataSource } = body;

    if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: 'Name and columns are required' }, { status: 400 });
    }

    if (!dataSource || !dataSource.type) {
      return NextResponse.json({ error: 'Data source is required' }, { status: 400 });
    }

    const customSheet = await CustomSheet.create({
      name,
      description,
      columns,
      dataSource,
      createdBy: new ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      sheet: customSheet 
    });
  } catch (error) {
    console.error('Error creating custom sheet:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



