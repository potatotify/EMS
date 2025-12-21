"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Filter, FileText, Clock, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface ProjectUpdate {
  date: string;
  hoursWorked: number;
  tasksCompleted?: string[];
  notes?: string;
  employeeName?: string;
}

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  status: string;
  leadAssignee?: {
    name: string;
    email: string;
  };
  updates: ProjectUpdate[];
}

export default function ProjectDailyUpdatesTable() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchProjectUpdates();
  }, []);

  const fetchProjectUpdates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/project-daily-updates");
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

  const filteredProjects = projects.filter((project) => {
    if (statusFilter === "all") return true;
    return project.status === statusFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200";
      case "client_meeting_done":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "contact_made":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "recontacted":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "stalled":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "requirements_sent":
        return "bg-cyan-100 text-cyan-700 border-cyan-200";
      case "waiting_for_requirement":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "awaiting_testimonial":
        return "bg-pink-100 text-pink-700 border-pink-200";
      case "training":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "pending_assignment":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "in_progress":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "on_hold":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Get last 10 days dates for table headers (newest first)
  const getLast10Days = () => {
    const days = [];
    for (let i = 0; i <= 9; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date);
    }
    return days;
  };

  const last10Days = getLast10Days();

  // Get update for a specific date
  const getUpdateForDate = (project: Project, date: Date) => {
    const dateStr = date.toDateString();
    return project.updates.find((update) => {
      const updateDate = new Date(update.date);
      return updateDate.toDateString() === dateStr;
    });
  };

  if (loading) {
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
      {/* Header and Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                <FileText className="w-6 h-6" />
              </div>
              Project Daily Updates
            </h2>
            <p className="text-sm text-neutral-600 mt-1.5 ml-14">
              View daily updates submitted by lead assignees for the past 10 days
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchProjectUpdates}
              className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </motion.button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-neutral-700">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter by Status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All Projects" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "client_meeting_done", label: "Client Meeting Done" },
              { value: "contact_made", label: "Contact Made" },
              { value: "active", label: "Active" },
              { value: "recontacted", label: "Recontacted" },
              { value: "stalled", label: "Stalled" },
              { value: "requirements_sent", label: "Requirements Sent" },
              { value: "waiting_for_requirement", label: "Waiting for Requirement" },
              { value: "awaiting_testimonial", label: "Awaiting Testimonial" },
              { value: "training", label: "Training" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === filter.value
                    ? "bg-emerald-500 text-white shadow-md"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-300/50 rounded-2xl bg-neutral-50/50">
          <FileText className="w-20 h-20 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-neutral-800 mb-2">No projects found</p>
          <p className="text-neutral-600 text-sm">
            {statusFilter === "all"
              ? "No projects with daily updates are available"
              : `No projects with status "${statusFilter}" found`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {/* Fixed columns */}
                  <th className="sticky left-0 bg-neutral-50 px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-r border-neutral-200 z-10">
                    Project Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider min-w-[120px]">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider min-w-[100px]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider min-w-[150px] border-r border-neutral-200">
                    Lead Assignee
                  </th>
                  {/* Date columns */}
                  {last10Days.map((date, idx) => (
                    <th
                      key={idx}
                      className="px-3 py-3 text-center text-xs font-semibold text-neutral-700 uppercase tracking-wider min-w-[140px] border-r border-neutral-200 last:border-r-0"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(date.toString())}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {filteredProjects.map((project, index) => (
                  <motion.tr
                    key={project._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    {/* Fixed columns */}
                    <td className="sticky left-0 bg-white px-4 py-4 text-sm font-semibold text-neutral-900 border-r border-neutral-200 z-10 hover:bg-neutral-50">
                      {project.projectName}
                    </td>
                    <td className="px-4 py-4 text-sm text-neutral-700">
                      {project.clientName}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {project.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-neutral-700 border-r border-neutral-200">
                      {Array.isArray(project.leadAssignee) 
                        ? (project.leadAssignee.length === 0 
                            ? "Unassigned" 
                            : project.leadAssignee.map((lead: any) => lead?.name || 'Unknown').join(', '))
                        : (project.leadAssignee?.name || "Unassigned")}
                    </td>
                    {last10Days.map((date, idx) => {
                      const update = getUpdateForDate(project, date);
                      return (
                        <td
                          key={idx}
                          className="px-3 py-4 text-sm border-r border-neutral-200 last:border-r-0"
                        >
                          {update ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-center gap-1 text-emerald-600 font-semibold">
                                <Clock className="w-3 h-3" />
                                <span>{update.hoursWorked}h</span>
                              </div>
                              <div className="text-xs text-neutral-600 line-clamp-2">
                                {update.tasksCompleted && update.tasksCompleted.length > 0
                                  ? update.tasksCompleted[0]
                                  : update.notes || "No details"}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-neutral-400 text-xs">
                              -
                            </div>
                          )}
                        </td>
                      );
                    })}
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
