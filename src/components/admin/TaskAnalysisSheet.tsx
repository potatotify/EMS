"use client";

import React, { useState, useEffect } from "react";
import { FileSpreadsheet, Download, RefreshCw } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

interface TaskAnalysisData {
  _id: string;
  entryType?: "task" | "hackathon" | "task_completion";
  projectName: string;
  personAssignedTo: string;
  taskAssignedBy: string;
  taskName: string;
  taskKind: string;
  sectionName: string;
  assignedAtDate: string;
  assignedAtTime: string;
  dateDue: string;
  timeDue: string;
  deadlineDate: string;
  deadlineTime: string;
  priority: number;
  tickedBy: string;
  tickedTime: string;
  rewardsPoint: number;
  rewardsCurrency?: number;
  penaltyPoint: number;
  penaltyCurrency?: number;
  employeeGot: string;
  status: string;
  approvalStatus: string;
  approvedBy: string;
  deadlinePassed?: boolean;
  customFields?: Array<{
    name: string;
    type: "number" | "string" | "boolean" | "date";
    defaultValue?: any;
  }>;
  customFieldValues?: Record<string, any>;
  createdByEmployee?: boolean;
  isHistorical?: boolean;
  isTaskCompletion?: boolean;
  projectDeleted?: boolean;
  projectExists?: boolean;
  taskId?: string | null;
}

