"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Filter, FileText, Clock, Calendar, Award, User, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

interface ProjectUpdate {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  date: string;
  hoursWorked: number;
  progress: number;
  tasksCompleted?: string[];
  notes?: string;
  challenges?: string;
  nextSteps?: string;
}

interface Employee {
  _id: string;
  name: string;
  email: string;
}

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  status: string;
  leadAssignees: Employee[];
  assignees: Employee[];
  updates: ProjectUpdate[];
}

export default function ProjectDailyUpdatesTable() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>("10");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [useCustomRange, setUseCustomRange] = useState(false);

  useEffect(() => {
    fetchProjectUpdates();
  }, []);

  useEffect(() => {
    // Refetch when date range changes (but not when project selection changes)
    if (projects.length > 0) {
      fetchProjectUpdates();
    }
  }, [dateRange, customStartDate, customEndDate, useCustomRange]);

  const fetchProjectUpdates = async () => {
    setLoading(true);
    try {
      let url = "/api/admin/project-daily-updates";
      const params = new URLSearchParams();
      
      // Don't filter by projectId - always fetch all projects so dropdown works
      // The selection is handled client-side for display
      
      if (useCustomRange && customStartDate && customEndDate) {
        params.append("startDate", customStartDate);
        params.append("endDate", customEndDate);
      } else {
        params.append("days", dateRange);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects || []);
        // Auto-select first project if none selected
        if (!selectedProjectId && data.projects && data.projects.length > 0) {
          setSelectedProjectId(data.projects[0]._id);
        }
      } else {
        console.error("Failed to fetch project updates:", data.error);
      }
    } catch (error) {
      console.error("Error fetching project updates:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit"
    });
  };

  // Get selected project
  const selectedProject = projects.find(p => p._id === selectedProjectId);

  // Get unique dates from selected project (most recent first)
  const getUniqueDates = () => {
    if (!selectedProject) return [];
    
    const dateSet = new Set<string>();
    selectedProject.updates.forEach(update => {
      const dateStr = new Date(update.date).toDateString();
      dateSet.add(dateStr);
    });
    
    const dates = Array.from(dateSet).map(dateStr => new Date(dateStr));
    dates.sort((a, b) => b.getTime() - a.getTime()); // Most recent first
    
    return dates;
  };

  const uniqueDates = getUniqueDates();

  // Get all employees for the selected project
  const getProjectEmployees = () => {
    if (!selectedProject) return [];

    const employeeMap = new Map<string, {
      employee: Employee;
      isLeadAssignee: boolean;
    }>();

    // Add all assignees
    selectedProject.assignees.forEach(assignee => {
      const isLead = selectedProject.leadAssignees.some(lead => lead._id === assignee._id);
      employeeMap.set(assignee._id, {
        employee: assignee,
        isLeadAssignee: isLead
      });
    });

    // Add lead assignees if not already in assignees
    selectedProject.leadAssignees.forEach(lead => {
      if (!employeeMap.has(lead._id)) {
        employeeMap.set(lead._id, {
          employee: lead,
          isLeadAssignee: true
        });
      }
    });

    // Also add any employees who have submitted updates but aren't in assignees
    selectedProject.updates.forEach(update => {
      if (!employeeMap.has(update.employeeId)) {
        employeeMap.set(update.employeeId, {
          employee: {
            _id: update.employeeId,
            name: update.employeeName,
            email: update.employeeEmail
          },
          isLeadAssignee: false
        });
      }
    });

    // Convert to array and sort: lead assignees first, then by name
    const employeeList = Array.from(employeeMap.values());
    employeeList.sort((a, b) => {
      if (a.isLeadAssignee && !b.isLeadAssignee) return -1;
      if (!a.isLeadAssignee && b.isLeadAssignee) return 1;
      return a.employee.name.localeCompare(b.employee.name);
    });

    return employeeList;
  };

  const projectEmployees = getProjectEmployees();

  // Get update for a specific employee on a specific date
  const getUpdateForDate = (employeeId: string, date: Date) => {
    if (!selectedProject) return null;
    
    const dateStr = date.toDateString();
    return selectedProject.updates.find(update => {
      const updateDate = new Date(update.date);
      return update.employeeId === employeeId && updateDate.toDateString() === dateStr;
    });
  };

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-neutral-600">Loading project updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-col gap-6">
          {/* Project Selector and Date Range Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Project
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full appearance-none px-4 py-3 pr-10 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white"
                >
                  <option value="">-- Select a Project --</option>
                  {projects.map(project => (
                    <option key={project._id} value={project._id}>
                      {project.projectName}{project.clientName ? ` (${project.clientName})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Date Range
              </label>
              <div className="flex gap-2">
                <select
                  value={useCustomRange ? "custom" : dateRange}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setUseCustomRange(true);
                    } else {
                      setUseCustomRange(false);
                      setDateRange(e.target.value);
                    }
                  }}
                  className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                >
                  <option value="7">Last 7 days</option>
                  <option value="10">Last 10 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>
          </div>

          {/* Custom Date Range */}
          {useCustomRange && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex gap-4"
            >
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Table */}
      {!selectedProject ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-300/50 rounded-2xl bg-neutral-50/50">
          <FileText className="w-20 h-20 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-neutral-800 mb-2">No project selected</p>
          <p className="text-neutral-600 text-sm">
            Please select a project from the dropdown above to view daily updates
          </p>
        </div>
      ) : projectEmployees.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-300/50 rounded-2xl bg-neutral-50/50">
          <User className="w-20 h-20 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-neutral-800 mb-2">No employees assigned</p>
          <p className="text-neutral-600 text-sm">
            No employees are assigned to this project yet
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {/* Fixed column - Employee Name */}
                  <th className="sticky left-0 bg-neutral-50 px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 z-10 min-w-[220px]">
                    Employee
                  </th>
                  {/* Date columns - Most recent first */}
                  {uniqueDates.map((date, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-4 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider min-w-[220px] border-r border-neutral-200 last:border-r-0"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(date.toString())}</span>
                      </div>
                    </th>
                  ))}
                  {uniqueDates.length === 0 && (
                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      No Updates Yet
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {projectEmployees.map((empData, index) => (
                  <motion.tr
                    key={empData.employee._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    {/* Fixed column - Employee Info */}
                    <td className="sticky left-0 bg-white px-6 py-4 border-r border-neutral-200 z-10 hover:bg-neutral-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                          empData.isLeadAssignee 
                            ? "bg-linear-to-br from-amber-500 to-orange-600" 
                            : "bg-linear-to-br from-blue-500 to-indigo-600"
                        }`}>
                          {empData.employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-900">
                              {empData.employee.name}
                            </p>
                            {empData.isLeadAssignee && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-linear-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-300">
                                <Award className="w-3 h-3" />
                                Lead
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500">{empData.employee.email}</p>
                        </div>
                      </div>
                    </td>
                    
                    {/* Date columns */}
                    {uniqueDates.map((date, idx) => {
                      const update = getUpdateForDate(empData.employee._id, date);
                      return (
                        <td
                          key={idx}
                          className="px-4 py-4 text-sm border-r border-neutral-200 last:border-r-0 align-top"
                        >
                          {update ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-xs">{update.hoursWorked}h</span>
                                </div>
                                {update.progress > 0 && (
                                  <div className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                    {update.progress}%
                                  </div>
                                )}
                              </div>
                              
                              {update.tasksCompleted && update.tasksCompleted.length > 0 && (
                                <div className="text-xs text-neutral-700">
                                  <span className="font-medium">Tasks:</span>
                                  <ul className="mt-1 space-y-0.5">
                                    {update.tasksCompleted.slice(0, 3).map((task, i) => (
                                      <li key={i} className="truncate">• {task}</li>
                                    ))}
                                    {update.tasksCompleted.length > 3 && (
                                      <li className="text-neutral-500">
                                        +{update.tasksCompleted.length - 3} more
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}
                              
                              {update.notes && (
                                <div className="text-xs text-neutral-600 line-clamp-2">
                                  <span className="font-medium">Notes:</span> {update.notes}
                                </div>
                              )}
                              
                              {update.challenges && (
                                <div className="text-xs text-red-600 line-clamp-1">
                                  <span className="font-medium">Challenges:</span> {update.challenges}
                                </div>
                              )}
                              
                              <div className="text-xs text-neutral-400">
                                {formatTime(update.date)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-neutral-400 text-xs py-2">
                              No update
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {uniqueDates.length === 0 && (
                      <td className="px-6 py-4 text-center text-neutral-400 text-sm">
                        No updates submitted
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
