import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get all pending employees
    const pendingEmployees = await db.collection('users')
      .find({ 
        role: 'employee', 
        isApproved: false 
      })
      .toArray();

    return NextResponse.json({ employees: pendingEmployees });
  } catch (error) {
    console.error('Error fetching pending employees:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
