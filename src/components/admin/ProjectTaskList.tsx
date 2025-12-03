"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  LayoutGrid,
  List,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Clock,
  User,
  Flag,
  Trash2,
  Edit2,
  Save,
  ChevronDown,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TaskKind = "one-time" | "daily" | "weekly" | "monthly" | "recurring" | "custom";
type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
type ViewMode = "list" | "board";
type DisplayMode = "1" | "2" | "3" | "4";

interface Task {
  _id: string;
  projectId: string;
  projectName: string;
  section: string;
  title: string;
  description?: string;
  taskKind: TaskKind;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  assignees?: string[] | Array<{ _id: string; name: string; email: string }>; // Array of assigned employee IDs or objects
  assignedToName?: string;
  assignedDate?: string;
  assignedTime?: string;
  dueDate?: string;
  dueTime?: string;
  deadlineDate?: string;
  deadlineTime?: string;
  priority: number;
  bonusPoints?: number;
  penaltyPoints?: number;
  status: TaskStatus;
  completedAt?: string;
  completedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  order: number;
  assigneeNames?: string[]; // For display/grouping
  customFields?: Array<{
    name: string;
    type: "number" | "string" | "boolean" | "date";
    defaultValue?: any;
  }>;
  customFieldValues?: Record<string, any>;
  createdByEmployee?: boolean;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt?: string | Date; // Task creation date
}

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  leadAssignee?: any; // Can be ObjectId or populated object
  vaIncharge?: any; // Can be ObjectId or populated object
  updateIncharge?: any; // Can be ObjectId or populated object
}

interface Employee {
  _id: string;
  name: string;
  email?: string;
  fullName?: string;
  userId?: string;
}

