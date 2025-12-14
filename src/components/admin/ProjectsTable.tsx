"use client";

import {useState, useEffect, Fragment} from "react";
import {Eye, Calendar, Tag, Users, Search, RefreshCw, TrendingUp, Plus} from "lucide-react";
import {motion} from "framer-motion";
import CreateProjectModal from "./CreateProjectModal";

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  description: string;
  deadline: string;
  status: string;
  priority: string;
  tags: string[];
  leadAssignee?: any;
  vaIncharge?: any;
  assignees?: any[];
  startDate?: string;
  budget?: string;
  clientProgress?: number;
  createdAt?: string;
}

interface ProjectUpdate {
  _id: string;
  employeeId: {
    name: string;
    email: string;
  };
  date: string;
  hoursWorked: number;
  status: string;
}

interface ProjectsTableProps {
  projects: Project[];
  onViewDetails: (projectId: string) => void;
  onAssign?: (project: Project) => void;
  onRefresh: () => void;
}

export default function ProjectsTable({
  projects,
  onViewDetails,
  onAssign,
  onRefresh
}: ProjectsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectUpdates, setProjectUpdates] = useState<Record<string, ProjectUpdate[]>>({});
  const [loadingUpdates, setLoadingUpdates] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_assignment":
        return "bg-amber-100 text-amber-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "on_hold":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
      case "high":
        return "text-red-600 font-semibold";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const fetchProjectUpdates = async (projectId: string) => {
    if (projectUpdates[projectId]) return; // Already fetched

    setLoadingUpdates((prev) => new Set(prev).add(projectId));
    try {
      const response = await fetch(`/api/admin/project-updates/${projectId}`);
      const data = await response.json();
      if (response.ok && data.updates) {
        // Ensure employeeId is properly formatted
        const formattedUpdates = data.updates.map((update: any) => ({
          ...update,
          employeeId: update.employeeId || {
            name: update.employeeName || "Unknown",
            email: ""
          }
        }));
        setProjectUpdates((prev) => ({
          ...prev,
          [projectId]: formattedUpdates
        }));
      } else {
        // If no updates found, set empty array
        setProjectUpdates((prev) => ({
          ...prev,
          [projectId]: []
        }));
      }
    } catch (error) {
      console.error("Error fetching project updates:", error);
      setProjectUpdates((prev) => ({
        ...prev,
        [projectId]: []
      }));
    } finally {
      setLoadingUpdates((prev) => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  const toggleProjectExpansion = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
        fetchProjectUpdates(projectId);
      }
      return newSet;
    });
  };

  const filteredProjects = projects.filter((project) =>
    project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects by name or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white/80 backdrop-blur-sm text-gray-900 placeholder-gray-500"
          />
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{scale: 1.05}}
            whileTap={{scale: 0.95}}
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </motion.button>
          <motion.button
            whileHover={{scale: 1.05}}
            whileTap={{scale: 0.95}}
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </motion.button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1800px]">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Project Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider w-40">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Lead Assignee
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  VA Incharge
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Assignees
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Updates
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-100">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
                        <Search className="w-8 h-8 text-neutral-400" />
                      </div>
                      <p className="text-lg font-medium text-neutral-900">
                        {searchTerm ? "No projects found" : "No projects yet"}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {searchTerm ? "Try adjusting your search terms" : "Create your first project to get started"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                  const isExpanded = expandedProjects.has(project._id);
                  const updates = projectUpdates[project._id] || [];
                  const isLoading = loadingUpdates.has(project._id);
                  const hasFetched = projectUpdates.hasOwnProperty(project._id);

                  return (
                    <Fragment key={project._id}>
                      <tr className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-neutral-900">
                            {project.projectName}
                          </div>
                          {project.description && (
                            <div className="text-xs text-neutral-500 mt-1 line-clamp-1">
                              {project.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-neutral-900">
                            {project.clientName}
                          </span>
                        </td>
                        <td className="px-6 py-4 w-40">
                          <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${getStatusColor(
                              project.status
                            )}`}
                          >
                            {project.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-medium ${getPriorityColor(project.priority)}`}>
                            {project.priority.charAt(0).toUpperCase() +
                              project.priority.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-neutral-600">
                            <Calendar className="w-4 h-4 text-neutral-400" />
                            {new Date(project.deadline).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {project.leadAssignee?.name ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Users className="w-3 h-3 text-emerald-600" />
                              </div>
                              <span className="text-sm text-neutral-700 truncate max-w-[120px] font-medium">
                                {project.leadAssignee.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400">Not assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {project.vaIncharge?.name || (typeof project.vaIncharge === 'string' && project.vaIncharge) ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                <Users className="w-3 h-3 text-blue-600" />
                              </div>
                              <span className="text-sm text-neutral-700 truncate max-w-[120px] font-medium">
                                {project.vaIncharge?.name || project.vaIncharge}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400">Not assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {project.assignees && Array.isArray(project.assignees) && project.assignees.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                                <Users className="w-3 h-3 text-purple-600" />
                              </div>
                              <span className="text-sm text-neutral-700 truncate max-w-[120px] font-medium">
                                {project.assignees.length} {project.assignees.length === 1 ? 'assignee' : 'assignees'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400">No assignees</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {project.clientProgress !== undefined ? (
                            <div className="flex items-center gap-3 min-w-[120px]">
                              <div className="flex-1 bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-300"
                                  style={{width: `${project.clientProgress}%`}}
                                />
                              </div>
                              <span className="text-xs font-semibold text-neutral-700 w-10 text-right">
                                {project.clientProgress}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleProjectExpansion(project._id)}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            {isExpanded ? "Hide" : "Show"} (
                            {hasFetched ? updates.length : isLoading ? "..." : "?"}
                            )
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {project.tags && project.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {project.tags.slice(0, 2).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-medium border border-emerald-100"
                                >
                                  {tag}
                                </span>
                              ))}
                              {project.tags.length > 2 && (
                                <span className="text-xs text-neutral-500 font-medium">
                                  +{project.tags.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400">No tags</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {(!project.leadAssignee || project.status === "pending_assignment") && onAssign && (
                              <button
                                onClick={() => onAssign(project)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                              >
                                Assign
                              </button>
                            )}
                            <button
                              onClick={() => onViewDetails(project._id)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-sm hover:shadow-md"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row for daily updates */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={12} className="px-6 py-6 bg-neutral-50 border-t border-neutral-200">
                            <div className="space-y-4">
                              <h4 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                Daily Updates for this Project
                              </h4>
                              {isLoading ? (
                                <div className="text-center py-8">
                                  <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                  <p className="mt-3 text-sm text-neutral-500">Loading updates...</p>
                                </div>
                              ) : updates.length === 0 ? (
                                <div className="text-center py-8 bg-neutral-100 rounded-xl">
                                  <p className="text-sm text-neutral-500">No daily updates found for this project</p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                                  <table className="w-full text-sm">
                                    <thead className="bg-neutral-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                          Employee
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                          Date
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                          Hours Worked
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {updates.map((update) => (
                                        <tr key={update._id} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 text-gray-900">
                                            {update.employeeId?.name || "Unknown"}
                                          </td>
                                          <td className="px-3 py-2 text-gray-600">
                                            {new Date(update.date).toLocaleDateString()}
                                          </td>
                                          <td className="px-3 py-2 text-gray-600">
                                            {update.hoursWorked || 0}h
                                          </td>
                                          <td className="px-3 py-2">
                                            <span
                                              className={`px-2 py-1 rounded text-xs ${
                                                update.status === "approved"
                                                  ? "bg-green-100 text-green-800"
                                                  : update.status === "reviewed"
                                                  ? "bg-blue-100 text-blue-800"
                                                  : "bg-yellow-100 text-yellow-800"
                                              }`}
                                            >
                                              {update.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

