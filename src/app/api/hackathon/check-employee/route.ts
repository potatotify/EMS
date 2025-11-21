import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if user is an employee
    const employeeProfile = await db.collection('employeeProfiles').findOne({
      userId: new ObjectId(session.user.id)
    });

    const isEmployee = !!employeeProfile;

    // Check if user has hackathon profile
    const hackathonProfile = await db.collection('hackathonprofiles').findOne({
      userId: new ObjectId(session.user.id)
    });

    const hasProfile = !!hackathonProfile;

    return NextResponse.json({
      isEmployee,
      hasProfile,
      employeeId: employeeProfile?.employeeId || null
    });
  } catch (error) {
    console.error('Error checking employee status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

