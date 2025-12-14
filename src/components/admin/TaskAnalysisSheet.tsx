"use client";

import { useState, useEffect } from "react";
import { FileSpreadsheet, Download, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

interface TaskAnalysisData {
  _id: string;
  entryType?: "task" | "hackathon";
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
}

export default function TaskAnalysisSheet() {
  const [tasks, setTasks] = useState<TaskAnalysisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [editingApprovalTaskId, setEditingApprovalTaskId] = useState<string | null>(null);
  const [settingPointsTaskId, setSettingPointsTaskId] = useState<string | null>(null);
  const [pointsForm, setPointsForm] = useState<{ bonusPoints: number; bonusCurrency: number; penaltyPoints: number; penaltyCurrency: number }>({ bonusPoints: 0, bonusCurrency: 0, penaltyPoints: 0, penaltyCurrency: 0 });
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [deadlineFilter, setDeadlineFilter] = useState<string>("all");

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/tasks/analysis", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || []);
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

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleApprove = async (taskId: string, approve: boolean, bonusPoints?: number, bonusCurrency?: number, penaltyPoints?: number, penaltyCurrency?: number) => {
    setApprovingTaskId(taskId);
    try {
      const response = await fetch(`/api/admin/tasks/${taskId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, bonusPoints, bonusCurrency, penaltyPoints, penaltyCurrency }),
      });

      if (response.ok) {
        // After approval/rejection, re-fetch from server so data is consistent
        await fetchTasks();
        setEditingApprovalTaskId(null);
        setSettingPointsTaskId(null);
        setPointsForm({ bonusPoints: 0, bonusCurrency: 0, penaltyPoints: 0, penaltyCurrency: 0 });
      } else {
        const errorData = await response.json();
        if (errorData.requiresPoints) {
          // Show points setting UI for employee-created tasks
          setSettingPointsTaskId(taskId);
        } else {
          alert(errorData.error || "Failed to approve task");
        }
      }
    } catch (err) {
      console.error("Error approving task:", err);
      alert("Failed to approve task. Please try again.");
    } finally {
      setApprovingTaskId(null);
    }
  };

  const handleApproveAll = async () => {
    // Find all tasks that are unapproved and not rejected (excluding hackathon entries)
    const unapprovedTasks = tasks.filter(
      (task) =>
        task.entryType !== "hackathon" &&
        task.approvalStatus !== "approved" &&
        task.approvalStatus !== "rejected"
    );

    if (unapprovedTasks.length === 0) {
      alert("No unapproved tasks to approve");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to approve ${unapprovedTasks.length} task(s)?`
    );
    if (!confirmed) return;

    setApprovingAll(true);
    try {
      const response = await fetch("/api/admin/tasks/mass-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: unapprovedTasks.map((t) => t._id),
          approve: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchTasks();
        setEditingApprovalTaskId(null);
        alert(`Successfully approved ${data.successful} task(s)`);
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to approve tasks");
      }
    } catch (err) {
      console.error("Error approving all tasks:", err);
      alert("Failed to approve tasks. Please try again.");
    } finally {
      setApprovingAll(false);
    }
  };

  // Derived filter options
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

  // Apply filters
  const filteredTasks = tasks.filter((task) => {
    if (projectFilter !== "all" && task.projectName !== projectFilter) return false;

    if (
      employeeFilter !== "all" &&
      task.personAssignedTo &&
      task.personAssignedTo !== employeeFilter
    ) {
      return false;
    }

    if (approvalFilter !== "all") {
      if (approvalFilter === "pending") {
        if (task.approvalStatus && task.approvalStatus !== "pending") return false;
      } else if (task.approvalStatus !== approvalFilter) {
        return false;
      }
    }

    if (deadlineFilter !== "all") {
      const today = new Date();
      const todayStr = today.toDateString();

      const deadlineStr = task.deadlineDate || task.dateDue;
      if (!deadlineStr) {
        if (deadlineFilter === "no_deadline") return true;
        return false;
      }

      const d = new Date(deadlineStr);

      if (deadlineFilter === "overdue") {
        return d < today;
      }
      if (deadlineFilter === "today") {
        return d.toDateString() === todayStr;
      }
      if (deadlineFilter === "upcoming") {
        return d > today;
      }
    }

    return true;
  });

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
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="all">All Approvals</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="deadline_passed">Deadline Passed</option>
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
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              {approvingAll ? "Approving..." : "Approve All Unapproved"}
            </button>
            <button
              onClick={fetchTasks}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 min-w-[120px]">
                  Approve
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={20 + customFieldNames.length} className="px-4 py-8 text-center text-neutral-500">
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
                        {task.projectName}
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
                    <td className="px-4 py-3 text-sm border-r border-neutral-200">
                      {task.entryType === "hackathon" ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          Hackathon Entry
                        </span>
                      ) : settingPointsTaskId === task._id && task.createdByEmployee && task.status === "completed" ? (
                        // Employee-created task: require bonus/penalty points before approval
                        <div className="flex flex-col gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="text-xs font-semibold text-yellow-800">Set Rewards/Penalties (Required for Employee-Created Tasks)</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-neutral-600">Bonus Points</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Points"
                                value={pointsForm.bonusPoints}
                                onChange={(e) => setPointsForm({ ...pointsForm, bonusPoints: parseInt(e.target.value) || 0 })}
                                className="w-full px-2 py-1 text-xs border border-neutral-300 rounded"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-neutral-600">Bonus Currency (₹)</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Currency"
                                value={pointsForm.bonusCurrency}
                                onChange={(e) => setPointsForm({ ...pointsForm, bonusCurrency: parseInt(e.target.value) || 0 })}
                                className="w-full px-2 py-1 text-xs border border-neutral-300 rounded"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-neutral-600">Penalty Points</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Points"
                                value={pointsForm.penaltyPoints}
                                onChange={(e) => setPointsForm({ ...pointsForm, penaltyPoints: parseInt(e.target.value) || 0 })}
                                className="w-full px-2 py-1 text-xs border border-neutral-300 rounded"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-neutral-600">Penalty Currency (₹)</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Currency"
                                value={pointsForm.penaltyCurrency}
                                onChange={(e) => setPointsForm({ ...pointsForm, penaltyCurrency: parseInt(e.target.value) || 0 })}
                                className="w-full px-2 py-1 text-xs border border-neutral-300 rounded"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleApprove(task._id, true, pointsForm.bonusPoints, pointsForm.bonusCurrency, pointsForm.penaltyPoints, pointsForm.penaltyCurrency)}
                              disabled={approvingTaskId === task._id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSettingPointsTaskId(null);
                                setPointsForm({ bonusPoints: 0, bonusCurrency: 0, penaltyPoints: 0, penaltyCurrency: 0 });
                              }}
                              className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : editingApprovalTaskId === task._id ? (
                        // Edit mode: show Approve/Reject buttons
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(task._id, true)}
                            disabled={approvingTaskId === task._id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprove(task._id, false)}
                            disabled={approvingTaskId === task._id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      ) : task.approvalStatus === "approved" ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            Approved
                          </span>
                          <button
                            onClick={() => setEditingApprovalTaskId(task._id)}
                            className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                          >
                            Edit
                          </button>
                        </div>
                      ) : task.approvalStatus === "rejected" ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                            Rejected
                          </span>
                          <button
                            onClick={() => setEditingApprovalTaskId(task._id)}
                            className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                          >
                            Edit
                          </button>
                        </div>
                      ) : task.approvalStatus === "deadline_passed" ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            Deadline Passed
                          </span>
                          <button
                            onClick={() => setEditingApprovalTaskId(task._id)}
                            className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        // Pending (not yet approved/rejected): show Approve/Reject directly
                        // For employee-created completed tasks, show special message
                        task.createdByEmployee && task.status === "completed" ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-yellow-700 font-medium">Employee-Created Task</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSettingPointsTaskId(task._id);
                                  setPointsForm({ bonusPoints: 0, bonusCurrency: 0, penaltyPoints: 0, penaltyCurrency: 0 });
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Set Points & Approve
                              </button>
                              <button
                                onClick={() => handleApprove(task._id, false)}
                                disabled={approvingTaskId === task._id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(task._id, true)}
                              disabled={approvingTaskId === task._id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(task._id, false)}
                              disabled={approvingTaskId === task._id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-neutral-600">
        Total Tasks: <span className="font-semibold">{tasks.length}</span>
      </div>
    </div>
  );
}

