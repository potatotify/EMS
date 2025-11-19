import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get all approved employees from users collection
    const employees = await db.collection('users')
      .find({ 
        role: 'employee',
        isApproved: true 
      })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();

    // Fetch corresponding employeeProfiles to get skills
    const userIds = employees.map((emp) => emp._id);

    const profiles = await db.collection('employeeProfiles')
      .find({ userId: { $in: userIds } })
      .project({ userId: 1, skills: 1 })
      .toArray();

    const profileMap = new Map<string, any>(
      profiles.map((p: any) => [p.userId.toString(), p])
    );

    const employeesWithSkills = employees.map((emp: any) => {
      const profile = profileMap.get(emp._id.toString());
      return {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        skills: profile?.skills || [],
      };
    });

    return NextResponse.json({ employees: employeesWithSkills });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
