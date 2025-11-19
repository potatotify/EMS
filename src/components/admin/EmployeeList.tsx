'use client';

import { useState, useEffect } from 'react';
import { Users, Loader } from 'lucide-react';

interface Employee {
  _id: string;
  fullName: string;
  email: string;
  attendanceCount: number;
  updatesCount: number;
}

interface EmployeeListProps {
  onSelectEmployee: (employeeId: string) => void;
}

export default function EmployeeList({ onSelectEmployee }: EmployeeListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/employees');
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error('Failed to fetch employees', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="h-8 w-8 text-emerald-600 mx-auto animate-spin" />
          <p className="mt-2 text-sm text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-emerald-200 rounded-2xl">
        <Users className="h-12 w-12 text-gray-400 mx-auto" />
        <p className="mt-2 text-sm font-medium text-gray-900">No employees found</p>
        <p className="text-xs text-gray-500 mt-1">Start by adding employees to your team</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-emerald-900 mb-6">All Employees</h2>
      <div className="space-y-3">
        {employees.map((emp) => (
          <div
            key={emp._id}
            onClick={() => onSelectEmployee(emp._id)}
            className="group cursor-pointer relative rounded-xl overflow-hidden border border-emerald-100/50 bg-white/80 backdrop-blur-md p-4 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-emerald-200"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(20, 184, 166, 0.05))' }} />
            
            <div className="relative flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                    {emp.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{emp.fullName}</p>
                    <p className="text-sm text-gray-500 truncate">{emp.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6 ml-4">
                
                <div className="text-right">
                  <p className="text-sm font-semibold text-teal-600">{emp.updatesCount}</p>
                  <p className="text-xs text-gray-500">Updates</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
