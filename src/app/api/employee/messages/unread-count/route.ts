import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/employee/messages/unread-count
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const userId = new ObjectId(session.user.id);

    const count = await db.collection('userMessages').countDocuments({
      receiverId: userId,
      receiverRole: 'employee',
      readByReceiver: false,
    });

    return NextResponse.json({ unread: count });
  } catch (error) {
    console.error('Error fetching unread message count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
