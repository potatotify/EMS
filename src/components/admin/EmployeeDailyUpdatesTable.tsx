"use client";

import { useState, useEffect } from "react";
import { Calendar, Search, Filter, X, FileText, User, ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Employee {
  _id: string;
  userId: string;
  fullName: string;
  email: string;
}

interface DailyUpdate {
  _id: string;
  userId: string;
  date: string;
  workDetails: string;
  dailyUpdate?: string;
  link?: string;
  createdAt: string;
}

export default function EmployeeDailyUpdatesTable() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailyUpdates, setDailyUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Get default week: today going back 6 days (7 days total)
  const getWeekDates = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    
    return { weekAgo, today };
  };
  
  const { weekAgo, today } = getWeekDates();
  
  const [startDate, setStartDate] = useState<string>(
    weekAgo.toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    today.toISOString().split("T")[0]
  );
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showEmployeeFilter, setShowEmployeeFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchDailyUpdates();
    }
  }, [employees, startDate, endDate]);

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

  const fetchDailyUpdates = async () => {
    try {
      const response = await fetch("/api/admin/attendance-records");
      const data = await response.json();
      if (response.ok && data.attendanceRecords) {
        setDailyUpdates(data.attendanceRecords);
      }
    } catch (error) {
      console.error("Failed to fetch attendance records", error);
    }
  };

  const toggleRowExpansion = (employeeId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedRows(newExpanded);
  };

  // Filter employees based on search and selection
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSelection = selectedEmployeeId === "all" || emp._id === selectedEmployeeId;
    return matchesSearch && matchesSelection;
  });

  // Get dates in range
  const getDatesInRange = () => {
    const dates: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates.reverse(); // Newest first (left) to oldest (right)
  };

  const dates = getDatesInRange();

  // Get daily update for specific employee and date
  const getDailyUpdate = (employeeUserId: string, date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return dailyUpdates.find((update) => {
      const updateDate = new Date(update.date).toISOString().split("T")[0];
      return update.userId === employeeUserId && updateDate === dateStr;
    });
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading employee daily updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Filters - Compact Button */}
      <div className="relative">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-md"
        >
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Filter Dropdown */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-12 left-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[300px] overflow-hidden"
            >
              {/* By Employee Filter */}
              <div className="border-b border-gray-200">
                <button
                  onClick={() => setShowEmployeeFilter(!showEmployeeFilter)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-gray-900">By Employee</span>
                  </div>
                  {showEmployeeFilter ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                
                <AnimatePresence>
                  {showEmployeeFilter && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                          />
                        </div>
                        <select
                          value={selectedEmployeeId}
                          onChange={(e) => setSelectedEmployeeId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        >
                          <option value="all">All Employees</option>
                          {employees.map((emp) => (
                            <option key={emp._id} value={emp._id}>
                              {emp.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Custom Duration Filter */}
              <div>
                <button
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-gray-900">Custom Duration</span>
                  </div>
                  {showDateFilter ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                
                <AnimatePresence>
                  {showDateFilter && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                          />
                        </div>
                        <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                          <span className="text-xs text-gray-600">Duration: </span>
                          <span className="text-sm font-semibold text-emerald-900">
                            {dates.length} days
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-linear-to-r from-emerald-600 to-teal-600 text-white sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider border-r border-emerald-700 sticky left-0 bg-emerald-600 z-20 min-w-[200px]">
                  Employee
                </th>
                {dates.map((date, index) => (
                  <th
                    key={index}
                    className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider border-r border-emerald-700 min-w-[200px]"
                  >
                    <div>{formatDate(date)}</div>
                    <div className="text-[10px] font-normal opacity-80">
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={dates.length + 1} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm || selectedEmployeeId !== "all"
                      ? "No employees found matching your filters"
                      : "No employees found"}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => {
                  const isExpanded = expandedRows.has(employee._id);
                  return (
                    <tr key={employee._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 border-r border-gray-200 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                            {employee.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {employee.fullName}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {employee.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      {dates.map((date, index) => {
                        const update = getDailyUpdate(employee.userId, date);
                        return (
                          <td
                            key={index}
                            className="px-3 py-3 border-r border-gray-200 align-top"
                          >
                            {update ? (
                              <div className="space-y-2">
                                {/* Daily Update Content */}
                                {update.dailyUpdate && (
                                  <div className="bg-blue-50 rounded p-2 border border-blue-200">
                                    <div className="flex items-center gap-1 mb-1">
                                      <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                                      <span className="text-xs font-semibold text-blue-700">Update:</span>
                                    </div>
                                    <div className="text-xs text-gray-700 max-h-32 overflow-y-auto">
                                      {update.dailyUpdate}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Link */}
                                {update.link && (
                                  <div className="bg-purple-50 rounded p-2 border border-purple-200">
                                    <div className="flex items-center gap-1 mb-1">
                                      <LinkIcon className="w-3 h-3 text-purple-600 shrink-0" />
                                      <span className="text-xs font-semibold text-purple-700">Link:</span>
                                    </div>
                                    <a
                                      href={update.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 group break-all"
                                    >
                                      <span className="truncate">{update.link}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </a>
                                  </div>
                                )}
                                
                                {/* Work Details (legacy) */}
                                {update.workDetails && (
                                  <div className="bg-gray-50 rounded p-2 border border-gray-200">
                                    <div className="flex items-center gap-1 mb-1">
                                      <FileText className="w-3 h-3 text-gray-600 shrink-0" />
                                      <span className="text-xs font-semibold text-gray-700">Work:</span>
                                    </div>
                                    <div className="text-xs text-gray-600 max-h-20 overflow-y-auto">
                                      {update.workDetails}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="text-[10px] text-gray-400 text-center">
                                  {new Date(update.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-300">
                                <span className="text-2xl">−</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">Summary:</span>
          </div>
          <div className="flex gap-6">
            <div className="text-sm">
              <span className="text-gray-600">Total Employees: </span>
              <span className="font-semibold text-gray-900">{filteredEmployees.length}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Date Range: </span>
              <span className="font-semibold text-gray-900">{dates.length} days</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Total Updates: </span>
              <span className="font-semibold text-gray-900">
                {dailyUpdates.filter((update) => {
                  const updateDate = new Date(update.date);
                  return updateDate >= new Date(startDate) && updateDate <= new Date(endDate);
                }).length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
