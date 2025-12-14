import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import clientPromise from '@/lib/mongodb';
import EmployeePermission from '@/models/EmployeePermission';
import User from '@/models/User'; // Import User model to register it with Mongoose
import { Permission, PERMISSIONS } from '@/lib/permission-constants';
import { ObjectId } from 'mongodb';
import { hasPermission } from '@/lib/permissions';

// Get all employees with their permissions
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get all employees
    const client = await clientPromise;
    const db = client.db('worknest');
    
    const employees = await db.collection('users')
      .find({ role: 'employee', isApproved: true })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();

    // Get all permissions using native MongoDB driver (to avoid TypeScript issues)
    // Collection name is typically the lowercase, pluralized model name
    const permissions = await db.collection('employeepermissions').find({}).toArray();

    // Manually populate employeeId and grantedBy
    const usersCollection = db.collection('users');
    const populatedPermissions: any[] = await Promise.all(
      permissions.map(async (perm: any) => {
        // Populate employeeId
        let employeeIdData = null;
        if (perm.employeeId) {
          try {
            let empId: ObjectId;
            if (perm.employeeId instanceof ObjectId) {
              empId = perm.employeeId;
            } else if (typeof perm.employeeId === 'string') {
              empId = new ObjectId(perm.employeeId);
            } else {
              empId = new ObjectId(String(perm.employeeId));
            }
            const empUser = await usersCollection.findOne(
              { _id: empId },
              { projection: { name: 1, email: 1 } }
            );
            if (empUser) {
              employeeIdData = {
                _id: empUser._id.toString(),
                name: empUser.name || 'Unknown',
                email: empUser.email || ''
              };
            }
          } catch (e) {
            console.error('Error populating employeeId:', e);
          }
        }

        // Populate grantedBy
        let grantedByData = null;
        if (perm.grantedBy) {
          try {
            let grantedById: ObjectId;
            if (perm.grantedBy instanceof ObjectId) {
              grantedById = perm.grantedBy;
            } else if (typeof perm.grantedBy === 'string') {
              grantedById = new ObjectId(perm.grantedBy);
            } else {
              grantedById = new ObjectId(String(perm.grantedBy));
            }
            const grantedByUser = await usersCollection.findOne(
              { _id: grantedById },
              { projection: { name: 1, email: 1 } }
            );
            if (grantedByUser) {
              grantedByData = {
                _id: grantedByUser._id.toString(),
                name: grantedByUser.name || 'Unknown',
                email: grantedByUser.email || ''
              };
            }
          } catch (e) {
            console.error('Error populating grantedBy:', e);
          }
        }

        return {
          ...perm,
          _id: perm._id ? String(perm._id) : perm._id,
          employeeId: employeeIdData,
          grantedBy: grantedByData
        };
      })
    );

    // Map permissions to employees
    const employeesWithPermissions = employees.map((emp: any) => {
      const empIdStr = emp._id.toString();
      const foundPermission = populatedPermissions.find((p: any) => {
        if (!p.employeeId) return false;
        // Compare employeeId._id (if populated) or the raw employeeId
        const permEmpId = p.employeeId._id || p.employeeId;
        return permEmpId === empIdStr || permEmpId?.toString() === empIdStr;
      });
      
      const empPermission = foundPermission as any;
      
      return {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        permissions: (empPermission && empPermission.permissions) ? empPermission.permissions : [],
        grantedBy: (empPermission && empPermission.grantedBy) ? empPermission.grantedBy : null,
        grantedAt: (empPermission && empPermission.grantedAt) ? empPermission.grantedAt : null,
      };
    });

    return NextResponse.json({ employees: employeesWithPermissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

// Update employee permissions
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin has permission to manage permissions
    const canManage = await hasPermission(session.user.id, PERMISSIONS.MANAGE_PERMISSIONS);
    if (!canManage && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db('worknest');
    const body = await req.json();
    const { employeeId, permissions } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 });
    }

    // Validate permissions
    const validPermissions = Object.values(PERMISSIONS);
    const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p as Permission));
    if (invalidPermissions.length > 0) {
      return NextResponse.json({ 
        error: `Invalid permissions: ${invalidPermissions.join(', ')}` 
      }, { status: 400 });
    }

    // Remove MANAGE_PERMISSIONS if not admin (only admins can grant this)
    const filteredPermissions = permissions.filter((p: Permission) => {
      if (p === PERMISSIONS.MANAGE_PERMISSIONS) {
        // Only allow if the current user is admin
        return session.user.role === 'admin';
      }
      return true;
    });

    // Upsert employee permission using native MongoDB driver
    const employeePermissionsCollection = db.collection('employeepermissions');
    const employeeIdObj = new ObjectId(employeeId);
    const grantedByIdObj = new ObjectId(session.user.id);
    
    const result = await employeePermissionsCollection.findOneAndUpdate(
      { employeeId: employeeIdObj },
      {
        $set: {
          employeeId: employeeIdObj,
          permissions: filteredPermissions,
          grantedBy: grantedByIdObj,
          grantedAt: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result || !result.value) {
      return NextResponse.json({ 
        error: 'Failed to create or update permission' 
      }, { status: 500 });
    }

    const employeePermission = result.value as any;

    // Manually populate if permission was created/updated
    if (employeePermission) {
      const usersCollection = db.collection('users');
      
      // Populate employeeId
      let employeeIdData = null;
      const empIdField = (employeePermission as any).employeeId;
      if (empIdField) {
        try {
          let empId: ObjectId;
          if (empIdField instanceof ObjectId) {
            empId = empIdField;
          } else if (typeof empIdField === 'string') {
            empId = new ObjectId(empIdField);
          } else {
            empId = new ObjectId(String(empIdField));
          }
          const empUser = await usersCollection.findOne(
            { _id: empId },
            { projection: { name: 1, email: 1 } }
          );
          if (empUser) {
            employeeIdData = {
              _id: empUser._id.toString(),
              name: empUser.name || 'Unknown',
              email: empUser.email || ''
            };
          }
        } catch (e) {
          console.error('Error populating employeeId:', e);
        }
      }

      // Populate grantedBy
      let grantedByData = null;
      const grantedByField = (employeePermission as any).grantedBy;
      if (grantedByField) {
        try {
          let grantedById: ObjectId;
          if (grantedByField instanceof ObjectId) {
            grantedById = grantedByField;
          } else if (typeof grantedByField === 'string') {
            grantedById = new ObjectId(grantedByField);
          } else {
            grantedById = new ObjectId(String(grantedByField));
          }
          const grantedByUser = await usersCollection.findOne(
            { _id: grantedById },
            { projection: { name: 1, email: 1 } }
          );
          if (grantedByUser) {
            grantedByData = {
              _id: grantedByUser._id.toString(),
              name: grantedByUser.name || 'Unknown',
              email: grantedByUser.email || ''
            };
          }
        } catch (e) {
          console.error('Error populating grantedBy:', e);
        }
      }

      const populatedPermission = {
        ...employeePermission,
        _id: employeePermission._id.toString(),
        employeeId: employeeIdData,
        grantedBy: grantedByData
      };

      return NextResponse.json({ 
        success: true,
        permission: populatedPermission 
      });
    }

    return NextResponse.json({ 
      success: true,
      permission: employeePermission 
    });
  } catch (error) {
    console.error('Error updating permissions:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

// Delete employee permissions
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    await dbConnect();

    await EmployeePermission.findOneAndDelete({ 
      employeeId: new ObjectId(employeeId) 
    });

    return NextResponse.json({ 
      success: true,
      message: 'Permissions removed successfully' 
    });
  } catch (error) {
    console.error('Error deleting permissions:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

