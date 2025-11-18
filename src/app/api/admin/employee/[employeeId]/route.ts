// src/app/api/admin/employee/[employeeId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ employeeId: string }> }
) {
  try {
    const params = await context.params;
    const { employeeId } = params;
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // First try to find by _id, then by userId
    let profile = await db.collection('employeeProfiles').findOne({ 
      $or: [
        { _id: new ObjectId(employeeId) },
        { userId: new ObjectId(employeeId) }
      ]
    });

    if (!profile) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get attendance records - search by both userId and employeeId
    const attendanceRecords = await db.collection('attendance')
      .find({ 
        $or: [
          { userId: new ObjectId(employeeId) },
          { employeeId: new ObjectId(employeeId) }
        ]
      })
      .sort({ date: -1 })
      .limit(30)
      .toArray();

    // Get daily updates - search by both userId and employeeId
    const dailyUpdates = await db.collection('dailyUpdates')
      .find({ 
        $or: [
          { employeeId: new ObjectId(employeeId) },
          { userId: new ObjectId(employeeId) }
        ]
      })
      .sort({ date: -1 })
      .limit(30)
      .toArray();

    return NextResponse.json({ 
      profile,
      attendanceRecords,
      dailyUpdates 
    });

  } catch (error) {
    console.error('Error in employee detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}