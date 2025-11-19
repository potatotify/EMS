import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }  // params is a Promise here
) {
  const params = await context.params;  // await params to get projectId
  const { projectId } = params;

  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const updates = await db.collection('dailyUpdates')
      .find({
        projectId: new ObjectId(projectId),
        employeeId: new ObjectId(session.user.id)
      })
      .sort({ date: -1 })
      .toArray();

    return NextResponse.json({ updates });
  } catch (error) {
    console.error('Error fetching updates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
