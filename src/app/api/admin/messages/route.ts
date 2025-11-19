import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// POST /api/admin/messages
// Body: { employeeIds: string[], message: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { employeeIds, message } = await request.json();

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'No employees selected' }, { status: 400 });
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const docs = employeeIds.map((id: string) => ({
      senderId: new ObjectId(session.user.id),
      receiverId: new ObjectId(id),
      senderRole: 'admin',
      receiverRole: 'employee',
      message: message.trim(),
      createdAt: new Date(),
      readByReceiver: false,
    }));

    await db.collection('userMessages').insertMany(docs);

    return NextResponse.json({ success: true, count: docs.length });
  } catch (error) {
    console.error('Error sending admin messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
