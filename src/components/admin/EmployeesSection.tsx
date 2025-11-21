"use client";

import {useState, useEffect} from "react";
import {Users, Calendar, CheckCircle, XCircle, Eye, Search, RefreshCw} from "lucide-react";
import {motion} from "framer-motion";
import EmployeeDetailModal from "./EmployeeDetailModal";

interface Employee {
  _id: string;
  fullName: string;
  email: string;
  attendanceCount?: number;
  updatesCount?: number;
}

interface AttendanceRecord {
  _id: string;
  userId: string;
  date: string;
  workDetails: string;
  status?: string;
}

export default function EmployeesSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchAttendanceForAll();
    }
  }, [employees, selectedDate]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/employees");
      const data = await response.json();
      if (response.ok && data.employees) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error("Failed to fetch employees", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceForAll = async () => {
    if (employees.length === 0) return;
    
    try {
      const targetDate = new Date(selectedDate);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const attendancePromises = employees.map(async (emp) => {
        try {
          const response = await fetch(`/api/admin/employee/${emp._id}`);
          const data = await response.json();
          if (response.ok && data.attendanceRecords) {
            const todayAttendance = data.attendanceRecords.filter((record: AttendanceRecord) => {
              const recordDate = new Date(record.date);
              return recordDate >= startOfDay && recordDate <= endOfDay;
            });
            return {employeeId: emp._id, attendance: todayAttendance};
          }
        } catch (error) {
          console.error(`Error fetching attendance for ${emp._id}:`, error);
        }
        return {employeeId: emp._id, attendance: []};
      });

      const results = await Promise.all(attendancePromises);
      const attendanceMap: Record<string, AttendanceRecord[]> = {};
      results.forEach((result) => {
        attendanceMap[result.employeeId] = result.attendance;
      });
      setAttendanceData(attendanceMap);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAttendanceStatus = (employeeId: string) => {
    const attendance = attendanceData[employeeId] || [];
    if (attendance.length > 0) {
      return {present: true, record: attendance[0]};
    }
    return {present: false, record: null};
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 placeholder-gray-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              View Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
            />
          </div>
          <motion.button
            whileHover={{scale: 1.05}}
            whileTap={{scale: 0.95}}
            onClick={fetchEmployees}
            className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg mt-6"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </motion.button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Attendance Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Work Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm ? "No employees found matching your search" : "No employees found"}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee, index) => {
                  const attendance = getAttendanceStatus(employee._id);
                  return (
                    <motion.tr
                      key={employee._id}
                      initial={{opacity: 0, y: 10}}
                      animate={{opacity: 1, y: 0}}
                      transition={{delay: index * 0.05}}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                            {employee.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">
                            {employee.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {employee.email}
                      </td>
                      <td className="px-4 py-3">
                        {attendance.present ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Present</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="text-sm font-medium text-red-700">Absent</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                        {attendance.record?.workDetails ? (
                          <p className="truncate" title={attendance.record.workDetails}>
                            {attendance.record.workDetails}
                          </p>
                        ) : (
                          <span className="text-gray-400">No details</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedEmployeeId(employee._id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Present Today</p>
              <p className="text-2xl font-bold text-green-700">
                {Object.values(attendanceData).filter((records) => records.length > 0).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Absent Today</p>
              <p className="text-2xl font-bold text-red-700">
                {employees.length - Object.values(attendanceData).filter((records) => records.length > 0).length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-blue-700">{employees.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployeeId && (
        <EmployeeDetailModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </div>
  );
}

