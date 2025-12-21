"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  FolderKanban, 
  Search, 
  RefreshCw, 
  Download,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter
} from "lucide-react";

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  description: string;
  deadline: string;
  status: string;
  priority: string;
  tags: string[];
  leadAssignee?: {
    name: string;
    email: string;
  };
  vaIncharge?: {
    name: string;
    email: string;
  };
  updateIncharge?: {
    name: string;
    email: string;
  };
  startDate?: string;
  budget?: string;
  clientProgress?: number;
  internalProgress?: number;
  createdAt?: string;
  totalUpdates?: number;
  totalHours?: number;
  daysRemaining?: number;
  daysOverdue?: number;
}

export default function ProjectAnalysisSheet() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/projects/analysis");
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects || []);
      } else {
        const errorMsg = data.error || data.details || "Unknown error";
        setError(errorMsg);
        console.error("Error fetching projects:", errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch projects";
      setError(errorMsg);
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_assignment":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "completed":
        return "bg-green-100 text-green-800 border-green-300";
      case "on_hold":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-600 font-bold";
      case "high":
        return "text-orange-600 font-semibold";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 50) return "bg-yellow-500";
    if (progress >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = 
      project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || project.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const exportToCSV = () => {
    const headers = [
      "Project Name",
      "Client",
      "Status",
      "Priority",
      "Start Date",
      "Deadline",
      "Days Remaining",
      "Days Overdue",
      "Client Progress %",
      "Internal Progress %",
      "Total Updates",
      "Total Hours",
      "Budget",
      "Lead Assignee",
      "VA Incharge",
      "Update Incharge",
      "Tags"
    ];

    const rows = filteredProjects.map(p => [
      p.projectName,
      p.clientName,
      p.status,
      p.priority,
      p.startDate ? new Date(p.startDate).toLocaleDateString() : "N/A",
      new Date(p.deadline).toLocaleDateString(),
      p.daysRemaining !== undefined ? p.daysRemaining : "N/A",
      p.daysOverdue || 0,
      p.clientProgress || 0,
      p.internalProgress || 0,
      p.totalUpdates || 0,
      p.totalHours || 0,
      p.budget || "N/A",
      (() => {
        const leadAssignee = p.leadAssignee;
        if (!leadAssignee) return "Unassigned";
        if (Array.isArray(leadAssignee)) {
          if (leadAssignee.length === 0) return "Unassigned";
          return leadAssignee.map((lead: any) => lead?.name || 'Unknown').join(', ');
        }
        return leadAssignee.name || "Unassigned";
      })(),
      p.vaIncharge?.name || "N/A",
      p.updateIncharge?.name || "N/A",
      p.tags?.join(", ") || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const stats = {
    total: projects.length,
    inProgress: projects.filter(p => p.status === "in_progress").length,
    completed: projects.filter(p => p.status === "completed").length,
    onHold: projects.filter(p => p.status === "on_hold").length,
    overdue: projects.filter(p => (p.daysOverdue || 0) > 0).length,
    avgProgress: projects.length > 0 
      ? Math.round(projects.reduce((sum, p) => sum + (p.clientProgress || 0), 0) / projects.length)
      : 0
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 font-semibold mb-2">Error loading projects</p>
          <p className="text-neutral-600 text-sm mb-4">{error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchProjects}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending_assignment">Pending Assignment</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchProjects}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </motion.button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <p className="text-sm text-neutral-600">Total Projects</p>
          <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-200">
          <p className="text-sm text-blue-600">In Progress</p>
          <p className="text-2xl font-bold text-blue-900">{stats.inProgress}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl shadow-sm border border-green-200">
          <p className="text-sm text-green-600">Completed</p>
          <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-200">
          <p className="text-sm text-red-600">On Hold</p>
          <p className="text-2xl font-bold text-red-900">{stats.onHold}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl shadow-sm border border-amber-200">
          <p className="text-sm text-amber-600">Overdue</p>
          <p className="text-2xl font-bold text-amber-900">{stats.overdue}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-200">
          <p className="text-sm text-purple-600">Avg. Progress</p>
          <p className="text-2xl font-bold text-purple-900">{stats.avgProgress}%</p>
        </div>
      </div>

      {/* Excel-like Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2000px]">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 bg-gradient-to-r from-emerald-600 to-teal-600 z-10">
                  Project Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Days Remaining</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Days Overdue</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Client Progress</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Internal Progress</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Total Updates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Total Hours</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Budget</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Lead Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">VA Incharge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Update Incharge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-neutral-500">
                    {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                      ? "No projects found matching your filters"
                      : "No projects found"}
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project, index) => {
                  const isOverdue = (project.daysOverdue || 0) > 0;
                  return (
                    <motion.tr
                      key={project._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`hover:bg-neutral-50 transition-colors ${isOverdue ? "bg-red-50/30" : ""}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900 sticky left-0 bg-white z-10 border-r border-neutral-200">
                        {project.projectName}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{project.clientName}</td>
                      <td className="px-4 py-3 w-40">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border  ${getStatusColor(project.status)}`}>
                          {project.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${getPriorityColor(project.priority)}`}>
                          {project.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(project.deadline).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {project.daysRemaining !== undefined ? (
                          <span className={project.daysRemaining < 7 ? "text-red-600" : "text-neutral-900"}>
                            {project.daysRemaining} days
                          </span>
                        ) : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {isOverdue ? (
                          <span className="text-red-600 font-bold">{project.daysOverdue} days</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-neutral-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getProgressColor(project.clientProgress || 0)}`}
                              style={{ width: `${project.clientProgress || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-neutral-900 w-12 text-right">
                            {project.clientProgress || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-neutral-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getProgressColor(project.internalProgress || 0)}`}
                              style={{ width: `${project.internalProgress || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-neutral-900 w-12 text-right">
                            {project.internalProgress || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{project.totalUpdates || 0}</td>
                      <td className="px-4 py-3 text-sm text-neutral-900 font-medium">{project.totalHours || 0}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{project.budget || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {(() => {
                          const leadAssignee = project.leadAssignee;
                          if (!leadAssignee) return "Unassigned";
                          if (Array.isArray(leadAssignee)) {
                            if (leadAssignee.length === 0) return "Unassigned";
                            return leadAssignee.map((lead: any) => lead?.name || 'Unknown').join(', ');
                          }
                          return leadAssignee.name || "Unassigned";
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {project.vaIncharge?.name || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {project.updateIncharge?.name || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {project.tags?.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded">
                              {tag}
                            </span>
                          ))}
                          {project.tags && project.tags.length > 2 && (
                            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded">
                              +{project.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



