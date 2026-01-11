"use client";

import {useState, useEffect, Fragment} from "react";
import {Eye, Calendar, Tag, Users, Search, RefreshCw, TrendingUp, Plus, ChevronDown, Check, Clock} from "lucide-react";
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
  const [todayDailyUpdates, setTodayDailyUpdates] = useState<Record<string, {
    hoursWorked: number;
    progress: number;
    tasksCompleted?: string[];
    notes?: string;
    challenges?: string;
    nextSteps?: string;
    date: string;
  } | null>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const statusOptions = [
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
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "client_meeting_done":
        return "bg-blue-100 text-blue-800";
      case "contact_made":
        return "bg-purple-100 text-purple-800";
      case "active":
        return "bg-emerald-100 text-emerald-800";
      case "recontacted":
        return "bg-indigo-100 text-indigo-800";
      case "stalled":
        return "bg-orange-100 text-orange-800";
      case "requirements_sent":
        return "bg-cyan-100 text-cyan-800";
      case "waiting_for_requirement":
        return "bg-yellow-100 text-yellow-800";
      case "awaiting_testimonial":
        return "bg-pink-100 text-pink-800";
      case "training":
        return "bg-violet-100 text-violet-800";
      case "pending_assignment":
        return "bg-amber-100 text-amber-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
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

  const handleStatusUpdate = async (projectId: string, newStatus: string) => {
    setUpdatingStatus(projectId);
    try {
      const response = await fetch("/api/admin/update-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          status: newStatus,
        }),
      });

      if (response.ok) {
        // Refresh the projects list
        onRefresh();
        setStatusDropdownOpen(null);
      } else {
        const data = await response.json();
        alert("Failed to update status: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.status-dropdown-container')) {
          setStatusDropdownOpen(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusDropdownOpen]);

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

  const fetchTodayDailyUpdates = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use local date string to avoid timezone issues
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      // Fetch project daily updates for last 7 days (matching ProjectDailyUpdatesTable default)
      // This ensures we get recent updates even if there are timezone issues
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const year = sevenDaysAgo.getFullYear();
      const month = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
      const day = String(sevenDaysAgo.getDate()).padStart(2, '0');
      const sevenDaysAgoStr = `${year}-${month}-${day}`;
      
      const url = `/api/admin/project-daily-updates?startDate=${sevenDaysAgoStr}&endDate=${todayStr}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const projectsWithUpdates = data.projects || [];

      const updatesMap: Record<string, {
        hoursWorked: number;
        progress: number;
        tasksCompleted?: string[];
        notes?: string;
        challenges?: string;
        nextSteps?: string;
        date: string;
      } | null> = {};

      // For each project, find today's update from the lead assignee
      projects.forEach((project) => {
        // Try to match project by ID (handle both string and ObjectId formats)
        const projectData = projectsWithUpdates.find((p: any) => {
          const pId = String(p._id || "");
          const projId = String(project._id || "");
          const matchById = pId === projId;
          const matchByName = p.projectName === project.projectName;
          return matchById || matchByName;
        });

        if (!projectData) {
          updatesMap[project._id] = null;
          return;
        }

        // Get lead assignee IDs - use same logic as ProjectDailyUpdatesTable
        const leadAssigneeIds: string[] = [];
        
        // Check projectData.leadAssignees first (from API response) - this is what ProjectDailyUpdatesTable uses
        if (projectData.leadAssignees && Array.isArray(projectData.leadAssignees)) {
          projectData.leadAssignees.forEach((lead: any) => {
            if (lead?._id) {
              leadAssigneeIds.push(String(lead._id));
            }
          });
        }
        
        // Also check project.leadAssignee (from props) as fallback
        if (leadAssigneeIds.length === 0 && project.leadAssignee) {
          if (Array.isArray(project.leadAssignee)) {
            project.leadAssignee.forEach((lead: any) => {
              const id = lead?._id || lead;
              if (id) {
                leadAssigneeIds.push(String(id));
              }
            });
          } else {
            const id = project.leadAssignee?._id || project.leadAssignee;
            if (id) {
              leadAssigneeIds.push(String(id));
            }
          }
        }

        if (leadAssigneeIds.length === 0) {
          updatesMap[project._id] = null;
          return;
        }

        if (!projectData.updates || projectData.updates.length === 0) {
          updatesMap[project._id] = null;
          return;
        }

        // Find today's update from any lead assignee - use same date comparison as ProjectDailyUpdatesTable
        const todayDateStr = today.toDateString();
        
        // Also create a date string in YYYY-MM-DD format for comparison
        const todayYear = today.getFullYear();
        const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
        const todayDay = String(today.getDate()).padStart(2, '0');
        const todayDateStrISO = `${todayYear}-${todayMonth}-${todayDay}`;
        
        // First, try to find today's update
        let todayUpdate = projectData.updates.find((update: any) => {
          // Use same date comparison as ProjectDailyUpdatesTable (toDateString())
          const updateDate = new Date(update.date);
          const updateDateStr = updateDate.toDateString();
          const updateDateISO = updateDate.toISOString().split('T')[0];
          
          // Try both comparison methods
          const isTodayByString = updateDateStr === todayDateStr;
          const isTodayByISO = updateDateISO === todayDateStrISO;
          const isToday = isTodayByString || isTodayByISO;
          
          // Use same employeeId comparison as ProjectDailyUpdatesTable (direct string comparison)
          const updateEmployeeId = String(update.employeeId || "");
          const isLeadAssignee = leadAssigneeIds.some(leadId => 
            String(leadId) === updateEmployeeId
          );
          
          return isToday && isLeadAssignee;
        });
        
        // If no today's update found, get the most recent update from a lead assignee
        // This matches the behavior of ProjectDailyUpdatesTable which shows recent updates
        if (!todayUpdate) {
          const leadAssigneeUpdates = projectData.updates
            .filter((update: any) => {
              const updateEmployeeId = String(update.employeeId || "");
              return leadAssigneeIds.some(leadId => String(leadId) === updateEmployeeId);
            })
            .sort((a: any, b: any) => {
              const dateA = new Date(a.date).getTime();
              const dateB = new Date(b.date).getTime();
              return dateB - dateA; // Most recent first
            });
          
          if (leadAssigneeUpdates.length > 0) {
            const mostRecent = leadAssigneeUpdates[0];
            const mostRecentDate = new Date(mostRecent.date);
            
            // Show most recent update if it's from the last 7 days (matching ProjectDailyUpdatesTable default range)
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            if (mostRecentDate >= sevenDaysAgo) {
              todayUpdate = mostRecent;
            }
          }
        }

        if (todayUpdate) {
          // Store the full update object to match ProjectDailyUpdatesTable format
          updatesMap[project._id] = {
            hoursWorked: todayUpdate.hoursWorked || 0,
            progress: todayUpdate.progress || 0,
            tasksCompleted: todayUpdate.tasksCompleted || [],
            notes: todayUpdate.notes || "",
            challenges: todayUpdate.challenges || "",
            nextSteps: todayUpdate.nextSteps || "",
            date: todayUpdate.date || "",
          };
        } else {
          updatesMap[project._id] = null;
        }
      });

      setTodayDailyUpdates(updatesMap);
    } catch (error) {
      console.error("Error fetching today's daily updates:", error);
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      // Fetch today's daily updates for lead assignees
      fetchTodayDailyUpdates();
    }
  }, [projects]);

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
            onClick={() => {
              onRefresh();
              fetchTodayDailyUpdates();
            }}
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
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider min-w-[300px]">
                  Today's Daily Update
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
                  <td colSpan={11} className="px-6 py-16 text-center">
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
                        <td className="px-6 py-4 w-48">
                          <div className="relative status-dropdown-container">
                            <button
                              onClick={() => setStatusDropdownOpen(
                                statusDropdownOpen === project._id ? null : project._id
                              )}
                              disabled={updatingStatus === project._id}
                              className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap w-full ${getStatusColor(
                                project.status
                              )} hover:opacity-80 transition-opacity disabled:opacity-50`}
                            >
                              <span>{project.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            {statusDropdownOpen === project._id && (
                              <div className="absolute z-50 mt-1 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                {statusOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => handleStatusUpdate(project._id, option.value)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 flex items-center justify-between transition-colors"
                                  >
                                    <span>{option.label}</span>
                                    {project.status === option.value && (
                                      <Check className="w-4 h-4 text-emerald-600" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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
                          {(() => {
                            const leadAssignee = project.leadAssignee;
                            if (!leadAssignee) return <span className="text-sm text-neutral-400">Not assigned</span>;
                            
                            if (Array.isArray(leadAssignee)) {
                              if (leadAssignee.length === 0) return <span className="text-sm text-neutral-400">Not assigned</span>;
                              const names = leadAssignee.map(lead => lead?.name || 'Unknown').join(', ');
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <Users className="w-3 h-3 text-emerald-600" />
                                  </div>
                                  <span className="text-sm text-neutral-700 truncate max-w-[120px] font-medium" title={names}>
                                    {names}
                                  </span>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                  <Users className="w-3 h-3 text-emerald-600" />
                                </div>
                                <span className="text-sm text-neutral-700 truncate max-w-[120px] font-medium">
                                  {leadAssignee.name}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            if (!project.vaIncharge) {
                              return <span className="text-sm text-neutral-400">Not assigned</span>;
                            }
                            const vaList = Array.isArray(project.vaIncharge) ? project.vaIncharge : [project.vaIncharge];
                            if (vaList.length === 0) {
                              return <span className="text-sm text-neutral-400">Not assigned</span>;
                            }
                            return (
                              <div className="flex flex-col gap-1">
                                {vaList.map((va: any, idx: number) => {
                                  const vaName = typeof va === 'object' ? va.name : va;
                                  return (
                                    <div key={idx} className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Users className="w-3 h-3 text-blue-600" />
                                      </div>
                                      <span className="text-sm text-neutral-700 truncate max-w-[120px] font-medium">
                                        {vaName || 'VA Incharge'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
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
                        <td className="px-6 py-4 min-w-[300px]">
                          {(() => {
                            const update = todayDailyUpdates[project._id];
                            return update ? (
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
                              
                              {update.nextSteps && (
                                <div className="text-xs text-neutral-600 line-clamp-1">
                                  <span className="font-medium">Next Steps:</span> {update.nextSteps}
                                </div>
                              )}
                            </div>
                            ) : (
                              <span className="text-sm text-neutral-400">-</span>
                            );
                          })()}
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
                          <td colSpan={11} className="px-6 py-6 bg-neutral-50 border-t border-neutral-200">
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

