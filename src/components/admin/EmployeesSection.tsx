"use client";

import {useState, useEffect} from "react";
import {Users, Calendar, CheckCircle, XCircle, Eye, Search, RefreshCw, Clock} from "lucide-react";
import {motion} from "framer-motion";
import EmployeeDetailModal from "./EmployeeDetailModal";

interface Employee {
  _id: string;
  userId: string;
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
  const [monthlyAttendanceData, setMonthlyAttendanceData] = useState<Record<string, number>>({});
  const [customDurationData, setCustomDurationData] = useState<Record<string, number>>({});
  const [hoursWorkedData, setHoursWorkedData] = useState<Record<string, number>>({});
  const [hoursWorkedTodayData, setHoursWorkedTodayData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchAttendanceForAll();
      fetchMonthlyAttendance();
      fetchHoursWorked();
      fetchHoursWorkedToday();
    }
  }, [employees, selectedDate]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchCustomDurationAttendance();
      fetchHoursWorked();
    }
  }, [employees, customStartDate, customEndDate]);

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

  const fetchMonthlyAttendance = async () => {
    if (employees.length === 0) return;
    
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const attendancePromises = employees.map(async (emp) => {
        try {
          const response = await fetch(`/api/admin/employee/${emp._id}`);
          const data = await response.json();
          if (response.ok && data.attendanceRecords) {
            const monthlyCount = data.attendanceRecords.filter((record: AttendanceRecord) => {
              const recordDate = new Date(record.date);
              return recordDate >= startOfMonth && recordDate <= endOfMonth;
            }).length;
            return {employeeId: emp._id, count: monthlyCount};
          }
        } catch (error) {
          console.error(`Error fetching monthly attendance for ${emp._id}:`, error);
        }
        return {employeeId: emp._id, count: 0};
      });

      const results = await Promise.all(attendancePromises);
      const monthlyCountMap: Record<string, number> = {};
      results.forEach((result) => {
        monthlyCountMap[result.employeeId] = result.count;
      });
      setMonthlyAttendanceData(monthlyCountMap);
    } catch (error) {
      console.error("Error fetching monthly attendance:", error);
    }
  };

  const fetchHoursWorked = async () => {
    if (employees.length === 0) return;
    
    try {
      // Use custom duration dates if available, otherwise use current month
      const startDate = customStartDate 
        ? new Date(customStartDate)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = customEndDate
        ? new Date(customEndDate)
        : new Date();
      endDate.setHours(23, 59, 59, 999);

      console.log('[EmployeesSection] Fetching hours worked for date range:', startDate.toISOString(), 'to', endDate.toISOString());

      const hoursPromises = employees.map(async (emp) => {
        try {
          let totalHours = 0;
          
          // First, try to get hours from completed tasks (primary source)
          try {
            const startDateStr = customStartDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
            const endDateStr = customEndDate || new Date().toISOString().split("T")[0];
            const taskHoursResponse = await fetch(
              `/api/admin/employee/${emp._id}/task-hours?startDate=${startDateStr}&endDate=${endDateStr}`
            );
            if (taskHoursResponse.ok) {
              const taskHoursData = await taskHoursResponse.json();
              totalHours = taskHoursData.totalHours || 0;
            }
          } catch (error) {
            console.error(`Error fetching task hours for ${emp._id}:`, error);
          }
          
          // Also check daily updates and attendance records (fallback/additional sources)
          const response = await fetch(`/api/admin/employee/${emp._id}`);
          const data = await response.json();
          if (response.ok) {
            // Add hours from daily updates
            if (data.dailyUpdates && data.dailyUpdates.length > 0) {
              const updatesInRange = data.dailyUpdates.filter((update: any) => {
                const updateDate = new Date(update.date);
                return updateDate >= startDate && updateDate <= endDate;
              });
              const dailyUpdateHours = updatesInRange.reduce((sum: number, update: any) => {
                return sum + (Number(update.hoursWorked) || 0);
              }, 0);
              totalHours += dailyUpdateHours;
            }
            
            // Add hours from attendance records
            if (data.attendanceRecords && data.attendanceRecords.length > 0) {
              const attendanceInRange = data.attendanceRecords.filter((record: any) => {
                const recordDate = new Date(record.date);
                return recordDate >= startDate && recordDate <= endDate;
              });
              const attendanceHours = attendanceInRange.reduce((sum: number, record: any) => {
                return sum + (Number(record.hoursWorked) || 0);
              }, 0);
              totalHours += attendanceHours;
            }
          }
          
          return {userId: emp.userId, hours: totalHours};
        } catch (error) {
          console.error(`Error fetching hours worked for ${emp._id}:`, error);
        }
        return {userId: emp.userId, hours: 0};
      });

      const results = await Promise.all(hoursPromises);
      const hoursMap: Record<string, number> = {};
      results.forEach((result) => {
        hoursMap[result.userId] = result.hours;
      });
      console.log('[EmployeesSection] Hours worked data:', hoursMap);
      setHoursWorkedData(hoursMap);
    } catch (error) {
      console.error("Error fetching hours worked:", error);
    }
  };

  const fetchHoursWorkedToday = async () => {
    if (employees.length === 0) return;
    
    try {
      const targetDate = new Date(selectedDate);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const hoursPromises = employees.map(async (emp) => {
        try {
          let hours = 0;
          
          // First, try to get hours from completed tasks (primary source)
          try {
            const taskHoursResponse = await fetch(
              `/api/admin/employee/${emp._id}/task-hours?startDate=${selectedDate}&endDate=${selectedDate}`
            );
            if (taskHoursResponse.ok) {
              const taskHoursData = await taskHoursResponse.json();
              hours = taskHoursData.totalHours || 0;
            }
          } catch (error) {
            console.error(`Error fetching task hours for ${emp._id}:`, error);
          }
          
          // Also check daily updates and attendance records (fallback/additional sources)
          const response = await fetch(`/api/admin/employee/${emp._id}`);
          const data = await response.json();
          if (response.ok) {
            // Add hours from daily updates
            if (data.dailyUpdates && data.dailyUpdates.length > 0) {
              const todayUpdate = data.dailyUpdates.find((update: any) => {
                const updateDate = new Date(update.date);
                return updateDate >= startOfDay && updateDate <= endOfDay;
              });
              if (todayUpdate && todayUpdate.hoursWorked) {
                hours += Number(todayUpdate.hoursWorked) || 0;
              }
            }
            
            // Add hours from attendance records
            if (data.attendanceRecords && data.attendanceRecords.length > 0) {
              const todayAttendance = data.attendanceRecords.find((record: any) => {
                const recordDate = new Date(record.date);
                return recordDate >= startOfDay && recordDate <= endOfDay;
              });
              if (todayAttendance && todayAttendance.hoursWorked) {
                hours += Number(todayAttendance.hoursWorked) || 0;
              }
            }
          }
          
          return {employeeId: emp._id, hours: hours};
        } catch (error) {
          console.error(`Error fetching today's hours for ${emp._id}:`, error);
        }
        return {employeeId: emp._id, hours: 0};
      });

      const results = await Promise.all(hoursPromises);
      const hoursMap: Record<string, number> = {};
      results.forEach((result) => {
        hoursMap[result.employeeId] = result.hours;
      });
      setHoursWorkedTodayData(hoursMap);
    } catch (error) {
      console.error("Error fetching today's hours worked:", error);
    }
  };

  const fetchCustomDurationAttendance = async () => {
    if (employees.length === 0 || !customStartDate || !customEndDate) return;
    
    try {
      const startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);

      const attendancePromises = employees.map(async (emp) => {
        try {
          const response = await fetch(`/api/admin/employee/${emp._id}`);
          const data = await response.json();
          if (response.ok && data.attendanceRecords) {
            const customCount = data.attendanceRecords.filter((record: AttendanceRecord) => {
              const recordDate = new Date(record.date);
              return recordDate >= startDate && recordDate <= endDate;
            }).length;
            return {employeeId: emp._id, count: customCount};
          }
        } catch (error) {
          console.error(`Error fetching custom duration attendance for ${emp._id}:`, error);
        }
        return {employeeId: emp._id, count: 0};
      });

      const results = await Promise.all(attendancePromises);
      const customCountMap: Record<string, number> = {};
      results.forEach((result) => {
        customCountMap[result.employeeId] = result.count;
      });
      setCustomDurationData(customCountMap);
    } catch (error) {
      console.error("Error fetching custom duration attendance:", error);
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

  // Table Row Skeleton
  const EmployeeRowSkeleton = () => (
    <tr className="hover:bg-gray-50 transition-colors animate-pulse">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-neutral-200 rounded-lg"></div>
          <div className="h-4 bg-neutral-200 rounded w-32"></div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-neutral-200 rounded w-16"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-neutral-200 rounded w-16"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-neutral-200 rounded w-20"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-neutral-200 rounded w-20"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-6 bg-neutral-200 rounded w-24"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-8 bg-neutral-200 rounded w-20"></div>
      </td>
    </tr>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Filters Skeleton */}
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full sm:max-w-md">
              <div className="h-10 bg-neutral-200 rounded-xl"></div>
            </div>
            <div className="h-10 bg-neutral-200 rounded-xl w-32"></div>
          </div>
          <div className="bg-neutral-100 rounded-xl p-4">
            <div className="h-4 bg-neutral-200 rounded w-32 mb-3"></div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-10 bg-neutral-200 rounded w-40"></div>
              <div className="h-10 bg-neutral-200 rounded w-40"></div>
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-linear-to-r from-emerald-600 to-teal-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    This Month's Attendance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Custom Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Hours Worked (Custom Duration)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Hours Worked Today
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Attendance Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <EmployeeRowSkeleton />
                <EmployeeRowSkeleton />
                <EmployeeRowSkeleton />
                <EmployeeRowSkeleton />
                <EmployeeRowSkeleton />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4">
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
            <motion.button
              whileHover={{scale: 1.05}}
              whileTap={{scale: 0.95}}
              onClick={fetchEmployees}
              className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </motion.button>
          </div>
        </div>

        {/* Custom Duration Filter */}
        <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-gray-900">Custom Duration:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                />
              </div>
              <div className="bg-white px-3 py-2 rounded-lg border border-blue-300 mt-5">
                <span className="text-xs text-gray-600">Duration: </span>
                <span className="text-sm font-semibold text-blue-900">
                  {Math.ceil((new Date(customEndDate).getTime() - new Date(customStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-linear-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  This Month's Attendance
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Custom Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Hours Worked (Custom Duration)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Hours Worked Today
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Attendance Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
                          <div className="h-10 w-10 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                            {employee.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">
                            {employee.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-semibold text-gray-900">
                            {monthlyAttendanceData[employee._id] || 0} days
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900">
                            {customDurationData[employee._id] || 0} days
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-semibold text-blue-900" title={`Hours worked from ${customStartDate} to ${customEndDate}: ${hoursWorkedData[employee.userId] || 0}`}>
                            {(hoursWorkedData[employee.userId] || 0).toFixed(1)}h
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-700" title={`Hours worked on ${selectedDate}: ${hoursWorkedTodayData[employee._id] || 0}`}>
                            {(hoursWorkedTodayData[employee._id] || 0).toFixed(1)}h
                          </span>
                        </div>
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

