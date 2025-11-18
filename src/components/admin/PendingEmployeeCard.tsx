'use client';

import { CheckCircle, XCircle } from 'lucide-react';

interface PendingEmployee {
  _id: string;
  name: string;
  email: string;
  image?: string; // URL or base64 string
  createdAt?: string;
}

interface PendingEmployeeCardProps {
  employee: PendingEmployee;
  onApprove: (userId: string, approve: boolean) => void;
  isLoading: boolean;
}

export default function PendingEmployeeCard({ employee, onApprove, isLoading }: PendingEmployeeCardProps) {
  return (
    <div className="group relative rounded-xl overflow-hidden border border-emerald-100/50 bg-white/80 backdrop-blur-md p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-emerald-200">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(20, 184, 166, 0.05))' }} />
      
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {employee.image ? (
            <img
              src={employee.image}
              alt={employee.name + ' profile'}
              className="h-12 w-12 rounded-lg border-2 border-emerald-200 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
              {employee.name?.charAt(0) || 'E'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900">{employee.name}</h3>
            <p className="text-sm text-gray-600 truncate">{employee.email}</p>
            {employee.createdAt && (
              <p className="text-xs text-gray-500 mt-1">
                Signed up: {new Date(employee.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => onApprove(employee._id, true)}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Approve</span>
          </button>
          <button
            onClick={() => onApprove(employee._id, false)}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-lg font-medium shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
          >
            <XCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Reject</span>
          </button>
        </div>
      </div>
    </div>
  );
}
