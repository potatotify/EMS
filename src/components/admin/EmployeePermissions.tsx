"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Loader2, Shield, Check, X, Users } from "lucide-react";
import { PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSION_CATEGORIES, Permission } from "@/lib/permission-constants";

interface Employee {
  _id: string;
  name: string;
  email: string;
  permissions: Permission[];
  grantedBy?: { name: string; email: string } | null;
  grantedAt?: string | null;
}

export default function EmployeePermissions() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [employeePermissions, setEmployeePermissions] = useState<Record<string, Permission[]>>({});

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/permissions");
      const data = await response.json();
      if (response.ok && data.employees) {
        setEmployees(data.employees);
        // Initialize permissions state
        const permissionsMap: Record<string, Permission[]> = {};
        data.employees.forEach((emp: Employee) => {
          permissionsMap[emp._id] = emp.permissions || [];
        });
        setEmployeePermissions(permissionsMap);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (employeeId: string, permission: Permission) => {
    setEmployeePermissions(prev => {
      const current = prev[employeeId] || [];
      const hasPermission = current.includes(permission);
      
      return {
        ...prev,
        [employeeId]: hasPermission
          ? current.filter(p => p !== permission)
          : [...current, permission]
      };
    });
  };

  const handleSavePermissions = async (employeeId: string) => {
    setSaving(employeeId);
    try {
      const permissions = employeePermissions[employeeId] || [];
      const response = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          permissions
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert("Permissions updated successfully!");
        fetchEmployees();
        setSelectedEmployee(null);
      } else {
        alert(`Failed to update: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      alert("Failed to save permissions");
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveAllPermissions = async (employeeId: string) => {
    if (!confirm("Are you sure you want to remove all permissions for this employee?")) {
      return;
    }

    setSaving(employeeId);
    try {
      const response = await fetch(`/api/admin/permissions?employeeId=${employeeId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        alert("Permissions removed successfully!");
        fetchEmployees();
        setSelectedEmployee(null);
      } else {
        const data = await response.json();
        alert(`Failed to remove: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error removing permissions:", error);
      alert("Failed to remove permissions");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Employee Permissions</h2>
          <p className="text-neutral-600">Grant admin powers to employees</p>
        </div>
      </div>

      <div className="grid gap-4">
        {employees.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
            <p>No employees found</p>
          </div>
        ) : (
          employees.map((employee) => {
            const isSelected = selectedEmployee === employee._id;
            const permissions = employeePermissions[employee._id] || [];
            const hasChanges = JSON.stringify(permissions) !== JSON.stringify(employee.permissions);

            return (
              <motion.div
                key={employee._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-emerald-600" />
                      <div>
                        <h3 className="font-semibold text-neutral-900">{employee.name}</h3>
                        <p className="text-sm text-neutral-500">{employee.email}</p>
                      </div>
                    </div>
                    {employee.grantedBy && (
                      <p className="text-xs text-neutral-400 mt-2">
                        Permissions granted by {employee.grantedBy.name} on{" "}
                        {employee.grantedAt ? new Date(employee.grantedAt).toLocaleDateString() : "N/A"}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedEmployee(isSelected ? null : employee._id)}
                      className="px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      {isSelected ? "Hide" : "Manage"}
                    </button>
                    {permissions.length > 0 && (
                      <button
                        onClick={() => handleRemoveAllPermissions(employee._id)}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Remove All
                      </button>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 space-y-6 border-t border-neutral-200 pt-4">
                    {Object.entries(PERMISSION_CATEGORIES).map(([category, categoryPermissions]) => (
                      <div key={category}>
                        <h4 className="font-medium text-neutral-700 mb-3">{category}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {categoryPermissions.map((permission) => {
                            const isChecked = permissions.includes(permission);
                            const isDisabled = permission === PERMISSIONS.MANAGE_PERMISSIONS; // Only admins can grant this

                            return (
                              <label
                                key={permission}
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  isChecked
                                    ? "border-emerald-500 bg-emerald-50"
                                    : "border-neutral-200 hover:border-neutral-300"
                                } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => !isDisabled && handleTogglePermission(employee._id, permission)}
                                  disabled={isDisabled}
                                  className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-neutral-300 rounded"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-neutral-900">
                                    {permission.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                  </div>
                                  <div className="text-xs text-neutral-500 mt-1">
                                    {PERMISSION_DESCRIPTIONS[permission]}
                                  </div>
                                </div>
                                {isChecked && (
                                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200">
                      <button
                        onClick={() => {
                          setEmployeePermissions(prev => ({
                            ...prev,
                            [employee._id]: employee.permissions || []
                          }));
                          setSelectedEmployee(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSavePermissions(employee._id)}
                        disabled={!hasChanges || saving === employee._id}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {saving === employee._id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Permissions
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {!isSelected && permissions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <div className="flex flex-wrap gap-2">
                      {permissions.map((permission) => (
                        <span
                          key={permission}
                          className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium"
                        >
                          {permission.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

