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

    const data = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Create daily update
    const update = {
      projectId: new ObjectId(data.projectId),
      employeeId: new ObjectId(session.user.id),
      employeeName: session.user.name,
      date: new Date(),
      progress: data.progress, // percentage 0-100
      hoursWorked: data.hoursWorked,
      tasksCompleted: data.tasksCompleted || [],
      challenges: data.challenges || '',
      nextSteps: data.nextSteps || '',
      notes: data.notes || '',
      createdAt: new Date(),
    };

    await db.collection('dailyUpdates').insertOne(update);

    // Update project's last update timestamp
    await db.collection('projects').updateOne(
      { _id: new ObjectId(data.projectId) },
      {
        $set: {
          lastUpdateAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Update submitted successfully' 
    });
  } catch (error) {
    console.error('Error submitting update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
