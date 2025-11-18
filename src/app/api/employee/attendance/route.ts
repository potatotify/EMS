import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const { workDetails } = await request.json();
    if (!workDetails || workDetails.trim() === '') {
      return NextResponse.json({ error: 'Work details required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await db.collection('attendance').findOne({
      userId: new ObjectId(session.user.id),
      date: { $gte: today },
    });

    if (existingAttendance) {
      return NextResponse.json({ error: 'Attendance already marked for today' }, { status: 400 });
    }

    await db.collection('attendance').insertOne({
      userId: new ObjectId(session.user.id),
      date: new Date(),
      workDetails,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Attendance marked' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
