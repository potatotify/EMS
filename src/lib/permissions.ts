import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import EmployeePermission from '@/models/EmployeePermission';
import { Permission, PERMISSIONS } from '@/lib/permission-constants';
import { dbConnect } from '@/lib/mongodb';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  try {
    await dbConnect();
    
    // Check if user is admin (admins have all permissions)
    const client = await clientPromise;
    const db = client.db('worknest');
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user?.role === 'admin') {
      return true; // Admins have all permissions
    }
    
    // Check employee permissions
    const employeePermission = await EmployeePermission.findOne({ 
      employeeId: new ObjectId(userId) 
    });
    
    if (!employeePermission) {
      return false;
    }
    
    return employeePermission.permissions.includes(permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if current session user has a specific permission
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return false;
    }
    
    return hasPermission(session.user.id, permission);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    await dbConnect();
    
    // Check if user is admin
    const client = await clientPromise;
    const db = client.db('worknest');
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (user?.role === 'admin') {
      // Admins have all permissions
      return Object.values(PERMISSIONS) as Permission[];
    }
    
    // Get employee permissions
    const employeePermission = await EmployeePermission.findOne({ 
      employeeId: new ObjectId(userId) 
    });
    
    return employeePermission?.permissions || [];
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(userId, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(userId, permission))) {
      return false;
    }
  }
  return true;
}

// Permission descriptions and categories moved to permission-constants.ts for client-side use

