import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/employee/messages - fetch conversation between employee and admins
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const userId = new ObjectId(session.user.id);

    const messages = await db
      .collection('userMessages')
      .find({
        $or: [
          { receiverId: userId },
          { senderId: userId },
        ],
      })
      .sort({ createdAt: 1 })
      .toArray();

    // Mark all messages from admin to this employee as read
    await db.collection('userMessages').updateMany(
      {
        receiverId: userId,
        receiverRole: 'employee',
        readByReceiver: false,
      },
      { $set: { readByReceiver: true } }
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching employee messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/employee/messages - employee replies to admin
// Body: { message: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { message } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Find any admin user to receive this message
    const adminUser = await db.collection('users').findOne({ role: 'admin' });
    if (!adminUser) {
      return NextResponse.json({ error: 'No admin user found' }, { status: 500 });
    }

    const doc = {
      senderId: new ObjectId(session.user.id),
      receiverId: adminUser._id,
      senderRole: 'employee',
      receiverRole: 'admin',
      message: message.trim(),
      createdAt: new Date(),
      readByReceiver: false,
    };

    await db.collection('userMessages').insertOne(doc);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending employee message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
