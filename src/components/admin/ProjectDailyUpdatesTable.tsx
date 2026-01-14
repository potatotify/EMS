"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Filter, FileText, Clock, Calendar, Award, User, ChevronDown, X } from "lucide-react";
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

interface TableRow {
  type: "project" | "employee";
  projectId?: string;
  projectName?: string;
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  isLeadAssignee?: boolean;
}

export default function ProjectDailyUpdatesTable() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("10");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [useCustomRange, setUseCustomRange] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchProjectUpdates();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      fetchProjectUpdates();
    }
  }, [dateRange, customStartDate, customEndDate, useCustomRange]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/admin/employees");
      const data = await response.json();
      if (response.ok && data.employees) {
        const mappedEmployees = (data.employees || []).map((emp: any) => ({
          _id: emp.userId ? emp.userId.toString() : emp._id.toString(),
          name: emp.fullName || emp.name || "Unknown Employee",
          email: emp.email || "",
        }));
        setAllEmployees(mappedEmployees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchProjectUpdates = async () => {
    setLoading(true);
    try {
      let url = "/api/admin/project-daily-updates";
      const params = new URLSearchParams();
      
      if (selectedProjectId) {
        params.append("projectId", selectedProjectId);
      }
      
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

  // Get all unique dates across all projects (most recent first)
  const getAllUniqueDates = () => {
    const dateSet = new Set<string>();
    
    projects.forEach(project => {
      project.updates.forEach(update => {
        const dateStr = new Date(update.date).toDateString();
        dateSet.add(dateStr);
      });
    });
    
    const dates = Array.from(dateSet).map(dateStr => new Date(dateStr));
    dates.sort((a, b) => b.getTime() - a.getTime()); // Most recent first
    
    return dates;
  };

  const uniqueDates = getAllUniqueDates();

  // Build table rows: group employees by project
  interface ProjectGroup {
    project: Project;
    employees: Array<{
      employee: Employee;
      isLeadAssignee: boolean;
    }>;
  }

  const buildProjectGroups = (): ProjectGroup[] => {
    // Filter projects
    let filteredProjects = projects;
    if (selectedProjectId) {
      filteredProjects = projects.filter(p => p._id === selectedProjectId);
    }
    
    return filteredProjects.map(project => {
      // Get employees for this project
      const employeeMap = new Map<string, {
        employee: Employee;
        isLeadAssignee: boolean;
      }>();

      // Add all assignees
      project.assignees.forEach(assignee => {
        const isLead = project.leadAssignees.some(lead => lead._id === assignee._id);
        employeeMap.set(assignee._id, {
          employee: assignee,
          isLeadAssignee: isLead
        });
      });

      // Add lead assignees if not already in assignees
      project.leadAssignees.forEach(lead => {
        if (!employeeMap.has(lead._id)) {
          employeeMap.set(lead._id, {
            employee: lead,
            isLeadAssignee: true
          });
        }
      });

      // Also add any employees who have submitted updates but aren't in assignees
      project.updates.forEach(update => {
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

      // Filter employees if employee filter is selected
      let filteredEmployees = employeeList;
      if (selectedEmployeeId) {
        filteredEmployees = employeeList.filter(emp => emp.employee._id === selectedEmployeeId);
      }

      return {
        project,
        employees: filteredEmployees
      };
    }).filter(group => group.employees.length > 0); // Only include projects with employees
  };

  const projectGroups = buildProjectGroups();


  // Get update for a specific employee on a specific date
  const getUpdateForDate = (projectId: string, employeeId: string, date: Date) => {
    const project = projects.find(p => p._id === projectId);
    if (!project) return null;
    
    const dateStr = date.toDateString();
    return project.updates.find(update => {
      const updateDate = new Date(update.date);
      return update.employeeId === employeeId && updateDate.toDateString() === dateStr;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedProjectId("");
    setSelectedEmployeeId("");
    setDateRange("10");
    setCustomStartDate("");
    setCustomEndDate("");
    setUseCustomRange(false);
  };

  // Check if any filters are active
  const hasActiveFilters = selectedProjectId || selectedEmployeeId || useCustomRange;

  // Table Skeleton Loader
  const TableRowSkeleton = () => (
    <tr className="hover:bg-neutral-50 transition-colors animate-pulse">
      <td className="sticky left-0 bg-white px-6 py-4 border-r border-neutral-200 z-10">
        <div className="h-4 bg-neutral-200 rounded w-32"></div>
      </td>
      <td className="px-6 py-4 border-r border-neutral-200">
        <div className="h-4 bg-neutral-200 rounded w-40"></div>
      </td>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-4 border-r border-neutral-200">
          <div className="space-y-2">
            <div className="h-3 bg-neutral-200 rounded w-16 mx-auto"></div>
            <div className="h-20 bg-neutral-100 rounded"></div>
          </div>
        </td>
      ))}
    </tr>
  );

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-6">
        {/* Filters Skeleton */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 animate-pulse">
          <div className="h-10 bg-neutral-200 rounded w-32"></div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="sticky left-0 bg-neutral-50 px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 z-10 min-w-[200px]">
                    Project
                  </th>
                  <th className="sticky left-[200px] bg-neutral-50 px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 z-10 min-w-[220px]">
                    Employee
                  </th>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <th key={i} className="px-4 py-4 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider min-w-[220px] border-r border-neutral-200">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-3 h-3 bg-neutral-200 rounded"></div>
                        <div className="h-3 bg-neutral-200 rounded w-20"></div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
                <TableRowSkeleton />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              Active
            </span>
          )}
        </button>
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6"
        >
          <div className="flex flex-col gap-6">
            {/* Project and Employee Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Filter by Project
                </label>
                <div className="relative">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full appearance-none px-4 py-3 pr-10 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Projects</option>
                    {projects.map(project => (
                      <option key={project._id} value={project._id}>
                        {project.projectName}{project.clientName ? ` (${project.clientName})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Filter by Employee
                </label>
                <div className="relative">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full appearance-none px-4 py-3 pr-10 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Employees</option>
                    {allEmployees.map(employee => (
                      <option key={employee._id} value={employee._id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
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

            {/* Custom Date Range */}
            {useCustomRange && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div>
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
                <div>
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
        </motion.div>
      )}

      {/* Main Table */}
      {projectGroups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-300/50 rounded-2xl bg-neutral-50/50">
          <FileText className="w-20 h-20 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-neutral-800 mb-2">No data available</p>
          <p className="text-neutral-600 text-sm">
            {hasActiveFilters 
              ? "No updates found matching your filters. Try adjusting your filters."
              : "No project updates found for the selected date range"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {/* Fixed column - Project Name */}
                  <th className="sticky left-0 bg-neutral-50 px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 z-20 min-w-[200px]">
                    Project Name
                  </th>
                  {/* Fixed column - Employee Name */}
                  <th className="sticky left-[200px] bg-neutral-50 px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 z-20 min-w-[220px]">
                    Employee Name
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
                {projectGroups.map((group, groupIndex) => {
                  return group.employees.map((empData, empIndex) => {
                    const isFirstEmployee = empIndex === 0;
                    const rowSpan = group.employees.length;
                    
                    return (
                      <motion.tr
                        key={`employee-${empData.employee._id}-${group.project._id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: (groupIndex * 10 + empIndex) * 0.01 }}
                        className="hover:bg-neutral-50 transition-colors"
                      >
                        {/* Project Name Column - spans all employee rows for this project */}
                        {isFirstEmployee && (
                          <td
                            rowSpan={rowSpan}
                            className="sticky left-0 bg-white px-6 py-4 border-r border-neutral-200 z-10 hover:bg-neutral-50 align-top"
                          >
                            <div className="flex items-center gap-2 font-semibold text-neutral-900">
                              <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <div>
                                <div>{group.project.projectName}</div>
                                {group.project.clientName && (
                                  <div className="text-xs font-normal text-neutral-600 mt-0.5">
                                    {group.project.clientName}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        
                        {/* Employee Name Column - fixed/sticky */}
                        <td className="sticky left-[200px] bg-white px-6 py-4 border-r border-neutral-200 z-10 hover:bg-neutral-50">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
                              empData.isLeadAssignee 
                                ? "bg-gradient-to-br from-amber-500 to-orange-600" 
                                : "bg-gradient-to-br from-blue-500 to-indigo-600"
                            }`}>
                              {empData.employee.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-neutral-900">
                                  {empData.employee.name}
                                </p>
                                {empData.isLeadAssignee && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-300 flex-shrink-0">
                                    <Award className="w-3 h-3" />
                                    Lead
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-500 truncate">{empData.employee.email}</p>
                            </div>
                          </div>
                        </td>
                        
                        {/* Date columns */}
                        {uniqueDates.map((date, idx) => {
                          const update = getUpdateForDate(group.project._id, empData.employee._id, date);
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
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
