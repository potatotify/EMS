import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isAdminOrHasPermission } from '@/lib/permission-helpers';
import { PERMISSIONS } from '@/lib/permission-constants';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin or has APPROVE_EMPLOYEES permission
    const hasAccess = await isAdminOrHasPermission(PERMISSIONS.APPROVE_EMPLOYEES);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { userId, approve } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          isApproved: approve,
          approvedAt: approve ? new Date() : null,
          approvedBy: approve ? session.user.id : null,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: approve ? 'Employee approved successfully' : 'Employee approval revoked' 
    });
  } catch (error) {
    console.error('Error approving employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
