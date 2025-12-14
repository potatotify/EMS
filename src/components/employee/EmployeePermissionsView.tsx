"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Check, Loader2, User, Calendar } from "lucide-react";
import { PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSION_CATEGORIES, Permission } from "@/lib/permission-constants";

interface PermissionData {
  permissions: Permission[];
  isAdmin: boolean;
  grantedBy: { name: string; email: string } | null;
  grantedAt: string | null;
}

export default function EmployeePermissionsView() {
  const [permissionData, setPermissionData] = useState<PermissionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/employee/permissions");
      const data = await response.json();
      if (response.ok) {
        setPermissionData(data);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!permissionData) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <Shield className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
        <p>Unable to load permissions</p>
      </div>
    );
  }

  const { permissions, isAdmin, grantedBy, grantedAt } = permissionData;

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Admin Access</h2>
              <p className="text-emerald-100">You have full administrative access to all features</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
          <p className="text-neutral-600">As an admin, you have access to all permissions and features in the system.</p>
        </div>
      </div>
    );
  }

  if (permissions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-neutral-400" />
            <h2 className="text-xl font-bold text-neutral-900">My Permissions</h2>
          </div>
          <div className="text-center py-12">
            <Shield className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
            <p className="text-lg font-medium text-neutral-700 mb-2">No Special Permissions</p>
            <p className="text-neutral-500">
              You currently don't have any special permissions assigned. Contact your administrator if you need additional access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">My Permissions</h2>
            <p className="text-emerald-100">Special access granted by administrator</p>
          </div>
        </div>
        {grantedBy && (
          <div className="mt-4 pt-4 border-t border-emerald-400/30 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="text-emerald-100">Granted by: <span className="font-semibold text-white">{grantedBy.name}</span></span>
            </div>
            {grantedAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-emerald-100">
                  On: <span className="font-semibold text-white">{new Date(grantedAt).toLocaleDateString()}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permissions by Category */}
      <div className="space-y-6">
        {Object.entries(PERMISSION_CATEGORIES).map(([category, categoryPermissions]) => {
          const employeeHasPermissions = categoryPermissions.filter(p => permissions.includes(p));
          
          if (employeeHasPermissions.length === 0) {
            return null;
          }

          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200"
            >
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {employeeHasPermissions.map((permission) => (
                  <div
                    key={permission}
                    className="flex items-start gap-3 p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50"
                  >
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-neutral-900 mb-1">
                        {permission.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {PERMISSION_DESCRIPTIONS[permission]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> These permissions grant you access to specific admin features. 
          If you need additional permissions, please contact your administrator.
        </p>
      </div>
    </div>
  );
}

