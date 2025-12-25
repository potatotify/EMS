"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  User,
  Flag,
  ChevronDown,
  Folder,
  Search,
  ClipboardList,
  FileText,
  StickyNote,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TaskKind = "one-time" | "daily" | "weekly" | "monthly" | "recurring" | "custom";
type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
type ViewMode = "list" | "board" | "calendar";

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
  assignees?: Array<{ _id: string; name: string; email: string }>;
  assignedToName?: string;
  dueDate?: string;
  dueTime?: string;
  deadlineDate?: string;
  deadlineTime?: string;
  priority: number;
  status: TaskStatus;
  order: number;
  createdAt?: string | Date;
  notApplicable?: boolean; // If true, bonus/penalty points don't apply
  subtasks?: Subtask[];
}

interface Subtask {
  _id: string;
  taskId: string;
  title: string;
  description?: string;
  assignee?: {
    _id: string;
    name: string;
    email: string;
  };
  assigneeName?: string;
  dueDate?: string;
  dueTime?: string;
  priority: number;
  ticked: boolean;
  tickedAt?: string;
  completedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt?: string;
}

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface DailyUpdate {
  _id: string;
  userId: string;
  date: string;
  checklist: ChecklistItem[];
  hoursWorked?: number;
  tasksForTheDay?: string;
  additionalNotes?: string;
  adminApproved?: boolean;
  bonusAwarded?: boolean;
  status?: string;
}

