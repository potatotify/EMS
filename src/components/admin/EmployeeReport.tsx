"use client";

import { useState, useEffect } from "react";
import { Search, Calendar, User, Clock, CheckCircle, FileText, TrendingUp, RefreshCw, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

interface Employee {
  _id: string;
  name: string;
  email: string;
  userId?: string;
}

interface Submission {
  date: string;
  type: "daily_update" | "task" | "checklist" | "attendance" | "project_update" | "hours_worked";
  title: string;
  details: string;
  status?: string;
  hoursWorked?: number;
  tasksCompleted?: string[];
  checklistItems?: { label: string; checked: boolean }[];
  attendanceStatus?: string;
}

export default function EmployeeReport() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchSubmissions();
    }
  }, [selectedEmployee, startDate, endDate]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/employees");
      const data = await response.json();
      if (response.ok && data.employees) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!selectedEmployee) return;

    setLoadingSubmissions(true);
    try {
      const employeeId = selectedEmployee.userId || selectedEmployee._id;
      const response = await fetch(
        `/api/admin/employee-report?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();
      if (response.ok && data.submissions) {
        setSubmissions(data.submissions);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "daily_update":
        return <FileText className="w-4 h-4" />;
      case "task":
        return <CheckCircle className="w-4 h-4" />;
      case "checklist":
        return <CheckCircle className="w-4 h-4" />;
      case "attendance":
        return <Calendar className="w-4 h-4" />;
      case "project_update":
        return <TrendingUp className="w-4 h-4" />;
      case "hours_worked":
        return <Clock className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "daily_update":
        return "bg-blue-100 text-blue-700";
      case "task":
        return "bg-green-100 text-green-700";
      case "checklist":
        return "bg-purple-100 text-purple-700";
      case "attendance":
        return "bg-orange-100 text-orange-700";
      case "project_update":
        return "bg-emerald-100 text-emerald-700";
      case "hours_worked":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  // Show employee selection view if no employee is selected
  if (!selectedEmployee) {
    return (
      <div className="space-y-6">
        {/* Employee Selection Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Select Employee</h3>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 placeholder-gray-500"
            />
          </div>

          {/* Employee List - More vertical with scrollbar */}
          <div className="h-[600px] overflow-y-auto space-y-2 pr-2">
            {filteredEmployees.length === 0 ? (
              <p className="text-center py-8 text-neutral-500">No employees found</p>
            ) : (
              filteredEmployees.map((employee) => (
                <motion.button
                  key={employee._id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedEmployee(employee)}
                  className="w-full text-left p-3 rounded-xl border-2 border-neutral-200 hover:border-neutral-300 bg-white transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {employee.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 truncate">{employee.name}</p>
                      <p className="text-sm text-neutral-500 truncate">{employee.email}</p>
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show submissions view when employee is selected
  return (
    <div className="space-y-6">
      {/* Back Button and Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedEmployee(null)}
            className="flex items-center gap-2 px-4 py-2 text-neutral-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back to Employee Selection</span>
          </motion.button>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">
            Submissions for {selectedEmployee.name}
          </h3>
          <p className="text-sm text-neutral-500 mt-1">{selectedEmployee.email}</p>
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Date Range</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchSubmissions}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </motion.button>
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        {loadingSubmissions ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-sm text-neutral-500">Loading submissions...</p>
            </div>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-neutral-900">No submissions found</p>
            <p className="text-sm text-neutral-500 mt-1">
              No submissions found for the selected date range
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {submissions.map((submission, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {formatDate(submission.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(submission.type)}`}>
                        {getTypeIcon(submission.type)}
                        <span>{submission.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      <div className="space-y-1">
                        <p>{submission.details}</p>
                        {submission.hoursWorked && (
                          <p className="text-xs text-neutral-500">
                            Hours: {submission.hoursWorked}h
                          </p>
                        )}
                        {submission.tasksCompleted && submission.tasksCompleted.length > 0 && (
                          <div className="text-xs text-neutral-500">
                            <p className="font-medium">Tasks:</p>
                            <ul className="list-disc list-inside ml-2">
                              {submission.tasksCompleted.slice(0, 3).map((task, i) => (
                                <li key={i}>{task}</li>
                              ))}
                              {submission.tasksCompleted.length > 3 && (
                                <li>+{submission.tasksCompleted.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {submission.checklistItems && submission.checklistItems.length > 0 && (
                          <div className="text-xs text-neutral-500">
                            <p className="font-medium">Checklist:</p>
                            <ul className="list-disc list-inside ml-2">
                              {submission.checklistItems.slice(0, 3).map((item, i) => (
                                <li key={i}>
                                  {item.checked ? "✓" : "✗"} {item.label}
                                </li>
                              ))}
                              {submission.checklistItems.length > 3 && (
                                <li>+{submission.checklistItems.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
