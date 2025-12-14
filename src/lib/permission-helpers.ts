/**
 * Helper functions for checking permissions in API routes
 * 
 * Example usage in an API route:
 * 
 * import { requirePermission } from '@/lib/permission-helpers';
 * import { PERMISSIONS } from '@/models/EmployeePermission';
 * 
 * export async function GET(req: Request) {
 *   const hasAccess = await requirePermission(PERMISSIONS.VIEW_EMPLOYEES);
 *   if (!hasAccess) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
 *   }
 *   // Your code here
 * }
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from './permissions';
import type { Permission } from '@/lib/permission-constants';

/**
 * Check if the current session user has a permission
 * Returns true if user has permission, false otherwise
 */
export async function requirePermission(permission: Permission): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return false;
  }
  return hasPermission(session.user.id, permission);
}

/**
 * Middleware-like function that returns an error response if permission is missing
 * Use this in API routes to check permissions
 */
export async function checkPermissionOrError(permission: Permission): Promise<NextResponse | null> {
  const hasAccess = await requirePermission(permission);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Insufficient permissions', required: permission },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Check if user is admin (admins have all permissions)
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'admin';
}

/**
 * Check if user is admin OR has the required permission
 * This is the main function to use for authorization
 */
export async function isAdminOrHasPermission(permission: Permission): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return false;
  }
  
  // Admins have all permissions
  if (session.user.role === 'admin') {
    return true;
  }
  
  // Check if employee has the permission
  const { hasPermission } = await import('./permissions');
  return hasPermission(session.user.id, permission);
}

/**
 * Middleware-like function that returns an error response if user is not admin and doesn't have permission
 */
export async function requireAdminOrPermission(permission: Permission): Promise<NextResponse | null> {
  const hasAccess = await isAdminOrHasPermission(permission);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Insufficient permissions', required: permission },
      { status: 403 }
    );
  }
  return null;
}