export default function TaskAnalysisSheet() {
  const [tasks, setTasks] = useState<TaskAnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState<number>(0);
  const [showingTasks, setShowingTasks] = useState<number>(0);
  const pageSize = 10;
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [deadlineFilter, setDeadlineFilter] = useState<string>("all");

  const fetchTasks = async (page: number = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      // Build query string with filters and pagination
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        projectFilter: projectFilter,
        employeeFilter: employeeFilter,
        deadlineFilter: deadlineFilter,
      });
      
      const response = await fetch(`/api/admin/tasks/analysis?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        // Debug: Log daily tasks received from API
        const dailyTasks = (data.tasks || []).filter((t: TaskAnalysisData) => t.taskKind === "daily");
        if (dailyTasks.length > 0) {
          console.log(`[Frontend] Received ${dailyTasks.length} daily tasks from API:`);
          dailyTasks.forEach((task: TaskAnalysisData) => {
            console.log(`  - Task ${task._id}: deadlineDate="${task.deadlineDate}", taskKind="${task.taskKind}"`);
          });
        }
        setTasks(data.tasks || []);
        setTotalTasks(data.total || 0);
        setShowingTasks(data.showing || data.tasks?.length || 0);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.page || page);
      } else {
        setError(data.error || "Failed to fetch tasks");
      }
    } catch (err) {
      setError("Error fetching task analysis");
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [projectFilter, employeeFilter, deadlineFilter]);

  // Fetch tasks when page or filters change
  useEffect(() => {
    fetchTasks(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, projectFilter, employeeFilter, deadlineFilter]);


  // Derived filter options - fetch from a separate endpoint or use cached data
  // For now, we'll fetch all unique values from the current page results
  // In a production app, you might want a separate endpoint for filter options
  const projectOptions = Array.from(new Set(tasks.map((t) => t.projectName))).sort();
  const employeeOptions = Array.from(
    new Set(tasks.map((t) => t.personAssignedTo).filter(Boolean))
  ).sort();

  // Get all unique custom field names across all tasks
  const allCustomFieldNames = new Set<string>();
  tasks.forEach((task) => {
    if (task.customFields && Array.isArray(task.customFields)) {
      task.customFields.forEach((field) => {
        if (field.name) {
          allCustomFieldNames.add(field.name);
        }
      });
    }
  });
  const customFieldNames = Array.from(allCustomFieldNames).sort();

  // Tasks are already filtered on the server, so use them directly
  const filteredTasks = tasks;

  const exportToCSV = () => {
    if (filteredTasks.length === 0) return;

    const headers = [
      "Project Name",
      "Person Assigned To",
      "Task Assigned By",
      "Task Name",
      "Task Kind",
      "Section Name",
      "Assigned At Date",
      "Assigned At Time",
      "Date Due",
      "Time Due",
      "Deadline Date",
      "Deadline Time",
      "Priority",
      "Ticked By",
      "Ticked Time",
      "Rewards Point",
      "Rewards Currency",
      "Penalty Point",
      "Penalty Currency",
      "What Employee Got",
      ...customFieldNames,
      "Status",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredTasks.map((task) => {
        const customFieldValues = customFieldNames.map((fieldName) => {
          const field = task.customFields?.find((f) => f.name === fieldName);
          const value = task.customFieldValues?.[fieldName];
          let displayValue = "";
          
          if (value !== undefined && value !== null && value !== "") {
            if (field?.type === "date" && value instanceof Date) {
              displayValue = new Date(value).toLocaleDateString();
            } else if (field?.type === "date" && typeof value === "string") {
              displayValue = new Date(value).toLocaleDateString();
            } else if (field?.type === "boolean") {
              displayValue = value ? "Yes" : "No";
            } else {
              displayValue = String(value);
            }
          }
          
          return `"${displayValue}"`;
        });
        
        return [
          `"${task.projectName}"`,
          `"${task.personAssignedTo}"`,
          `"${task.taskAssignedBy}"`,
          `"${task.taskName}"`,
          `"${task.taskKind}"`,
          `"${task.sectionName}"`,
          `"${task.assignedAtDate}"`,
          `"${task.assignedAtTime}"`,
          `"${task.dateDue}"`,
          `"${task.timeDue}"`,
          `"${task.deadlineDate}"`,
          `"${task.deadlineTime}"`,
          task.priority,
          `"${task.tickedBy}"`,
          `"${task.tickedTime}"`,
          task.rewardsPoint,
          task.rewardsCurrency || 0,
          task.penaltyPoint == null ? "" : task.penaltyPoint,
          task.penaltyCurrency == null ? "" : task.penaltyCurrency,
          `"${task.employeeGot}"`,
          ...customFieldValues,
          `"${task.status}"`,
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `task-analysis-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold text-neutral-900">
            Task Analysis
          </h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 justify-end text-xs">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">All Projects</option>
              {projectOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">All Employees</option>
              {employeeOptions.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">All Deadlines</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="overdue">Overdue</option>
              <option value="no_deadline">No Deadline</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newPage = currentPage === 1 ? 1 : 1; // Always reset to page 1 on refresh
                setCurrentPage(1);
                fetchTasks(1);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 sticky left-0 bg-neutral-50 z-10 min-w-[150px]">
                  Project Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Person Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Task Assigned By
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[150px]">
                  Task Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Task Kind
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Section Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[110px]">
                  Assigned At Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[110px]">
                  Assigned At Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Date Due
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Time Due
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[110px]">
                  Deadline Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[110px]">
                  Deadline Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[80px]">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Ticked By
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[140px]">
                  Ticked Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Rewards Point
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Rewards Currency (₹)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[100px]">
                  Penalty Point
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Penalty Currency (₹)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[140px]">
                  What Employee Got
                </th>
                {customFieldNames.map((fieldName) => (
                  <th
                    key={fieldName}
                    className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]"
                  >
                    {fieldName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={19 + customFieldNames.length} className="px-4 py-8 text-center text-neutral-500">
                    No tasks found
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  return (
                    <tr
                      key={task._id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-neutral-900 border-r border-neutral-200 sticky left-0 bg-white z-0">
                        <div className="flex items-center gap-2">
                          <span>{task.projectName}</span>
                          {task.projectDeleted && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                              Project Deleted
                            </span>
                          )}
                          {task.isTaskCompletion && task.isHistorical && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              Historical
                            </span>
                          )}
                        </div>
                      </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.personAssignedTo}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.taskAssignedBy}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 font-medium border-r border-neutral-200">
                      {task.taskName}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          task.entryType === "hackathon"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {task.entryType === "hackathon" ? "Hackathon" : task.taskKind}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.sectionName}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.assignedAtDate || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.assignedAtTime || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.dateDue || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.timeDue || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.deadlineDate || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.deadlineTime || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          task.priority >= 8
                            ? "bg-red-100 text-red-700"
                            : task.priority >= 5
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.tickedBy || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.tickedTime || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      <span className="text-green-600 font-medium">
                        {task.rewardsPoint > 0 ? `+${task.rewardsPoint}` : task.rewardsPoint}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      <span className="text-green-600 font-medium">
                        ₹{task.rewardsCurrency || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.penaltyPoint == null ? (
                        <span className="text-neutral-400">-</span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          {task.penaltyPoint > 0 ? `-${task.penaltyPoint}` : task.penaltyPoint}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200">
                      {task.penaltyCurrency == null ? (
                        <span className="text-neutral-400">-</span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          ₹{task.penaltyCurrency}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm border-r border-neutral-200">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          task.employeeGot && task.employeeGot.includes("Reward")
                            ? "bg-green-100 text-green-700"
                            : task.employeeGot && task.employeeGot.includes("Penalty")
                            ? "bg-red-100 text-red-700"
                            : task.employeeGot === "Not Completed"
                            ? "bg-neutral-100 text-neutral-700"
                            : task.employeeGot
                            ? "bg-blue-100 text-blue-700"
                            : "text-neutral-400"
                        }`}
                      >
                        {task.employeeGot || "-"}
                      </span>
                    </td>
                    {customFieldNames.map((fieldName) => {
                      const field = task.customFields?.find((f) => f.name === fieldName);
                      // Use customFieldValues if available (from employee), otherwise use defaultValue
                      const value = task.customFieldValues?.[fieldName] !== undefined 
                        ? task.customFieldValues[fieldName] 
                        : field?.defaultValue;
                      let displayValue = "-";
                      
                      if (value !== undefined && value !== null && value !== "") {
                        if (field?.type === "date") {
                          try {
                            if (value instanceof Date) {
                              displayValue = new Date(value).toLocaleDateString();
                            } else if (typeof value === "string") {
                              displayValue = new Date(value).toLocaleDateString();
                            } else {
                              displayValue = String(value);
                            }
                          } catch (e) {
                            displayValue = String(value);
                          }
                        } else if (field?.type === "boolean") {
                          displayValue = value === true || value === "true" ? "Yes" : value === false || value === "false" ? "No" : "-";
                        } else {
                          displayValue = String(value);
                        }
                      }
                      
                      return (
                        <td
                          key={fieldName}
                          className="px-4 py-3 text-sm text-neutral-700 border-r border-neutral-200"
                        >
                          <span className="text-xs">{displayValue}</span>
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

      {/* Pagination and Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600">
          Showing <span className="font-semibold">{showingTasks}</span> of <span className="font-semibold">{totalTasks}</span> tasks
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }
              }}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            
            <span className="text-sm text-neutral-600">
              Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span>
            </span>
            
            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  setCurrentPage(currentPage + 1);
                }
              }}
              disabled={currentPage === totalPages || loading}
              className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

