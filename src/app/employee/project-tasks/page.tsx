"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  LayoutGrid,
  List,
  CheckCircle2,
  Circle,
  Clock,
  User,
  Flag,
  ChevronDown,
  Bell,
  Plus,
  X,
  Save,
  Edit2,
} from "lucide-react";
import { motion } from "framer-motion";

type TaskKind = "one-time" | "daily" | "weekly" | "monthly" | "recurring" | "custom";
type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
type ViewMode = "list" | "board";

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
  assignees?: {
    _id: string;
    name: string;
    email: string;
  }[];
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
  isNew?: boolean; // For notification purposes
  canTick?: boolean; // Whether employee can tick this task
  createdByEmployee?: boolean; // Whether task was created by an employee
  createdAt?: string | Date; // Task creation date
}

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
}

function EmployeeProjectTasksContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Record<string, Task[]>>({});
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [grouping, setGrouping] = useState("none");
  const [sorting, setSorting] = useState("manual");
  const [dateFilter, setDateFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [hasNewTasks, setHasNewTasks] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingTask, setCreatingTask] = useState<string | null>(null); // section name
  const [newSectionName, setNewSectionName] = useState("");
  const [showSectionInput, setShowSectionInput] = useState(false);

  // Fetch project details
  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchTasks(projectId);
      // Check for new tasks every 30 seconds
      const interval = setInterval(() => {
        checkForNewTasks(projectId);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [projectId]);

  // Check for new tasks on mount
  useEffect(() => {
    if (projectId) {
      const lastChecked = localStorage.getItem(`lastChecked_${projectId}`);
      if (lastChecked) {
        setLastCheckedAt(new Date(lastChecked));
      }
      checkForNewTasks(projectId);
    }
  }, [projectId]);

  const fetchProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (response.ok && data.project) {
        setSelectedProject({
          _id: data.project._id,
          projectName: data.project.projectName,
          clientName: data.project.clientName || "",
        });
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  };

  const fetchTasks = async (projectId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/employee/tasks?projectId=${projectId}`);
      const data = await response.json();
      if (response.ok) {
        // Tasks are already filtered by the API endpoint to show only assigned tasks
        setTasks(data.tasks || {});
        setSections(data.sections || []);
        // Mark tasks as checked
        if (projectId) {
          localStorage.setItem(`lastChecked_${projectId}`, new Date().toISOString());
          setLastCheckedAt(new Date());
        }
        setHasNewTasks(false);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkForNewTasks = async (projectId: string) => {
    try {
      const response = await fetch(`/api/employee/tasks?projectId=${projectId}`);
      const data = await response.json();
      if (response.ok) {
        const lastChecked = localStorage.getItem(`lastChecked_${projectId}`);
        const userId = (session?.user as any)?.id;
        
        if (lastChecked) {
          const lastCheckedDate = new Date(lastChecked);
          // Check if any task assigned to current user was created after last check
          const allTasks = Object.values(data.tasks || {}).flat() as Task[];
          const newTasks = allTasks.filter((task: any) => {
            // Only check tasks assigned to current user (single or multiple)
            const userIdStr = userId?.toString();
            if (!userIdStr) return false;

            let isAssigned = false;
            if (task.assignedTo) {
              let assignedToId: string | null = null;
              if (typeof task.assignedTo === 'string') {
                assignedToId = task.assignedTo;
              } else if (task.assignedTo && typeof task.assignedTo === 'object') {
                assignedToId = task.assignedTo._id || task.assignedTo.toString();
              }
              if (assignedToId && assignedToId.toString() === userIdStr) {
                isAssigned = true;
              }
            }

            if (!isAssigned && Array.isArray(task.assignees)) {
              isAssigned = task.assignees.some((assignee: any) => {
                if (!assignee) return false;
                if (typeof assignee === 'string') return assignee === userIdStr;
                if (assignee._id) return assignee._id.toString() === userIdStr;
                if (assignee.toString) return assignee.toString() === userIdStr;
                return false;
              });
            }

            if (!isAssigned) return false;
            const taskCreatedAt = new Date(task.createdAt || 0);
            return taskCreatedAt > lastCheckedDate;
          });

          if (newTasks.length > 0) {
            setHasNewTasks(true);
            // Show browser notification if permission granted
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("New Project Tasks", {
                body: `${newTasks.length} new task(s) assigned to you`,
                icon: "/favicon.ico",
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking for new tasks:", error);
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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

  const handleToggleComplete = async (task: Task) => {
    // Only allow ticking if task is assigned to the employee
    if (task.canTick === false) {
      alert("You can only tick tasks assigned to you.");
      return;
    }

    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const response = await fetch(`/api/employee/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchTasks(projectId!);
      } else {
        const errorData = await response.json();
        console.error("Error updating task:", errorData);
        alert(errorData.error || "Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task. Please try again.");
    }
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      alert("Please enter a section name");
      return;
    }

    // Sections are created automatically when a task is added to a new section
    // So we just need to create a task in the new section
    setShowSectionInput(false);
    setNewSectionName("");
    // Trigger task creation in the new section
    setCreatingTask(newSectionName.trim());
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
            return b.priority - a.priority;
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

    return filtered;
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-neutral-50 flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 mb-4">No project selected</p>
          <button
            onClick={() => router.push("/employee/dashboard")}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/employee/dashboard")}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="text-sm text-neutral-500">My Projects /</div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  {selectedProject?.projectName || "Loading..."} 👋
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 relative">
              {hasNewTasks && (
                <div className="relative">
                  <Bell className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </div>
              )}
              <div className="relative display-menu-container">
                <button
                  onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg border border-neutral-200 transition-colors"
                >
                  <LayoutGrid className="w-4 h-4 text-neutral-600" />
                  <span className="text-sm text-neutral-700">Display</span>
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
        <div className="flex-1 p-6">
          {/* Render based on view mode */}
          {viewMode === "list" && (
            <>
              {/* List View - Sections */}
              {sections.map((section) => {
                const sectionTasks = tasks[section] || [];
                const filtered = filteredTasks(sectionTasks);
                const completedCount = sectionTasks.filter((t) => t.status === "completed").length;

                return (
                  <div key={section} className="mb-8">
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-4 group">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-neutral-700">
                          {section} {sectionTasks.length > 0 && `(${sectionTasks.length})`}
                        </h2>
                        {completedCount > 0 && (
                          <span className="text-xs text-neutral-500">
                            {completedCount} completed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Section Tasks */}
                    <div className="space-y-2">
                      {filtered.map((task) => (
                        <TaskItem
                          key={task._id}
                          task={task}
                          onToggleComplete={() => handleToggleComplete(task)}
                          getPriorityColor={getPriorityColor}
                          formatDate={formatDate}
                          isOverdue={isOverdue(task)}
                        />
                      ))}
                      {creatingTask === section && (
                        <EmployeeTaskForm
                          section={section}
                          projectId={projectId!}
                          projectName={selectedProject?.projectName || ""}
                          onSave={async () => {
                            setCreatingTask(null);
                            await fetchTasks(projectId!);
                          }}
                          onCancel={() => setCreatingTask(null)}
                        />
                      )}
                      {creatingTask !== section && (
                        <button
                          onClick={() => setCreatingTask(section)}
                          className="w-full flex items-center gap-1.5 p-2 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs border border-dashed border-neutral-300 hover:border-emerald-300"
                        >
                          <Plus className="w-3 h-3" />
                          Add task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {viewMode === "board" && (
            <div className="space-y-6">
              {/* Board View - Sections as Columns */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {sections.map((section) => {
                  const sectionTasks = tasks[section] || [];
                  let filtered = filteredTasks(sectionTasks);

                  return (
                    <div key={section} className="flex-shrink-0 w-80 bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                      {/* Section Header */}
                      <div className="flex items-center justify-between mb-4 group">
                        <h3 className="font-semibold text-neutral-700">
                          {section} {sectionTasks.length > 0 && `(${sectionTasks.length})`}
                        </h3>
                      </div>

                      {/* Section Tasks */}
                      <div className="space-y-2 min-h-[200px]">
                        {filtered.map((task) => (
                          <TaskItem
                            key={task._id}
                            task={task}
                            onToggleComplete={() => handleToggleComplete(task)}
                            getPriorityColor={getPriorityColor}
                            formatDate={formatDate}
                            isOverdue={isOverdue(task)}
                          />
                        ))}
                        {creatingTask === section && (
                          <EmployeeTaskForm
                            section={section}
                            projectId={projectId!}
                            projectName={selectedProject?.projectName || ""}
                            onSave={async () => {
                              setCreatingTask(null);
                              await fetchTasks(projectId!);
                            }}
                            onCancel={() => setCreatingTask(null)}
                          />
                        )}
                        {creatingTask !== section && (
                          <button
                            onClick={() => setCreatingTask(section)}
                            className="w-full flex items-center gap-1.5 p-2 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs border border-dashed border-neutral-300 hover:border-emerald-300"
                          >
                            <Plus className="w-3 h-3" />
                            Add task
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-12 text-neutral-400">Loading tasks...</div>
          )}

          {!loading && sections.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-400 mb-4">No sections found for this project</p>
              {showSectionInput ? (
                <div className="max-w-md mx-auto">
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
                    className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSection}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                    >
                      Create Section
                    </button>
                    <button
                      onClick={() => {
                        setShowSectionInput(false);
                        setNewSectionName("");
                      }}
                      className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSectionInput(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Create First Section
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Task Item Component
function TaskItem({
  task,
  onToggleComplete,
  getPriorityColor,
  formatDate,
  isOverdue,
}: {
  task: Task;
  onToggleComplete: () => void;
  getPriorityColor: (priority: number) => string;
  formatDate: (date?: string) => string;
  isOverdue: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-3 bg-white rounded-lg border border-neutral-200 shadow-sm ${
        task.status === "completed" ? "opacity-70" : ""
      } ${isOverdue ? "border-red-300 bg-red-50" : ""}`}
    >
      <button 
        onClick={onToggleComplete} 
        className="flex-shrink-0"
        disabled={task.canTick === false}
        title={task.canTick === false ? "You can only tick tasks assigned to you" : ""}
      >
        {task.status === "completed" ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Circle className={`w-5 h-5 transition-colors ${
            task.canTick === false 
              ? "text-neutral-300 cursor-not-allowed" 
              : "text-neutral-400 hover:text-emerald-500"
          }`} />
        )}
      </button>
      <div className="flex-1">
        <h3
          className={`font-medium text-neutral-800 ${
            task.status === "completed" ? "line-through text-neutral-500" : ""
          }`}
        >
          {task.title}
        </h3>
        {task.description && (
          <p className="text-xs text-neutral-500 mt-0.5">{task.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs mt-1 text-neutral-500">
          {/* Show assigned to label */}
          {task.assignedTo && (
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <User className="w-3 h-3" />
              {typeof task.assignedTo === 'object' ? task.assignedTo.name : 'Assigned'}
            </span>
          )}
          {task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0 && !task.assignedTo && (
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <User className="w-3 h-3" />
              {task.assignees.map((a: any) => typeof a === 'object' ? a.name : a).join(', ')}
            </span>
          )}
          {(!task.assignedTo && (!task.assignees || task.assignees.length === 0)) && (
            <span className="flex items-center gap-1 text-neutral-400 italic">
              <User className="w-3 h-3" />
              Unassigned
            </span>
          )}
          {(task.dueDate || task.deadlineDate) && (
            <span
              className={`flex items-center gap-1 ${
                isOverdue ? "text-red-500 font-semibold" : ""
              }`}
            >
              <Clock className="w-3 h-3" />{" "}
              {formatDate(task.dueDate || task.deadlineDate)}
              {task.dueTime && ` at ${task.dueTime}`}
            </span>
          )}
          <span className={`flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
            <Flag className="w-3 h-3" /> P{task.priority}
          </span>
          {task.bonusPoints && task.bonusPoints > 0 && (
            <span className="flex items-center gap-1 text-emerald-600">
              +{task.bonusPoints} pts
            </span>
          )}
          {task.penaltyPoints && task.penaltyPoints > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              -{task.penaltyPoints} pts
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Employee Task Form Component
function EmployeeTaskForm({
  section,
  projectId,
  projectName,
  onSave,
  onCancel,
}: {
  section: string;
  projectId: string;
  projectName: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    taskKind: "one-time" as TaskKind,
    priority: 2,
    dueDate: "",
    dueTime: "",
    deadlineDate: "",
    deadlineTime: "",
    customFields: [] as Array<{ name: string; type: "number" | "string" | "boolean" | "date"; defaultValue?: any }>,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert("Please enter a task title");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/employee/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          section,
          ...formData,
          customFields: formData.customFields.filter((f) => f.name && f.name.trim() !== ""),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onSave();
      } else {
        alert(data.error || "Failed to create task");
      }
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 bg-white rounded-lg border border-emerald-300 shadow-sm">
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Task title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
          autoFocus
        />
        <textarea
          placeholder="Description (optional)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-neutral-600 mb-0.5 block">Priority</label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 2 })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600 mb-0.5 block">Type</label>
            <select
              value={formData.taskKind}
              onChange={(e) => setFormData({ ...formData, taskKind: e.target.value as TaskKind })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="one-time">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-neutral-600 mb-0.5 block">Due Date</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600 mb-0.5 block">Due Time</label>
            <input
              type="time"
              value={formData.dueTime}
              onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
              className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
            />
          </div>
        </div>
        <div className="text-xs text-neutral-500 italic">
          Assigned to: {session?.user?.name || "You"}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Save className="w-3 h-3" />
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-200 transition-colors flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeProjectTasks() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <EmployeeProjectTasksContent />
    </Suspense>
  );
}

