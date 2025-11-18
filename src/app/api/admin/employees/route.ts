import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const employees = await db.collection('employeeProfiles').find({}).toArray();

    const employeesWithStats = await Promise.all(employees.map(async (emp) => {
      const attendanceCount = await db.collection('attendance').countDocuments({ userId: emp.userId });
      const updatesCount = await db.collection('dailyUpdates').countDocuments({ employeeId: emp.userId });
      return {
        ...emp,
        attendanceCount,
        updatesCount,
      };
    }));

    return NextResponse.json({ employees: employeesWithStats });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