export default function AllTasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<Record<string, Record<string, Task[]>>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [grouping, setGrouping] = useState("none");
  const [sorting, setSorting] = useState("manual");
  const [dateFilter, setDateFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dailyUpdate, setDailyUpdate] = useState<DailyUpdate | null>(null);
  const [checklistConfig, setChecklistConfig] = useState<ChecklistItem[]>([]);
  const [showDailyUpdates, setShowDailyUpdates] = useState(true);
  const [editingTasksForDay, setEditingTasksForDay] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [tempTasks, setTempTasks] = useState("");
  const [tempHours, setTempHours] = useState(0);
  const [tempNotes, setTempNotes] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (status === "authenticated") {
      fetchAllTasks();
      fetchDailyUpdate();
      fetchChecklistConfig();
    }
  }, [status]);

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

  const fetchDailyUpdate = async () => {
    try {
      // Use local date instead of UTC to avoid timezone issues
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      console.log("Fetching daily update for:", today);
      const response = await fetch(`/api/daily-updates?date=${today}`);
      if (response.ok) {
        const data = await response.json();
        // API returns an array, get the first item
        const dailyUpdateData = Array.isArray(data) ? data[0] : data;
        
        console.log("Fetched daily update data:", dailyUpdateData);
        
        // Check if the fetched data is actually from today
        if (dailyUpdateData && dailyUpdateData.date) {
          const updateDateObj = new Date(dailyUpdateData.date);
          const updateDate = `${updateDateObj.getFullYear()}-${String(updateDateObj.getMonth() + 1).padStart(2, '0')}-${String(updateDateObj.getDate()).padStart(2, '0')}`;
          
          console.log("Update date:", updateDate, "Today:", today, "Match:", updateDate === today);
          
          // If the update is from today, use it
          if (updateDate === today) {
            // Convert API format (label/checked) to component format (text/completed)
            if (dailyUpdateData.checklist) {
              const convertedData = {
                ...dailyUpdateData,
                checklist: dailyUpdateData.checklist.map((item: any) => ({
                  id: item.label,
                  text: item.label,
                  completed: item.checked
                }))
              };
              console.log("Setting daily update with today's data");
              setDailyUpdate(convertedData);
            } else {
              setDailyUpdate(dailyUpdateData);
            }
          } else {
            // Old data from previous day, reset to null (will show unchecked items from config)
            console.log("Resetting daily update - old data detected");
            setDailyUpdate(null);
          }
        } else {
          // No data for today, set to null
          console.log("No daily update data found, resetting to null");
          setDailyUpdate(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch daily update:", error);
    }
  };

  const fetchChecklistConfig = async () => {
    try {
      const response = await fetch('/api/employee/checklist-config');
      if (response.ok) {
        const data = await response.json();
        const checklistItems = (data.checklist || []).map((item: any) => ({
          id: item.label || item.text || '',
          text: item.label || item.text || '',
          completed: false
        }));
        setChecklistConfig(checklistItems);
      }
    } catch (error) {
      console.error("Failed to fetch checklist config:", error);
    }
  };

  const handleSaveDailyUpdateField = async (field: 'tasks' | 'hours' | 'notes', value: string | number) => {
    try {
      if (dailyUpdate?.adminApproved) {
        alert('This daily update has been approved by admin and cannot be modified.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const currentChecklist = dailyUpdate?.checklist || [];
      const apiChecklist = currentChecklist.map(item => ({
        label: item.text,
        checked: item.completed,
        type: 'global' as const
      }));

      const submissionData: any = {
        date: today,
        checklist: apiChecklist,
        hoursWorked: dailyUpdate?.hoursWorked || 0,
        tasksForTheDay: dailyUpdate?.tasksForTheDay || '',
        additionalNotes: dailyUpdate?.additionalNotes || '',
      };

      // Update the specific field
      if (field === 'tasks') {
        submissionData.tasksForTheDay = value;
      } else if (field === 'hours') {
        submissionData.hoursWorked = Number(value);
      } else if (field === 'notes') {
        submissionData.additionalNotes = value;
      }

      const response = await fetch('/api/daily-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedDaily = {
          ...data.dailyUpdate,
          checklist: (data.dailyUpdate.checklist || []).map((item: any) => ({
            id: item.label,
            text: item.label,
            completed: item.checked
          }))
        };
        setDailyUpdate(updatedDaily);
        
        // Close editing mode
        setEditingTasksForDay(false);
        setEditingHours(false);
        setEditingNotes(false);
      }
    } catch (error) {
      console.error('Failed to save daily update field:', error);
    }
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    try {
      // Check if daily update is already approved by admin
      if (dailyUpdate?.adminApproved) {
        alert('This daily update has been approved by admin and cannot be modified.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Get current checklist or create from config
      let currentChecklist = dailyUpdate?.checklist || [];
      if (currentChecklist.length === 0) {
        currentChecklist = checklistConfig.map(item => ({
          id: item.id,
          text: item.text,
          completed: false
        }));
      }
      
      // Toggle the specific item
      const updatedChecklist = currentChecklist.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );

      // Convert to API format (label/checked instead of text/completed)
      const apiChecklist = updatedChecklist.map(item => ({
        label: item.text,
        checked: item.completed,
        type: 'global' as const
      }));

      // Prepare submission data with required fields
      const submissionData = {
        date: today,
        checklist: apiChecklist,
        hoursWorked: dailyUpdate?.hoursWorked || 0,
        tasksForTheDay: dailyUpdate?.tasksForTheDay || '',
        additionalNotes: dailyUpdate?.additionalNotes || '',
      };

      const response = await fetch('/api/daily-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });

      if (response.ok) {
        const data = await response.json();
        // Convert response back to component format
        const updatedDaily = {
          ...data.dailyUpdate,
          checklist: (data.dailyUpdate.checklist || []).map((item: any) => ({
            id: item.label,
            text: item.label,
            completed: item.checked
          }))
        };
        setDailyUpdate(updatedDaily);
      } else {
        const errorData = await response.json();
        console.error('Failed to update checklist:', errorData);
      }
    } catch (error) {
      console.error('Failed to update checklist item:', error);
    }
  };

  const fetchAllTasks = async () => {
    setLoading(true);
    try {
      // First, reset any recurring tasks that need to be reset
      try {
        await fetch("/api/tasks/reset-recurring?scope=user", {
          method: "POST",
        });
      } catch (error) {
        console.error("Error resetting recurring tasks:", error);
        // Continue even if reset fails
      }

      const response = await fetch("/api/employee/all-tasks");
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || {});
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    // Check if task has incomplete subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      const hasIncompleteSubtasks = task.subtasks.some(s => !s.ticked);
      if (hasIncompleteSubtasks && task.status !== "completed") {
        alert("Please complete all subtasks before marking this task as complete.");
        return;
      }
    }
    
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const response = await fetch(`/api/employee/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchAllTasks();
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleToggleNotApplicable = async (task: Task) => {
    const currentNotApplicable = Boolean((task as any).notApplicable);
    const newNotApplicable = !currentNotApplicable;
    
    try {
      const response = await fetch(`/api/employee/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notApplicable: newNotApplicable }),
      });

      if (response.ok) {
        // Refresh tasks from server
        await fetchAllTasks();
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error("Error updating task:", errorData);
        alert(errorData.error || "Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task. Please try again.");
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentTicked: boolean) => {
    try {
      const response = await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticked: !currentTicked }),
      });

      if (response.ok) {
        await fetchAllTasks();
      }
    } catch (error) {
      console.error("Error updating subtask:", error);
    }
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

  const filteredTasks = (sectionTasks: Task[]) => {
    let filtered = [...sectionTasks];

    // Apply "Assigned to Me" filter
    if (showOnlyMyTasks && session?.user?.id) {
      const userIdStr = session.user.id.toString();
      filtered = filtered.filter((t) => {
        // Check if task is assigned to current user
        if (t.assignedTo?._id && t.assignedTo._id.toString() === userIdStr) {
          return true;
        }
        // Check if user is in assignees array
        if (t.assignees && Array.isArray(t.assignees)) {
          return t.assignees.some((assignee) => {
            if (typeof assignee === 'object' && assignee._id) {
              return assignee._id.toString() === userIdStr;
            }
            if (typeof assignee === 'string') {
              return assignee === userIdStr;
            }
            return false;
          });
        }
        return false;
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((t) =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

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
      filtered = filtered.filter((t) => {
        if (priorityFilter === "high") return t.priority >= 7;
        if (priorityFilter === "medium") return t.priority >= 4 && t.priority < 7;
        if (priorityFilter === "low") return t.priority < 4;
        return true;
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

  const getProjectNames = () => {
    return Object.keys(tasks);
  };

  const filteredProjects = projectFilter === "all" 
    ? getProjectNames() 
    : getProjectNames().filter(p => p === projectFilter);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
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
                <h1 className="text-2xl font-bold text-neutral-900">All Tasks</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 relative">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {/* My Tasks Filter Button */}
              <button
                onClick={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                  showOnlyMyTasks
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
                title={showOnlyMyTasks ? "Show all tasks" : "Show only my tasks"}
              >
                <User className={`w-4 h-4 ${showOnlyMyTasks ? "text-emerald-600" : "text-neutral-600"}`} />
                <span className="text-sm font-medium">My Tasks</span>
              </button>
              {/* Display Menu */}
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
                      {/* View Mode */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          <h3 className="font-semibold text-neutral-900">Layout</h3>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewMode("board")}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              viewMode === "board"
                                ? "bg-emerald-50 border border-emerald-300 text-emerald-700"
                                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-transparent"
                            }`}
                          >
                            Board
                          </button>
                          <button
                            onClick={() => setViewMode("list")}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              viewMode === "list"
                                ? "bg-emerald-50 border border-emerald-300 text-emerald-700"
                                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-transparent"
                            }`}
                          >
                            List
                          </button>
                          <button
                            onClick={() => setViewMode("calendar")}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              viewMode === "calendar"
                                ? "bg-emerald-50 border border-emerald-300 text-emerald-700"
                                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-transparent"
                            }`}
                          >
                            Calendar
                          </button>
                        </div>
                      </div>

                      {/* Filter */}
                      <div>
                        <h3 className="font-semibold mb-3 text-neutral-900">Filter</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showOnlyMyTasks}
                                onChange={(e) => setShowOnlyMyTasks(e.target.checked)}
                                className="w-4 h-4 text-emerald-600 border-neutral-300 rounded focus:ring-emerald-500 focus:ring-2"
                              />
                              <span className="text-sm text-neutral-700 font-medium">Show only tasks assigned to me</span>
                            </label>
                          </div>
                          <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showDailyUpdates}
                                onChange={(e) => setShowDailyUpdates(e.target.checked)}
                                className="w-4 h-4 text-purple-600 border-neutral-300 rounded focus:ring-purple-500 focus:ring-2"
                              />
                              <span className="text-sm text-neutral-700 font-medium">Show Daily Updates section</span>
                            </label>
                          </div>
                          <div>
                            <label className="text-sm text-neutral-600 mb-1 block">Project</label>
                            <select
                              value={projectFilter}
                              onChange={(e) => setProjectFilter(e.target.value)}
                              className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            >
                              <option value="all">All Projects</option>
                              {getProjectNames().map((projectName) => (
                                <option key={projectName} value={projectName}>
                                  {projectName}
                                </option>
                              ))}
                            </select>
                          </div>
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

                      {/* Sort */}
                      <div>
                        <h3 className="font-semibold mb-3 text-neutral-900">Sort</h3>
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

                      {/* Reset */}
                      <button
                        onClick={() => {
                          setProjectFilter("all");
                          setDateFilter("all");
                          setPriorityFilter("all");
                          setSorting("manual");
                          setSearchTerm("");
                          setShowOnlyMyTasks(false);
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

      {/* Daily Updates Section - Only show in list view or when board view is not active */}
      {showDailyUpdates && viewMode === "list" && (
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="bg-white rounded-lg border border-purple-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-purple-900">Daily Updates</h2>
            {(() => {
              // Use same logic as below for consistency
              let dailyUpdateChecklist: ChecklistItem[];
              if (dailyUpdate?.checklist && dailyUpdate.checklist.length > 0) {
                dailyUpdateChecklist = dailyUpdate.checklist;
              } else if (checklistConfig.length > 0) {
                dailyUpdateChecklist = checklistConfig.map(item => ({ ...item, completed: false }));
              } else {
                dailyUpdateChecklist = [];
              }
              
              const pendingCount = dailyUpdateChecklist.filter(item => !item.completed).length;
              return pendingCount > 0 ? (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  {pendingCount} pending
                </span>
              ) : null;
            })()}
          </div>
          <div className="space-y-2">
            {(() => {
              // Merge saved checklist with config, preserving completed state
              let dailyUpdateChecklist: ChecklistItem[];
              
              if (dailyUpdate?.checklist && dailyUpdate.checklist.length > 0) {
                // Use saved checklist
                dailyUpdateChecklist = dailyUpdate.checklist;
              } else if (checklistConfig.length > 0) {
                // Initialize from config with all items unchecked
                dailyUpdateChecklist = checklistConfig.map(item => ({ 
                  ...item, 
                  completed: false 
                }));
              } else {
                dailyUpdateChecklist = [];
              }
              
              if (dailyUpdateChecklist.length === 0) {
                return (
                  <p className="text-sm text-purple-600">No daily update items configured.</p>
                );
              }
              
              return (
                <>
                  {dailyUpdate?.adminApproved && (
                    <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-medium">Approved by Admin - No further changes allowed</span>
                      </div>
                    </div>
                  )}
                  {dailyUpdateChecklist.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        dailyUpdate?.adminApproved 
                          ? 'opacity-75 cursor-not-allowed' 
                          : 'hover:bg-purple-50 cursor-pointer'
                      }`}
                      onClick={() => !dailyUpdate?.adminApproved && handleToggleChecklistItem(item.id)}
                    >
                      <div className="flex-shrink-0">
                        {item.completed ? (
                          <CheckCircle2 className={`w-5 h-5 ${
                            dailyUpdate?.adminApproved ? 'text-purple-400' : 'text-purple-600'
                          }`} />
                        ) : (
                          <Circle className={`w-5 h-5 ${
                            dailyUpdate?.adminApproved ? 'text-purple-300' : 'text-purple-400'
                          }`} />
                        )}
                      </div>
                      <span className={`flex-1 text-sm ${
                        item.completed ? 'text-purple-500 line-through' : 'text-purple-900'
                      }`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                  
                  {/* Editable Fields Section */}
                  <div className="mt-4 pt-4 border-t border-purple-200 space-y-2">
                    {/* Tasks for the Day Button */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (!dailyUpdate?.adminApproved) {
                            setTempTasks(dailyUpdate?.tasksForTheDay || '');
                            setEditingTasksForDay(!editingTasksForDay);
                            setEditingHours(false);
                            setEditingNotes(false);
                          }
                        }}
                        disabled={dailyUpdate?.adminApproved}
                        className={`w-full flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                          dailyUpdate?.adminApproved
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                            : dailyUpdate?.tasksForTheDay
                            ? 'bg-purple-50 border-purple-300 hover:bg-purple-100'
                            : 'bg-white border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-purple-900 font-medium flex-1 text-left truncate">
                          {dailyUpdate?.tasksForTheDay || 'Tasks for the day'}
                        </span>
                      </button>
                      
                      {editingTasksForDay && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-purple-300 p-3 z-50">
                          <textarea
                            value={tempTasks}
                            onChange={(e) => setTempTasks(e.target.value)}
                            className="w-full text-sm text-purple-700 bg-white rounded p-2 border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            rows={3}
                            placeholder="Describe your tasks for today..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingTasksForDay(false)}
                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveDailyUpdateField('tasks', tempTasks)}
                              className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hours Worked Button */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (!dailyUpdate?.adminApproved) {
                            setTempHours(dailyUpdate?.hoursWorked || 0);
                            setEditingHours(!editingHours);
                            setEditingTasksForDay(false);
                            setEditingNotes(false);
                          }
                        }}
                        disabled={dailyUpdate?.adminApproved}
                        className={`w-full flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                          dailyUpdate?.adminApproved
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                            : dailyUpdate?.hoursWorked
                            ? 'bg-purple-50 border-purple-300 hover:bg-purple-100'
                            : 'bg-white border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-purple-900 font-medium flex-1 text-left">
                          Hours worked: {dailyUpdate?.hoursWorked || 0}
                        </span>
                      </button>
                      
                      {editingHours && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-purple-300 p-3 z-50">
                          <input
                            type="number"
                            value={tempHours}
                            onChange={(e) => setTempHours(Number(e.target.value))}
                            className="w-full text-sm text-purple-700 bg-white rounded p-2 border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            min="0"
                            max="24"
                            step="0.5"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingHours(false)}
                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveDailyUpdateField('hours', tempHours)}
                              className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Additional Notes Button */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (!dailyUpdate?.adminApproved) {
                            setTempNotes(dailyUpdate?.additionalNotes || '');
                            setEditingNotes(!editingNotes);
                            setEditingTasksForDay(false);
                            setEditingHours(false);
                          }
                        }}
                        disabled={dailyUpdate?.adminApproved}
                        className={`w-full flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                          dailyUpdate?.adminApproved
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                            : dailyUpdate?.additionalNotes
                            ? 'bg-purple-50 border-purple-300 hover:bg-purple-100'
                            : 'bg-white border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        <StickyNote className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-purple-900 font-medium flex-1 text-left truncate">
                          {dailyUpdate?.additionalNotes || 'Additional notes'}
                        </span>
                      </button>
                      
                      {editingNotes && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-purple-300 p-3 z-50">
                          <textarea
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            className="w-full text-sm text-purple-700 bg-white rounded p-2 border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            rows={2}
                            placeholder="Any additional notes or comments..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingNotes(false)}
                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveDailyUpdateField('notes', tempNotes)}
                              className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
      )}

      {/* Content */}
      {viewMode === "board" && (
        <div className="w-full overflow-x-auto overflow-y-visible p-6" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
          <div className="inline-flex gap-4 min-w-full">
            {/* Daily Updates Board Column */}
            {showDailyUpdates && (() => {
              let dailyUpdateChecklist: ChecklistItem[];
              if (dailyUpdate?.checklist && dailyUpdate.checklist.length > 0) {
                dailyUpdateChecklist = dailyUpdate.checklist;
              } else if (checklistConfig.length > 0) {
                dailyUpdateChecklist = checklistConfig.map(item => ({ ...item, completed: false }));
              } else {
                dailyUpdateChecklist = [];
              }

              if (dailyUpdateChecklist.length === 0) return null;

              const pendingCount = dailyUpdateChecklist.filter(item => !item.completed).length;

              return (
                <div className="flex-shrink-0 w-80 min-w-[320px] bg-purple-50 rounded-xl p-4 border border-purple-300">
                  {/* Daily Updates Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList className="w-4 h-4 text-purple-600" />
                      <h3 className="font-semibold text-purple-900">Daily Updates</h3>
                    </div>
                    <div className="text-xs text-purple-600">
                      {dailyUpdate?.adminApproved ? (
                        <span className="text-green-600 font-medium">✓ Approved</span>
                      ) : (
                        pendingCount > 0 ? `${pendingCount} pending` : 'All completed'
                      )}
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2">
                    {dailyUpdateChecklist.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white rounded-lg border border-purple-200 p-3 transition-shadow ${
                          dailyUpdate?.adminApproved ? 'opacity-75' : 'hover:shadow-md cursor-pointer'
                        }`}
                        onClick={() => !dailyUpdate?.adminApproved && handleToggleChecklistItem(item.id)}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!dailyUpdate?.adminApproved) {
                                handleToggleChecklistItem(item.id);
                              }
                            }}
                            className="mt-0.5 flex-shrink-0"
                            disabled={dailyUpdate?.adminApproved}
                          >
                            {item.completed ? (
                              <CheckCircle2 className={`w-5 h-5 ${
                                dailyUpdate?.adminApproved ? 'text-purple-400' : 'text-purple-600'
                              }`} />
                            ) : (
                              <Circle className={`w-5 h-5 ${
                                dailyUpdate?.adminApproved ? 'text-purple-300' : 'text-purple-400 hover:text-purple-600'
                              }`} />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${
                              item.completed ? 'line-through text-purple-400' : 'text-purple-900'
                            }`}>
                              {item.text}
                            </div>
                            {dailyUpdate?.adminApproved && (
                              <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Approved by Admin
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Action Buttons - Tasks, Hours, Notes */}
                  <div className="mt-4 pt-4 border-t border-purple-200 space-y-2">
                    {/* Tasks for the Day Button */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (!dailyUpdate?.adminApproved) {
                            setTempTasks(dailyUpdate?.tasksForTheDay || '');
                            setEditingTasksForDay(!editingTasksForDay);
                            setEditingHours(false);
                            setEditingNotes(false);
                          }
                        }}
                        disabled={dailyUpdate?.adminApproved}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          dailyUpdate?.adminApproved
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                            : dailyUpdate?.tasksForTheDay
                            ? 'bg-purple-50 border-purple-300 hover:bg-purple-100'
                            : 'bg-white border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-xs text-purple-900 font-medium flex-1 text-left truncate">
                          {dailyUpdate?.tasksForTheDay || 'Tasks for the day'}
                        </span>
                      </button>
                      
                      {editingTasksForDay && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-purple-300 p-3 z-50">
                          <textarea
                            value={tempTasks}
                            onChange={(e) => setTempTasks(e.target.value)}
                            className="w-full text-xs text-purple-700 bg-white rounded p-2 border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            rows={3}
                            placeholder="Describe your tasks for today..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingTasksForDay(false)}
                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveDailyUpdateField('tasks', tempTasks)}
                              className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hours Worked Button */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (!dailyUpdate?.adminApproved) {
                            setTempHours(dailyUpdate?.hoursWorked || 0);
                            setEditingHours(!editingHours);
                            setEditingTasksForDay(false);
                            setEditingNotes(false);
                          }
                        }}
                        disabled={dailyUpdate?.adminApproved}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          dailyUpdate?.adminApproved
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                            : dailyUpdate?.hoursWorked
                            ? 'bg-purple-50 border-purple-300 hover:bg-purple-100'
                            : 'bg-white border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-xs text-purple-900 font-medium flex-1 text-left">
                          Hours worked: {dailyUpdate?.hoursWorked || 0}
                        </span>
                      </button>
                      
                      {editingHours && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-purple-300 p-3 z-50">
                          <input
                            type="number"
                            value={tempHours}
                            onChange={(e) => setTempHours(Number(e.target.value))}
                            className="w-full text-sm text-purple-700 bg-white rounded p-2 border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            min="0"
                            max="24"
                            step="0.5"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingHours(false)}
                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveDailyUpdateField('hours', tempHours)}
                              className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Additional Notes Button */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (!dailyUpdate?.adminApproved) {
                            setTempNotes(dailyUpdate?.additionalNotes || '');
                            setEditingNotes(!editingNotes);
                            setEditingTasksForDay(false);
                            setEditingHours(false);
                          }
                        }}
                        disabled={dailyUpdate?.adminApproved}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          dailyUpdate?.adminApproved
                            ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                            : dailyUpdate?.additionalNotes
                            ? 'bg-purple-50 border-purple-300 hover:bg-purple-100'
                            : 'bg-white border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        <StickyNote className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-xs text-purple-900 font-medium flex-1 text-left truncate">
                          {dailyUpdate?.additionalNotes || 'Additional notes'}
                        </span>
                      </button>
                      
                      {editingNotes && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-purple-300 p-3 z-50">
                          <textarea
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            className="w-full text-xs text-purple-700 bg-white rounded p-2 border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            rows={2}
                            placeholder="Any additional notes or comments..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingNotes(false)}
                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveDailyUpdateField('notes', tempNotes)}
                              className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>


                </div>
              );
            })()}
            
            {filteredProjects.map((projectName) => {
              const projectTasks = tasks[projectName] || {};
              const sections = Object.keys(projectTasks);

              return (
                <div key={projectName} className="flex-shrink-0 w-80 min-w-[320px] bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                  {/* Project Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Folder className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-semibold text-neutral-900">{projectName}</h3>
                    </div>
                    <div className="text-xs text-neutral-500">
                      {Object.values(projectTasks).reduce((sum, sectionTasks) => sum + sectionTasks.length, 0)} tasks
                    </div>
                  </div>

                  {/* Sections */}
                  {sections.map((section) => {
                    const sectionTasks = projectTasks[section] || [];
                    const filtered = filteredTasks(sectionTasks);

                    return (
                      <div key={section} className="mb-4">
                        <div className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">
                          {section}
                        </div>
                        <div className="space-y-2">
                          {filtered.map((task) => (
                            <motion.div
                              key={task._id}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-lg border border-neutral-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => handleToggleComplete(task)}
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                <div className="flex items-center gap-0.5 mt-0.5 flex-shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleComplete(task);
                                    }}
                                    className="flex-shrink-0"
                                  >
                                    {task.status === "completed" ? (
                                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-neutral-400 hover:text-emerald-600" />
                                    )}
                                  </button>
                                  {task.status !== "completed" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleNotApplicable(task);
                                      }}
                                      className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                        (task as any).notApplicable 
                                          ? "bg-purple-500 border-purple-600 text-white shadow-sm hover:bg-purple-600 active:bg-purple-700" 
                                          : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100"
                                      }`}
                                      title={(task as any).notApplicable ? "Mark as applicable (bonus/penalty will apply)" : "Mark as not applicable (bonus/penalty won't apply)"}
                                    >
                                      {(task as any).notApplicable ? "✓" : "NA"}
                                    </button>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium truncate ${
                                    task.status === "completed" ? "line-through text-neutral-400" : 
                                    (task as any).notApplicable ? "text-gray-500" : 
                                    "text-neutral-900"
                                  }`}>
                                    {task.title}
                                  </div>
                                  {task.description && (
                                    <div className="text-xs text-neutral-500 mt-1 line-clamp-2">
                                      {task.description}
                                    </div>
                                  )}
                                  
                                  {/* Subtasks Section */}
                                  {task.subtasks && task.subtasks.length > 0 && (
                                    <div className="mt-3 pl-4 border-l-2 border-neutral-200">
                                      <div className="text-xs font-semibold text-neutral-600 mb-2">Subtasks</div>
                                      {task.subtasks.map((subtask) => (
                                        <div key={subtask._id} className="flex items-start gap-1.5 mb-2 min-w-0">
                                          <button
                                            onClick={() => handleToggleSubtask(subtask._id, subtask.ticked)}
                                            className="mt-0.5 flex-shrink-0"
                                          >
                                            {subtask.ticked ? (
                                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            ) : (
                                              <Circle className="w-4 h-4 text-neutral-400 hover:text-emerald-600" />
                                            )}
                                          </button>
                                          <div className="flex-1 min-w-0">
                                            <div className={`text-xs truncate ${subtask.ticked ? "line-through text-neutral-400" : "text-neutral-700"}`}>
                                              {subtask.title}
                                            </div>
                                            {subtask.assigneeName && (
                                              <div className="text-xs text-neutral-400 mt-0.5">
                                                <User className="w-3 h-3 inline mr-1" />
                                                {subtask.assigneeName}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    {task.priority > 0 && (
                                      <Flag className={`w-3 h-3 ${getPriorityColor(task.priority)}`} />
                                    )}
                                    {(task.deadlineDate || task.dueDate) && (
                                      <div className="flex items-center gap-1 text-xs text-neutral-500">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatDate(task.deadlineDate || task.dueDate)}</span>
                                      </div>
                                    )}
                                    {task.assignedTo && (
                                      <div className="flex items-center gap-1 text-xs text-neutral-500">
                                        <User className="w-3 h-3" />
                                        <span>{task.assignedTo.name}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "list" && (
        <div className="max-w-7xl mx-auto p-6">
          {filteredProjects.map((projectName) => {
            const projectTasks = tasks[projectName] || {};
            const sections = Object.keys(projectTasks);

            return (
              <div key={projectName} className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Folder className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-xl font-bold text-neutral-900">{projectName}</h2>
                </div>

                {sections.map((section) => {
                  const sectionTasks = projectTasks[section] || [];
                  const filtered = filteredTasks(sectionTasks);

                  return (
                    <div key={section} className="mb-6">
                      <div className="text-sm font-semibold text-neutral-600 mb-3 uppercase tracking-wider">
                        {section}
                      </div>
                      <div className="space-y-2">
                        {filtered.map((task) => (
                          <motion.div
                            key={task._id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => handleToggleComplete(task)}
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              <div className="flex items-center gap-0.5 mt-0.5 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleComplete(task);
                                  }}
                                  className="flex-shrink-0"
                                >
                                  {task.status === "completed" ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-neutral-400 hover:text-emerald-600" />
                                  )}
                                </button>
                                {task.status !== "completed" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleNotApplicable(task);
                                    }}
                                    className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                                      (task as any).notApplicable 
                                        ? "bg-purple-500 border-purple-600 text-white shadow-sm hover:bg-purple-600 active:bg-purple-700" 
                                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100"
                                    }`}
                                    title={(task as any).notApplicable ? "Mark as applicable (bonus/penalty will apply)" : "Mark as not applicable (bonus/penalty won't apply)"}
                                  >
                                    {(task as any).notApplicable ? "✓" : "NA"}
                                  </button>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-base font-medium truncate ${
                                  task.status === "completed" ? "line-through text-neutral-400" : 
                                  (task as any).notApplicable ? "text-gray-500" : 
                                  "text-neutral-900"
                                }`}>
                                  {task.title}
                                </div>
                                {task.description && (
                                  <div className="text-sm text-neutral-500 mt-1">
                                    {task.description}
                                  </div>
                                )}
                                <div className="flex items-center gap-4 mt-3 flex-wrap">
                                  {task.priority > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Flag className={`w-4 h-4 ${getPriorityColor(task.priority)}`} />
                                      <span className="text-xs text-neutral-500">P{task.priority}</span>
                                    </div>
                                  )}
                                  {(task.deadlineDate || task.dueDate) && (
                                    <div className="flex items-center gap-1 text-sm text-neutral-500">
                                      <Clock className="w-4 h-4" />
                                      <span>{formatDate(task.deadlineDate || task.dueDate)}</span>
                                    </div>
                                  )}
                                  {task.assignedTo && (
                                    <div className="flex items-center gap-1 text-sm text-neutral-500">
                                      <User className="w-4 h-4" />
                                      <span>{task.assignedTo.name}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="max-w-7xl mx-auto p-6">
          <CalendarView
            tasks={Object.values(tasks).flatMap(projectTasks =>
              Object.values(projectTasks).flat()
            )}
            filteredTasks={filteredTasks}
            getPriorityColor={getPriorityColor}
            formatDate={formatDate}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
          />
        </div>
      )}

    </div>
  );
}

// Calendar View Component
function CalendarView({
  tasks,
  filteredTasks,
  getPriorityColor,
  formatDate,
  currentDate,
  setCurrentDate,
}: {
  tasks: Task[];
  filteredTasks: (tasks: Task[]) => Task[];
  getPriorityColor: (priority: number) => string;
  formatDate: (date?: string) => string;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
}) {
  const filtered = filteredTasks(tasks);

  // Get tasks for a specific date (by deadlineDate or dueDate)
  const getTasksForDate = (date: Date): Task[] => {
    const dateStr = date.toISOString().split("T")[0];
    return filtered.filter((task) => {
      const deadlineDate = task.deadlineDate ? new Date(task.deadlineDate).toISOString().split("T")[0] : null;
      const dueDate = task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : null;
      return deadlineDate === dateStr || dueDate === dateStr;
    });
  };

  // Get calendar days
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarDays = getCalendarDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 w-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth("prev")}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <h2 className="text-lg font-semibold text-neutral-900">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={() => navigateMonth("next")}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-neutral-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-neutral-600 py-2">
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square min-h-[100px]" />;
          }

          const dateTasks = getTasksForDate(date);
          const isToday = date.getTime() === today.getTime();
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();

          return (
            <div
              key={date.toISOString()}
              className={`aspect-square min-h-[100px] border border-neutral-200 rounded-lg p-2 transition-all ${
                isToday ? "bg-emerald-50 border-emerald-300" : ""
              } ${
                !isCurrentMonth ? "opacity-40" : "hover:bg-neutral-50"
              }`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isToday ? "text-emerald-700" : "text-neutral-700"
              }`}>
                {date.getDate()}
              </div>
              <div className="space-y-1 overflow-hidden">
                {dateTasks.slice(0, 3).map((task) => (
                  <div
                    key={task._id}
                    className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${
                      task.status === "completed" ? "bg-neutral-200 text-neutral-600 line-through" : "bg-emerald-100 text-emerald-700"
                    }`}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                ))}
                {dateTasks.length > 3 && (
                  <div className="text-xs text-neutral-500 px-1.5">
                    +{dateTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

