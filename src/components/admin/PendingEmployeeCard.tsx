"use client";

import {CheckCircle, XCircle} from "lucide-react";
import {motion} from "framer-motion";

interface PendingEmployee {
  _id: string;
  name: string;
  email: string;
  image?: string;
  createdAt?: string;
}

interface PendingEmployeeCardProps {
  employee: PendingEmployee;
  onApprove: (userId: string, approve: boolean) => void;
  isLoading: boolean;
}

export default function PendingEmployeeCard({
  employee,
  onApprove,
  isLoading
}: PendingEmployeeCardProps) {
  return (
    <motion.div
      whileHover={{scale: 1.01, y: -2}}
      className="group relative rounded-2xl overflow-hidden border border-white/60 glass-effect p-5 shadow-md hover:shadow-xl transition-all duration-300"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-linear-to-r from-emerald-50/50 to-teal-50/50" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {employee.image ? (
            <motion.img
              whileHover={{scale: 1.1}}
              src={employee.image}
              alt={employee.name + " profile"}
              className="h-14 w-14 rounded-xl border-2 border-white shadow-md object-cover ring-2 ring-emerald-100"
              loading="lazy"
            />
          ) : (
            <motion.div
              whileHover={{rotate: 5, scale: 1.1}}
              className="h-14 w-14 rounded-xl gradient-emerald flex items-center justify-center text-white font-bold text-lg shadow-md"
            >
              {employee.name?.charAt(0) || "E"}
            </motion.div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-lg">
              {employee.name}
            </h3>
            <p className="text-sm text-slate-600 truncate font-medium">
              {employee.email}
            </p>
            {employee.createdAt && (
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Signed up: {new Date(employee.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <motion.button
            whileHover={{scale: 1.05}}
            whileTap={{scale: 0.95}}
            onClick={() => onApprove(employee._id, true)}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 gradient-emerald hover:opacity-90 text-white rounded-xl font-semibold shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Approve</span>
          </motion.button>
          <motion.button
            whileHover={{scale: 1.05}}
            whileTap={{scale: 0.95}}
            onClick={() => onApprove(employee._id, false)}
            disabled={isLoading}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-linear-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-xl font-semibold shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Reject</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
