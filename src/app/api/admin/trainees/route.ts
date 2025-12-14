import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db('worknest');

    // Get all employees
    const employees = await db.collection('employeeProfiles').find({}).toArray();
    const users = await db.collection('users').find({ role: 'employee', isApproved: true }).toArray();
    
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    const now = new Date();
    const trainees = await Promise.all(employees.map(async (emp: any) => {
      const user = userMap.get(emp.userId?.toString() || '');
      if (!user) return null;

      const joiningDate = emp.createdAt || emp.joiningDate || new Date();
      const monthsWorked = Math.floor((now.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
      const isInTraining = monthsWorked < 3;

      if (!isInTraining) return null;

      // Get daily updates count
      const dailyUpdates = await db.collection('dailyUpdates').countDocuments({
        employeeId: emp.userId
      });

      // Get attendance hours
      const attendanceRecords = await db.collection('attendance').find({
        userId: emp.userId
      }).toArray();
      const attendanceHours = attendanceRecords.reduce((sum: number, record: any) => {
        return sum + (record.hoursWorked || 8);
      }, 0);

      // Get completed projects
      const projects = await db.collection('projects').find({
        $or: [
          { 'leadAssignee': new ObjectId(emp.userId) },
          { 'teamMembers': new ObjectId(emp.userId) }
        ],
        status: 'completed'
      }).toArray();
      const completedProjects = projects.length;

      // Get last update date
      const lastUpdate = await db.collection('dailyUpdates').findOne(
        { employeeId: emp.userId },
        { sort: { date: -1 } }
      );

      // Calculate training progress (based on months worked, updates, and projects)
      const trainingProgress = Math.min(100, Math.round(
        (monthsWorked / 3) * 40 + 
        (Math.min(dailyUpdates, 90) / 90) * 30 + 
        (Math.min(completedProjects, 5) / 5) * 30
      ));

      return {
        _id: emp._id.toString(),
        fullName: emp.fullName || user.name || 'Unknown',
        email: user.email || '',
        employeeId: emp.employeeId || 'N/A',
        designation: emp.designation || 'Employee',
        department: emp.department || 'Engineering',
        joiningDate: joiningDate,
        skills: emp.skills || [],
        monthsWorked,
        dailyUpdatesCount: dailyUpdates,
        attendanceHours,
        completedProjects,
        lastUpdateDate: lastUpdate?.date || null,
        trainingProgress
      };
    }));

    const validTrainees = trainees.filter(t => t !== null);

    return NextResponse.json({ trainees: validTrainees });
  } catch (error) {
    console.error('Error fetching trainees:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