export default function ProjectTaskList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [sections, setSections] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // Store all employees
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("1");
  const [showCompleted, setShowCompleted] = useState(false);
  const [grouping, setGrouping] = useState("none");
  const [sorting, setSorting] = useState("manual");
  const [dateFilter, setDateFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showSectionInput, setShowSectionInput] = useState(false);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);

  // Fetch projects
  useEffect(() => {
    fetchProjects();
    fetchEmployees();
  }, []);

  // Update employees when selected project changes
  useEffect(() => {
    if (allEmployees.length > 0 && selectedProject) {
      filterEmployeesByProject(allEmployees, selectedProject);
    } else if (allEmployees.length > 0 && !selectedProject) {
      // If no project selected, show all employees
      setEmployees(allEmployees);
    }
  }, [selectedProject, allEmployees]);

  // Fetch tasks when project is selected
  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Close display menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDisplayMenu && !target.closest('.display-menu-container')) {
        setShowDisplayMenu(false);
      }
    };

    if (showDisplayMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDisplayMenu]);

  // Filter employees to only show those assigned to the selected project
  const filterEmployeesByProject = (allEmps: Employee[], project: Project | null) => {
    if (!project) {
      setEmployees(allEmps);
      return;
    }

    // Get all assignee IDs from the project
    const assigneeIds = new Set<string>();
    
    // Helper to extract ID from assignee (could be ObjectId or populated object)
    const getAssigneeId = (assignee: any): string | null => {
      if (!assignee) return null;
      if (typeof assignee === 'string') return assignee;
      if (assignee._id) return assignee._id.toString();
      if (assignee instanceof Object) {
        // Try to get the ID from various possible formats
        const id = (assignee as any).toString();
        if (id && id !== '[object Object]') return id;
      }
      return null;
    };

    // Collect all assignee IDs
    const leadId = getAssigneeId(project.leadAssignee);
    const vaId = getAssigneeId(project.vaIncharge);
    const updateId = getAssigneeId(project.updateIncharge);

    if (leadId) assigneeIds.add(leadId);
    if (vaId) assigneeIds.add(vaId);
    if (updateId) assigneeIds.add(updateId);

    // Filter employees to only those assigned to the project
    const filtered = allEmps.filter((emp) => {
      // Check if employee's userId or _id matches any assignee
      const empId = emp.userId || emp._id;
      return assigneeIds.has(empId);
    });

    setEmployees(filtered);
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/admin/employees");
      const data = await response.json();
      if (response.ok) {
        // Map employeeProfiles to the expected format
        // Use userId (actual user ID) for assignment, not profile _id
        const mappedEmployees = (data.employees || []).map((emp: any) => ({
          _id: emp.userId ? emp.userId.toString() : emp._id.toString(), // Use userId for assignment
          name: emp.fullName || emp.name || "Unknown Employee",
          email: emp.email || "",
          fullName: emp.fullName,
          userId: emp.userId ? emp.userId.toString() : emp._id.toString(),
        }));
        setAllEmployees(mappedEmployees);
        // Filter employees based on selected project
        filterEmployeesByProject(mappedEmployees, selectedProject);
      } else {
        console.error("Error fetching employees:", data.error);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchTasks = async (projectId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tasks?projectId=${projectId}`);
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || {});
        setSections(data.sections || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find((p) => p._id === projectId);
    setSelectedProject(project || null);
    // Filter employees when project is selected
    filterEmployeesByProject(allEmployees, project || null);
  };

  const handleCreateTask = async (section: string) => {
    if (!selectedProjectId) return;

    // Set default assigned date and time to current date/time
    const now = new Date();
    const assignedDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const assignedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`; // HH:mm

    const newTask: Partial<Task> = {
      projectId: selectedProjectId,
      projectName: selectedProject?.projectName || "",
      section: section || "No Section",
      title: "New Task",
      taskKind: "one-time",
      priority: 2,
      status: "pending",
      bonusPoints: 0,
      penaltyPoints: 0,
      order: tasks[section]?.length || 0,
      assignedDate: assignedDate,
      assignedTime: assignedTime,
    };

    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      const data = await response.json();
      if (response.ok && data.task) {
        await fetchTasks(selectedProjectId);
        setEditingTask(data.task);
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      console.log("Updating task with data:", updates);
      console.log("Custom fields being sent:", updates.customFields);
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (response.ok) {
        console.log("Task updated successfully:", data);
        await fetchTasks(selectedProjectId!);
        setEditingTask(null);
      } else {
        console.error("Error updating task:", data);
        alert(data.error || "Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task. Please try again.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchTasks(selectedProjectId!);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleDeleteSection = async (section: string) => {
    const sectionTasks = tasks[section] || [];
    const taskCount = sectionTasks.length;
    
    if (taskCount === 0) {
      // Section is empty, just refresh
      await fetchTasks(selectedProjectId!);
      return;
    }

    const confirmMessage = `Are you sure you want to delete the section "${section}"?\n\nThis will delete ${taskCount} task${taskCount > 1 ? 's' : ''} in this section. This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      // Delete all tasks in the section
      const deletePromises = sectionTasks.map((task) =>
        fetch(`/api/admin/tasks/${task._id}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);
      await fetchTasks(selectedProjectId!);
    } catch (error) {
      console.error("Error deleting section:", error);
      alert("Error deleting section. Please try again.");
    }
  };

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    await handleUpdateTask(task._id, { status: newStatus });
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim() || !selectedProjectId) return;

    // Create a placeholder task in the new section to establish it
    // This ensures the section appears in the sections list
    const sectionName = newSectionName.trim();
    await handleCreateTask(sectionName);
    setNewSectionName("");
    setShowSectionInput(false);
    // Refresh to show the new section with its task
    await fetchTasks(selectedProjectId);
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "text-red-500";
    if (priority >= 5) return "text-orange-500";
    if (priority >= 3) return "text-yellow-500";
    return "text-neutral-400";
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isOverdue = (task: Task) => {
    if (task.status === "completed") return false;
    if (task.deadlineDate) {
      return new Date(task.deadlineDate) < new Date();
    }
    if (task.dueDate) {
      return new Date(task.dueDate) < new Date();
    }
    return false;
  };

  const filteredTasks = (sectionTasks: Task[]) => {
    // Always show all tasks, including completed ones (they'll just be ticked)
    let filtered = [...sectionTasks];

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter((t) => {
        if (!t.dueDate && !t.deadlineDate) return dateFilter === "no_date";
        const date = t.deadlineDate || t.dueDate;
        if (!date) return false;

        if (dateFilter === "today") {
          return new Date(date).toDateString() === now.toDateString();
        }
        if (dateFilter === "overdue") {
          return new Date(date) < now;
        }
        if (dateFilter === "upcoming") {
          return new Date(date) > now;
        }
        return true;
      });
    }

    // Apply priority filter
    if (priorityFilter !== "all") {
      const priorityNum = parseInt(priorityFilter);
      filtered = filtered.filter((t) => {
        if (priorityFilter === "high") return t.priority >= 7;
        if (priorityFilter === "medium") return t.priority >= 4 && t.priority < 7;
        if (priorityFilter === "low") return t.priority < 4;
        return t.priority === priorityNum;
      });
    }

    // Apply sorting
    if (sorting !== "manual") {
      filtered.sort((a, b) => {
        switch (sorting) {
          case "priority":
            return b.priority - a.priority; // Higher priority first
          case "due_date":
            const dateA = a.dueDate || a.deadlineDate || "";
            const dateB = b.dueDate || b.deadlineDate || "";
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          case "created":
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          case "title":
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
    }

    // Apply grouping
    if (grouping !== "none") {
      if (grouping === "assignee") {
        filtered.sort((a, b) => {
          const assigneeA = a.assignedToName || "";
          const assigneeB = b.assignedToName || "";
          return assigneeA.localeCompare(assigneeB);
        });
      } else if (grouping === "priority") {
        filtered.sort((a, b) => b.priority - a.priority);
      } else if (grouping === "due_date") {
        filtered.sort((a, b) => {
          const dateA = a.dueDate || a.deadlineDate || "";
          const dateB = b.dueDate || b.deadlineDate || "";
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
      }
      // "section" grouping is handled by the section structure itself
    }

    return filtered;
  };

  if (!selectedProjectId) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-neutral-900">Select a Project</h1>
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project._id}
                onClick={() => handleProjectSelect(project._id)}
                className="w-full text-left p-4 bg-white rounded-xl border border-neutral-200 hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="font-semibold text-neutral-900">{project.projectName}</div>
                <div className="text-sm text-neutral-500">{project.clientName}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header - Compact */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedProjectId(null)}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="text-xs text-neutral-500">My Projects /</div>
                <h1 className="text-base font-semibold text-neutral-900">{selectedProject?.projectName || "Loading..."}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 relative">
              <div className="relative display-menu-container">
                <button
                  onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg border border-neutral-200 transition-colors"
                >
                  <LayoutGrid className="w-4 h-4 text-neutral-600" />
                  <span className="text-sm text-neutral-700">Display: {displayMode}</span>
                  <ChevronDown className={`w-3 h-3 text-neutral-600 transition-transform ${showDisplayMenu ? "rotate-180" : ""}`} />
                </button>
                {showDisplayMenu && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg border border-neutral-200 shadow-lg z-50 display-menu-container max-h-[80vh] overflow-y-auto">
                    <div className="p-4 space-y-6">
                      {/* View Mode Selection */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <h3 className="font-semibold text-neutral-900">Layout</h3>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setViewMode("list");
                            }}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              viewMode === "list"
                                ? "bg-emerald-50 border border-emerald-300 text-emerald-700"
                                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-transparent"
                            }`}
                          >
                            List
                          </button>
                          <button
                            onClick={() => {
                              setViewMode("board");
                            }}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              viewMode === "board"
                                ? "bg-emerald-50 border border-emerald-300 text-emerald-700"
                                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-transparent"
                            }`}
                          >
                            Board
                          </button>
                        </div>
                      </div>

                      {/* Sort */}
                      <div>
                        <h3 className="font-semibold mb-3 text-neutral-900">Sort</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm text-neutral-600 mb-1 block">Grouping</label>
                            <select
                              value={grouping}
                              onChange={(e) => setGrouping(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            >
                              <option value="none">None</option>
                              <option value="section">Section</option>
                              <option value="assignee">Assignee</option>
                              <option value="priority">Priority</option>
                              <option value="due_date">Due Date</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm text-neutral-600 mb-1 block">Sorting</label>
                            <select
                              value={sorting}
                              onChange={(e) => setSorting(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            >
                              <option value="manual">Manual</option>
                              <option value="priority">Priority</option>
                              <option value="due_date">Due Date</option>
                              <option value="created">Created Date</option>
                              <option value="title">Title</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Filter */}
                      <div>
                        <h3 className="font-semibold mb-3 text-neutral-900">Filter</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm text-neutral-600 mb-1 block">Date</label>
                            <select
                              value={dateFilter}
                              onChange={(e) => setDateFilter(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            >
                              <option value="all">All</option>
                              <option value="today">Today</option>
                              <option value="overdue">Overdue</option>
                              <option value="upcoming">Upcoming</option>
                              <option value="no_date">No Date</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm text-neutral-600 mb-1 block">Priority</label>
                            <select
                              value={priorityFilter}
                              onChange={(e) => setPriorityFilter(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            >
                              <option value="all">All</option>
                              <option value="high">High (7-10)</option>
                              <option value="medium">Medium (4-6)</option>
                              <option value="low">Low (1-3)</option>
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                              <option value="5">5</option>
                              <option value="6">6</option>
                              <option value="7">7</option>
                              <option value="8">8</option>
                              <option value="9">9</option>
                              <option value="10">10</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Reset */}
                      <button
                        onClick={() => {
                          setGrouping("none");
                          setSorting("manual");
                          setDateFilter("all");
                          setPriorityFilter("all");
                        }}
                        className="w-full text-red-500 hover:text-red-600 text-sm font-medium transition-colors"
                      >
                        Reset all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="flex-1 p-2">
          {/* Render based on view mode */}
          {viewMode === "list" && (
            <>
              {/* List View - Sections */}
              {sections.map((section) => {
                const sectionTasks = tasks[section] || [];
                const filtered = filteredTasks(sectionTasks);
                const completedCount = sectionTasks.filter((t) => t.status === "completed").length;

                return (
                  <div key={section} className="mb-3">
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-2 group">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-neutral-700">
                          {section} {sectionTasks.length > 0 && `(${sectionTasks.length})`}
                        </h2>
                        {completedCount > 0 && (
                          <span className="text-xs text-neutral-500">
                            {completedCount} completed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSection(section)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-all"
                        title="Delete section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Section Tasks */}
                    <div className="space-y-1">
                      {filtered.map((task) => (
                        <TaskItem
                          key={task._id}
                          task={task}
                          employees={employees}
                          isEditing={editingTask?._id === task._id}
                          onEdit={() => setEditingTask(task)}
                          onSave={(updates) => handleUpdateTask(task._id, updates)}
                          onCancel={() => setEditingTask(null)}
                          onDelete={() => handleDeleteTask(task._id)}
                          onToggleComplete={() => handleToggleComplete(task)}
                          getPriorityColor={getPriorityColor}
                          formatDate={formatDate}
                          isOverdue={isOverdue(task)}
                        />
                      ))}

                      <button
                        onClick={() => handleCreateTask(section)}
                        className="w-full flex items-center gap-1.5 p-2 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs border border-dashed border-neutral-300 hover:border-emerald-300"
                      >
                        <Plus className="w-3 h-3" />
                        Add task
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {viewMode === "board" && (
            <div className="space-y-2">
              {/* Board View - Sections as Columns (Todoist Style) */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {sections.map((section) => {
                  const sectionTasks = tasks[section] || [];
                  // Apply filters and sorting to board view tasks
                  let filtered = filteredTasks(sectionTasks);
                  
                  // Apply grouping for board view if needed
                  if (grouping !== "none") {
                    // Grouping logic can be applied here
                    // For now, we'll keep tasks in their sections
                  }

                  return (
                    <div key={section} className="flex-shrink-0 w-72 bg-neutral-50 rounded-lg p-2 border border-neutral-200">
                      {/* Section Header */}
                      <div className="flex items-center justify-between mb-2 group">
                        <h3 className="text-sm font-semibold text-neutral-700">
                          {section} {sectionTasks.length > 0 && `(${sectionTasks.length})`}
                        </h3>
                        <button
                          onClick={() => handleDeleteSection(section)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-all"
                          title="Delete section"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Section Tasks */}
                      <div className="space-y-1 min-h-[150px]">
                        {filtered.map((task) => (
                          <div key={task._id} className={editingTask?._id === task._id ? "relative z-50" : ""}>
                            <TaskItem
                              task={task}
                              employees={employees}
                              isEditing={editingTask?._id === task._id}
                              onEdit={() => setEditingTask(task)}
                              onSave={(updates) => handleUpdateTask(task._id, updates)}
                              onCancel={() => setEditingTask(null)}
                              onDelete={() => handleDeleteTask(task._id)}
                              onToggleComplete={() => handleToggleComplete(task)}
                              getPriorityColor={getPriorityColor}
                              formatDate={formatDate}
                              isOverdue={isOverdue(task)}
                            />
                          </div>
                        ))}

                        <button
                          onClick={() => handleCreateTask(section)}
                          className="w-full flex items-center gap-1.5 p-2 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs border border-dashed border-neutral-300 hover:border-emerald-300"
                        >
                          <Plus className="w-3 h-3" />
                          Add task
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Section Button */}
                <div className="flex-shrink-0">
                  {showSectionInput ? (
                    <div className="w-72 p-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
                      <input
                        type="text"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateSection();
                          if (e.key === "Escape") {
                            setShowSectionInput(false);
                            setNewSectionName("");
                          }
                        }}
                        placeholder="Section name"
                        className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                        autoFocus
                      />
                      <div className="flex gap-1.5 mt-1.5">
                        <button
                          onClick={handleCreateSection}
                          className="px-3 py-1 gradient-emerald hover:opacity-90 rounded-lg text-xs font-medium text-white transition-all shadow-md"
                        >
                          Add section
                        </button>
                        <button
                          onClick={() => {
                            setShowSectionInput(false);
                            setNewSectionName("");
                          }}
                          className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs text-neutral-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSectionInput(true)}
                      className="w-72 flex items-center justify-center gap-1.5 p-3 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs border border-dashed border-neutral-300 hover:border-emerald-300 min-h-[80px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add section</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* Add Section - Only show in List view */}
          {viewMode === "list" && (
            <>
              {showSectionInput ? (
                <div className="mb-3 p-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateSection();
                      if (e.key === "Escape") {
                        setShowSectionInput(false);
                        setNewSectionName("");
                      }
                    }}
                    placeholder="Section name"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                    autoFocus
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={handleCreateSection}
                      className="px-3 py-1 gradient-emerald hover:opacity-90 rounded-lg text-xs font-medium text-white transition-all shadow-md"
                    >
                      Add section
                    </button>
                    <button
                      onClick={() => {
                        setShowSectionInput(false);
                        setNewSectionName("");
                      }}
                      className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs text-neutral-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSectionInput(true)}
                  className="w-full flex items-center gap-1.5 p-2 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs mb-3 border border-dashed border-neutral-300 hover:border-emerald-300"
                >
                  <Plus className="w-3 h-3" />
                  Add section
                </button>
              )}
            </>
          )}

          {loading && (
            <div className="text-center py-12 text-neutral-400">Loading tasks...</div>
          )}
        </div>

        {/* Right Sidebar - Removed, now in dropdown */}
      </div>
    </div>
  );
}

// Task Item Component
function TaskItem({
  task,
  employees,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onToggleComplete,
  getPriorityColor,
  formatDate,
  isOverdue,
}: {
  task: Task;
  employees: Employee[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<Task>) => void;
  onCancel: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  getPriorityColor: (priority: number) => string;
  formatDate: (date?: string) => string;
  isOverdue: boolean;
}) {
  // Set default assigned date and time if not already set
  const getDefaultAssignedDate = () => {
    if (task.assignedDate) return task.assignedDate;
    const now = new Date();
    return now.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const getDefaultAssignedTime = () => {
    if (task.assignedTime) return task.assignedTime;
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`; // HH:mm
  };

  const [formData, setFormData] = useState<Partial<Task>>({
    title: task.title,
    description: task.description,
    taskKind: task.taskKind,
    section: task.section,
    assignedTo: task.assignedTo || (task.assignees && task.assignees.length > 0 && typeof task.assignees[0] === 'object' ? task.assignees[0] as { _id: string; name: string; email: string } : undefined),
    assignees: task.assignees && task.assignees.length > 0
      ? [typeof task.assignees[0] === 'string' ? task.assignees[0] : task.assignees[0]._id] // Only take the first assignee, normalize to string
      : task.assignedTo?._id
      ? [task.assignedTo._id]
      : [],
    assignedDate: getDefaultAssignedDate(),
    assignedTime: getDefaultAssignedTime(),
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    deadlineDate: task.deadlineDate,
    deadlineTime: task.deadlineTime,
    priority: task.priority,
    bonusPoints: task.bonusPoints,
    penaltyPoints: task.penaltyPoints,
    customFields: task.customFields && Array.isArray(task.customFields) ? [...task.customFields] : [],
  });

  // Update formData when task changes (e.g., after save)
  useEffect(() => {
    if (task.customFields && Array.isArray(task.customFields)) {
      setFormData((prev) => ({
        ...prev,
        customFields: [...task.customFields!],
      }));
    }
  }, [task.customFields]);

  const handleSave = () => {
    // Ensure assignedDate and assignedTime have defaults if empty
    const now = new Date();
    const defaultDate = now.toISOString().split("T")[0];
    const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    
    // Ensure only one employee is assigned
    const assignees = formData.assignedTo ? [formData.assignedTo] : [];
    
    // Filter out custom fields without names (only keep valid fields) and preserve defaultValue
    const validCustomFields = (formData.customFields || [])
      .filter((field) => field.name && field.name.trim() !== "")
      .map((field) => ({
        name: field.name.trim(),
        type: field.type,
        defaultValue: field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== "" 
          ? field.defaultValue 
          : undefined,
      }));
    
    const dataToSave = {
      ...formData,
      assignedDate: formData.assignedDate || defaultDate,
      assignedTime: formData.assignedTime || defaultTime,
      assignedTo: formData.assignedTo,
      assignees: assignees, // Only one employee allowed
      customFields: validCustomFields.length > 0 ? validCustomFields : undefined,
    };
    
    console.log("Saving task with customFields:", dataToSave.customFields);
    onSave(dataToSave);
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-lg p-3 space-y-3 w-full min-w-0 z-50 relative">
        <input
          type="text"
          value={formData.title || ""}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          placeholder="Task title"
        />

        <textarea
          value={formData.description || ""}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-2 text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 resize-none"
          placeholder="Description (optional)"
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Task Kind</label>
            <select
              value={formData.taskKind || "one-time"}
              onChange={(e) => setFormData({ ...formData, taskKind: e.target.value as TaskKind })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="one-time">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="recurring">Recurring</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Priority</label>
            <select
              value={formData.priority || 2}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Assigned To</label>
            <select
              value={formData.assignedTo?._id || (formData.assignees?.[0] && typeof formData.assignees[0] === 'string' ? formData.assignees[0] : typeof formData.assignees?.[0] === 'object' ? formData.assignees[0]._id : '') || ""}
              onChange={(e) => {
                const selectedEmployeeId = e.target.value;
                const selectedEmployee = employees.find(emp => emp._id === selectedEmployeeId);
                setFormData({
                  ...formData,
                  assignedTo: selectedEmployee ? {
                    _id: selectedEmployee._id,
                    name: selectedEmployee.name,
                    email: selectedEmployee.email || ''
                  } : undefined,
                  assignees: selectedEmployeeId ? [selectedEmployeeId] : [],
                });
              }}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">No employee assigned</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Section</label>
            <input
              type="text"
              value={formData.section || ""}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Assigned Date</label>
            <input
              type="date"
              value={formData.assignedDate ? new Date(formData.assignedDate).toISOString().split("T")[0] : ""}
              onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value || undefined })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Assigned Time</label>
            <input
              type="time"
              value={formData.assignedTime || ""}
              onChange={(e) => setFormData({ ...formData, assignedTime: e.target.value || undefined })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Due Date</label>
            <input
              type="date"
              value={formData.dueDate ? new Date(formData.dueDate).toISOString().split("T")[0] : ""}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Due Time</label>
            <input
              type="time"
              value={formData.dueTime || ""}
              onChange={(e) => setFormData({ ...formData, dueTime: e.target.value || undefined })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Deadline Date</label>
            <input
              type="date"
              value={formData.deadlineDate ? new Date(formData.deadlineDate).toISOString().split("T")[0] : ""}
              onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value || undefined })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Deadline Time</label>
            <input
              type="time"
              value={formData.deadlineTime || ""}
              onChange={(e) => setFormData({ ...formData, deadlineTime: e.target.value || undefined })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Bonus Points</label>
            <input
              type="number"
              min="0"
              value={formData.bonusPoints || 0}
              onChange={(e) => setFormData({ ...formData, bonusPoints: parseInt(e.target.value) || 0 })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-600 mb-1 block">Penalty Points</label>
            <input
              type="number"
              min="0"
              value={formData.penaltyPoints || 0}
              onChange={(e) => setFormData({ ...formData, penaltyPoints: parseInt(e.target.value) || 0 })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>
        </div>

        {/* Custom Fields Section */}
        <div className="border-t border-neutral-200 pt-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Custom Fields
            </label>
            <button
              type="button"
              onClick={() => {
                const newFields = [...(formData.customFields || []), { name: "", type: "string" as const, defaultValue: "" }];
                setFormData({ ...formData, customFields: newFields });
              }}
              className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {formData.customFields?.map((field, index) => {
              // Render appropriate input based on type
              const renderValueInput = () => {
                switch (field.type) {
                  case "number":
                    return (
                      <input
                        type="number"
                        step="any"
                        placeholder="Value"
                        value={field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== "" ? String(field.defaultValue) : ""}
                        onChange={(e) => {
                          const newFields = [...(formData.customFields || [])];
                          const inputValue = e.target.value;
                          const numValue = inputValue === "" ? "" : (inputValue ? Number(inputValue) : "");
                          newFields[index] = { ...field, defaultValue: numValue };
                          setFormData({ ...formData, customFields: newFields });
                        }}
                        className="w-full bg-white border border-neutral-300 rounded-lg px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                      />
                    );
                  case "boolean":
                    return (
                      <select
                        value={field.defaultValue === true ? "true" : field.defaultValue === false ? "false" : ""}
                        onChange={(e) => {
                          const newFields = [...(formData.customFields || [])];
                          newFields[index] = { 
                            ...field, 
                            defaultValue: e.target.value === "true" ? true : e.target.value === "false" ? false : undefined 
                          };
                          setFormData({ ...formData, customFields: newFields });
                        }}
                        className="w-full bg-white border border-neutral-300 rounded-lg px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                      >
                        <option value="">Select...</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    );
                  case "date":
                    let dateValue = "";
                    if (field.defaultValue) {
                      if (typeof field.defaultValue === "string") {
                        dateValue = field.defaultValue;
                      } else if (field.defaultValue instanceof Date) {
                        dateValue = field.defaultValue.toISOString().split("T")[0];
                      } else {
                        try {
                          dateValue = new Date(field.defaultValue).toISOString().split("T")[0];
                        } catch (e) {
                          dateValue = "";
                        }
                      }
                    }
                    return (
                      <input
                        type="date"
                        value={dateValue}
                        onChange={(e) => {
                          const newFields = [...(formData.customFields || [])];
                          newFields[index] = { ...field, defaultValue: e.target.value || "" };
                          setFormData({ ...formData, customFields: newFields });
                        }}
                        className="w-full bg-white border border-neutral-300 rounded-lg px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                      />
                    );
                  case "string":
                  default:
                    return (
                      <input
                        type="text"
                        placeholder="Value"
                        value={field.defaultValue !== undefined && field.defaultValue !== null ? String(field.defaultValue) : ""}
                        onChange={(e) => {
                          const newFields = [...(formData.customFields || [])];
                          newFields[index] = { ...field, defaultValue: e.target.value };
                          setFormData({ ...formData, customFields: newFields });
                        }}
                        onKeyDown={(e) => {
                          // Prevent form submission on Enter
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                        className="w-full bg-white border border-neutral-300 rounded-lg px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                      />
                    );
                }
              };

              return (
                <div key={index} className="flex gap-1.5 items-center p-1.5 bg-neutral-50 rounded border border-neutral-200">
                  <input
                    type="text"
                    placeholder="Name"
                    value={field.name}
                    onChange={(e) => {
                      const newFields = [...(formData.customFields || [])];
                      newFields[index] = { ...field, name: e.target.value };
                      setFormData({ ...formData, customFields: newFields });
                    }}
                    className="flex-1 min-w-0 bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const newFields = [...(formData.customFields || [])];
                      const newType = e.target.value as "number" | "string" | "boolean" | "date";
                      // Only reset defaultValue if type actually changed and it's incompatible
                      const currentValue = field.defaultValue;
                      let newValue = currentValue;
                      
                      // Reset only if type change makes value incompatible
                      if (newType === "boolean" && typeof currentValue !== "boolean" && currentValue !== true && currentValue !== false && currentValue !== "" && currentValue !== undefined) {
                        newValue = undefined;
                      } else if (newType === "number" && currentValue !== "" && currentValue !== null && currentValue !== undefined && isNaN(Number(currentValue))) {
                        newValue = undefined;
                      } else if (newType === "date" && currentValue && !(currentValue instanceof Date) && typeof currentValue !== "string" && currentValue !== "") {
                        newValue = undefined;
                      }
                      
                      newFields[index] = { ...field, type: newType, defaultValue: newValue };
                      setFormData({ ...formData, customFields: newFields });
                    }}
                    className="w-18 bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                  >
                    <option value="string">Str</option>
                    <option value="number">Num</option>
                    <option value="boolean">Bool</option>
                    <option value="date">Date</option>
                  </select>
                  <div className="flex-1 min-w-[70px]">
                    {renderValueInput()}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newFields = formData.customFields?.filter((_, i) => i !== index) || [];
                      setFormData({ ...formData, customFields: newFields });
                    }}
                    className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {(!formData.customFields || formData.customFields.length === 0) && (
              <p className="text-xs text-neutral-500 italic text-center py-1">
                No custom fields. Click "Add" to create one.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 gradient-emerald hover:opacity-90 rounded-lg text-sm font-medium text-white transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-sm text-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 p-2 rounded-lg bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-sm transition-all group ${
        task.status === "completed" ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={onToggleComplete}
        className="mt-0.5 flex-shrink-0"
      >
        {task.status === "completed" ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <Circle className="w-4 h-4 text-neutral-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`text-sm ${task.status === "completed" ? "line-through text-neutral-400" : "text-neutral-900"}`}>
            {task.title}
          </span>
          {task.priority > 0 && (
            <Flag className={`w-3 h-3 ${getPriorityColor(task.priority)}`} />
          )}
          {/* Show all assigned employees - check assignees array first (multi-assign), then fallback to assignedTo */}
          {(() => {
            const assignedNames: string[] = [];
            const assignedIds: string[] = [];
            
            // Get names from assignees array (multi-assign) - these are populated objects
            if (Array.isArray(task.assignees) && task.assignees.length > 0) {
              task.assignees.forEach((assignee: any) => {
                if (typeof assignee === 'object' && assignee.name) {
                  if (!assignedNames.includes(assignee.name)) {
                    assignedNames.push(assignee.name);
                    if (assignee._id) assignedIds.push(assignee._id);
                  }
                }
              });
            }
            
            // Also check assigneeNames array (backup)
            if (task.assigneeNames && Array.isArray(task.assigneeNames) && task.assigneeNames.length > 0) {
              task.assigneeNames.forEach((name: string) => {
                if (!assignedNames.includes(name)) {
                  assignedNames.push(name);
                }
              });
            }
            
            // Fallback to assignedTo if no assignees found
            if (assignedNames.length === 0 && task.assignedTo) {
              assignedNames.push(task.assignedTo.name);
              if (task.assignedTo._id) assignedIds.push(task.assignedTo._id);
            }
            
            // Check if employee assigned task to themselves
            const isSelfAssigned = task.createdByEmployee && task.createdBy && 
              (assignedIds.includes(task.createdBy._id) || 
               (task.assignedTo && task.assignedTo._id === task.createdBy._id) ||
               (assignedNames.length === 1 && assignedNames[0] === task.createdBy.name));
            
            // Display all assigned employee names
            return assignedNames.length > 0 ? (
              <>
                {assignedNames.map((name, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium flex items-center gap-1">
                    <User className="w-2.5 h-2.5" />
                    {name}
                  </span>
                ))}
                {isSelfAssigned && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-medium italic">
                    (Self-assigned)
                  </span>
                )}
              </>
            ) : (
              <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded text-[10px] font-medium italic">
                Unassigned
              </span>
            );
          })()}
          {task.createdByEmployee && task.createdBy && (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
              Created by {task.createdBy.name}
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-neutral-600 mb-1 line-clamp-1">{task.description}</p>
        )}

        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          {task.dueDate && (
            <div className={`flex items-center gap-0.5 ${isOverdue ? "text-red-500" : ""}`}>
              <Clock className="w-2.5 h-2.5" />
              <span>{formatDate(task.dueDate)}</span>
            </div>
          )}
          {(task.bonusPoints || 0) > 0 && (
            <span className="text-emerald-600 font-medium">+{task.bonusPoints}</span>
          )}
          {(task.penaltyPoints || 0) > 0 && (
            <span className="text-red-500 font-medium">-{task.penaltyPoints}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={onEdit}
          className="p-0.5 hover:bg-neutral-100 rounded transition-all"
          title="Edit task"
        >
          <Edit2 className="w-3 h-3 text-neutral-500" />
        </button>
        <button
          onClick={onDelete}
          className="p-0.5 hover:bg-red-50 rounded transition-all"
          title="Delete task"
        >
          <Trash2 className="w-3 h-3 text-red-500" />
        </button>
      </div>
    </div>
  );
}


