import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import EmployeePermission from '@/models/EmployeePermission';
import User from '@/models/User';
import { getUserPermissions } from '@/lib/permissions';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Get current employee's permissions
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get user to check if admin
    const client = await clientPromise;
    const db = client.db('worknest');
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(session.user.id) 
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If admin, return all permissions
    if (user.role === 'admin') {
      const { PERMISSIONS } = await import('@/lib/permission-constants');
      return NextResponse.json({ 
        permissions: Object.values(PERMISSIONS),
        isAdmin: true,
        grantedBy: null,
        grantedAt: null
      });
    }

    // Get employee permissions
    const permissions = await getUserPermissions(session.user.id);
    
    // Get employee permission using native MongoDB driver to avoid TypeScript issues
    const employeePermissionDoc = await db.collection('employeepermissions').findOne({ 
      employeeId: new ObjectId(session.user.id) 
    });

    let grantedByData = null;
    if (employeePermissionDoc && employeePermissionDoc.grantedBy) {
      try {
        let grantedById: ObjectId;
        if (employeePermissionDoc.grantedBy instanceof ObjectId) {
          grantedById = employeePermissionDoc.grantedBy;
        } else if (typeof employeePermissionDoc.grantedBy === 'string') {
          grantedById = new ObjectId(employeePermissionDoc.grantedBy);
        } else {
          grantedById = new ObjectId(String(employeePermissionDoc.grantedBy));
        }
        const grantedByUser = await db.collection('users').findOne(
          { _id: grantedById },
          { projection: { name: 1, email: 1 } }
        ) as any;
        if (grantedByUser) {
          const userId = grantedByUser._id instanceof ObjectId 
            ? grantedByUser._id.toString() 
            : String(grantedByUser._id);
          grantedByData = {
            _id: userId,
            name: grantedByUser.name || 'Unknown',
            email: grantedByUser.email || ''
          };
        }
      } catch (e) {
        console.error('Error populating grantedBy:', e);
      }
    }

    return NextResponse.json({ 
      permissions,
      isAdmin: false,
      grantedBy: grantedByData,
      grantedAt: employeePermissionDoc?.grantedAt || null
    });
  } catch (error) {
    console.error('Error fetching employee permissions:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

