import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isAdminOrHasPermission } from '@/lib/permission-helpers';
import { PERMISSIONS } from '@/lib/permission-constants';

// GET /api/admin/messages - fetch all messages (sent and received by admin)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin or has MANAGE_MESSAGES permission
    const hasAccess = await isAdminOrHasPermission(PERMISSIONS.MANAGE_MESSAGES);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');
    const userId = new ObjectId(session.user.id);

    // Fetch all messages where admin is sender or receiver
    const messages = await db
      .collection('userMessages')
      .find({
        $or: [
          { senderId: userId, senderRole: 'admin' },
          { receiverId: userId, receiverRole: 'admin' },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Populate sender and receiver information
    const usersCollection = db.collection('users');
    const profilesCollection = db.collection('employeeProfiles');

    const populatedMessages = await Promise.all(
      messages.map(async (msg: any) => {
        // Get sender info
        let sender = null;
        if (msg.senderId) {
          try {
            // Handle different types: ObjectId, string, or FlattenMaps<ObjectId>
            let senderId: ObjectId;
            if (msg.senderId instanceof ObjectId) {
              senderId = msg.senderId;
            } else if (typeof msg.senderId === 'string') {
              senderId = new ObjectId(msg.senderId);
            } else {
              senderId = new ObjectId(String(msg.senderId));
            }
            const senderUser = await usersCollection.findOne({ _id: senderId });
            if (senderUser) {
              let senderName = senderUser.name || 'Unknown';
              if (senderUser.role === 'employee') {
                const senderProfile = await profilesCollection.findOne({ userId: senderId });
                senderName = senderProfile?.fullName || senderUser.name || 'Unknown';
              }
              sender = {
                _id: senderUser._id.toString(),
                name: senderName,
                email: senderUser.email || '',
                role: senderUser.role || 'employee'
              };
            }
          } catch (e) {
            console.error('Error populating sender:', e);
          }
        }

        // Get receiver info
        let receiver = null;
        if (msg.receiverId) {
          try {
            // Handle different types: ObjectId, string, or FlattenMaps<ObjectId>
            let receiverId: ObjectId;
            if (msg.receiverId instanceof ObjectId) {
              receiverId = msg.receiverId;
            } else if (typeof msg.receiverId === 'string') {
              receiverId = new ObjectId(msg.receiverId);
            } else {
              receiverId = new ObjectId(String(msg.receiverId));
            }
            const receiverUser = await usersCollection.findOne({ _id: receiverId });
            if (receiverUser) {
              let receiverName = receiverUser.name || 'Unknown';
              if (receiverUser.role === 'employee') {
                const receiverProfile = await profilesCollection.findOne({ userId: receiverId });
                receiverName = receiverProfile?.fullName || receiverUser.name || 'Unknown';
              }
              receiver = {
                _id: receiverUser._id.toString(),
                name: receiverName,
                email: receiverUser.email || '',
                role: receiverUser.role || 'employee'
              };
            }
          } catch (e) {
            console.error('Error populating receiver:', e);
          }
        }

        return {
          _id: msg._id.toString(),
          senderId: msg.senderId?.toString(),
          receiverId: msg.receiverId?.toString(),
          senderRole: msg.senderRole,
          receiverRole: msg.receiverRole,
          message: msg.message,
          createdAt: msg.createdAt,
          readByReceiver: msg.readByReceiver,
          sender,
          receiver,
          isSent: msg.senderId?.toString() === userId.toString(),
        };
      })
    );

    // Mark messages from employees to admin as read
    await db.collection('userMessages').updateMany(
      {
        receiverId: userId,
        receiverRole: 'admin',
        readByReceiver: false,
      },
      { $set: { readByReceiver: true } }
    );

    return NextResponse.json({ messages: populatedMessages });
  } catch (error) {
    console.error('Error fetching admin messages:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/admin/messages
// Body: { employeeIds: string[], message: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin or has MANAGE_MESSAGES permission
    const hasAccess = await isAdminOrHasPermission(PERMISSIONS.MANAGE_MESSAGES);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
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
