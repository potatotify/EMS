import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ traineeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { traineeId } = params;

    if (!ObjectId.isValid(traineeId)) {
      return NextResponse.json({ error: 'Invalid trainee ID' }, { status: 400 });
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db('worknest');

    const employee = await db.collection('employeeProfiles').findOne({
      _id: new ObjectId(traineeId)
    });

    if (!employee) {
      return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
    }

    const user = await db.collection('users').findOne({
      _id: new ObjectId(employee.userId)
    });

    // Get recent updates
    const recentUpdates = await db.collection('dailyUpdates')
      .find({ employeeId: employee.userId })
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    const joiningDate = employee.createdAt || employee.joiningDate || new Date();
    const now = new Date();
    const monthsWorked = Math.floor((now.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    const dailyUpdates = await db.collection('dailyUpdates').countDocuments({
      employeeId: employee.userId
    });

    const projects = await db.collection('projects').find({
      $or: [
        { 'leadAssignee': new ObjectId(employee.userId) },
        { 'teamMembers': new ObjectId(employee.userId) }
      ],
      status: 'completed'
    }).toArray();

    const trainingProgress = Math.min(100, Math.round(
      (monthsWorked / 3) * 40 + 
      (Math.min(dailyUpdates, 90) / 90) * 30 + 
      (Math.min(projects.length, 5) / 5) * 30
    ));

    return NextResponse.json({
      fullName: employee.fullName || user?.name || 'Unknown',
      email: user?.email || '',
      skills: employee.skills || [],
      trainingProgress,
      recentUpdates: recentUpdates.map((update: any) => ({
        date: update.date,
        workDetails: update.workDetails || update.tasksForTheDay || 'No details'
      }))
    });
  } catch (error) {
    console.error('Error fetching trainee details:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



