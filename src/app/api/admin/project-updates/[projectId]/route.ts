import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const params = await context.params;
    const { projectId } = params;

    const session = await getServerSession(authOptions);
    
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'client')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get all daily updates for this project
    const updates = await db.collection('dailyUpdates')
      .find({ projectId: new ObjectId(projectId) })
      .sort({ date: -1 })
      .toArray();

    // Populate employee information
    const populatedUpdates = await Promise.all(
      updates.map(async (update) => {
        if (update.employeeId) {
          const employee = await db.collection('users').findOne({
            _id: new ObjectId(update.employeeId)
          });
          if (employee) {
            update.employeeId = {
              _id: employee._id.toString(),
              name: employee.name,
              email: employee.email
            };
          }
        }
        return update;
      })
    );

    return NextResponse.json({ updates: populatedUpdates });
  } catch (error) {
    console.error('Error fetching project updates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
