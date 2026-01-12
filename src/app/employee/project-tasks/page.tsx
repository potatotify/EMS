"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
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
  Calendar,
  Folder,
  FileText,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import SubtaskModal from "@/components/admin/SubtaskModal";

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
  timeSpent?: number; // Time spent on task in hours
  order: number;
  isNew?: boolean; // For notification purposes
  canTick?: boolean; // Whether employee can tick this task
  createdByEmployee?: boolean; // Whether task was created by an employee
  createdBy?: string; // User ID of who created the task
  createdAt?: string | Date; // Task creation date
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
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [hasNewTasks, setHasNewTasks] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingTask, setCreatingTask] = useState<string | null>(null); // section name
  const [newSectionName, setNewSectionName] = useState("");
  const [showSectionInput, setShowSectionInput] = useState(false);
  
  // Subtask modal state
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [selectedTaskForSubtasks, setSelectedTaskForSubtasks] = useState<Task | null>(null);
  const [projectEmployees, setProjectEmployees] = useState<any[]>([]);
  const [isLeadAssignee, setIsLeadAssignee] = useState(false);
  const [isNA, setIsNA] = useState(false);
  const [naLoading, setNaLoading] = useState(false);

  // Fetch project details
  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchTasks(projectId);
      checkNAStatus(projectId);
      // Check for new tasks every 30 seconds
      const interval = setInterval(() => {
        checkForNewTasks(projectId);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [projectId]);

  const checkNAStatus = async (projectId: string) => {
    if (!isLeadAssignee) return;
    try {
      const response = await fetch(`/api/employee/mark-task-na?projectId=${projectId}`);
      const data = await response.json();
      if (response.ok) {
        setIsNA(data.isNA || false);
      }
    } catch (error) {
      console.error('Error checking NA status:', error);
    }
  };

  const handleToggleNA = async () => {
    if (!projectId || !isLeadAssignee) return;
    setNaLoading(true);
    try {
      const response = await fetch('/api/employee/mark-task-na', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          isNA: !isNA
        })
      });
      const data = await response.json();
      if (response.ok) {
        setIsNA(!isNA);
      } else {
        alert(data.error || 'Failed to update NA status');
      }
    } catch (error) {
      console.error('Error toggling NA:', error);
      alert('Failed to update NA status');
    } finally {
      setNaLoading(false);
    }
  };

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
        
        // Fetch project employees and check if current user is lead assignee
        if (data.project.assignees) {
          setProjectEmployees(data.project.assignees);
        }
        
        // Check if current user is lead assignee
        if (session?.user?.id) {
          const userId = session.user.id;
          const leadAssignee = data.project.leadAssignee;
          let isLead = false;

          // Check if leadAssignee is an array (multiple lead assignees)
          if (Array.isArray(leadAssignee)) {
            isLead = leadAssignee.some((lead: any) => {
              if (!lead) return false;
              if (typeof lead === 'string') return lead === userId;
              if (lead._id) return lead._id.toString() === userId;
              return lead.toString() === userId;
            });
          } else if (leadAssignee) {
            // Single lead assignee (legacy support)
            if (typeof leadAssignee === 'string') {
              isLead = leadAssignee === userId;
            } else if (leadAssignee._id) {
              isLead = leadAssignee._id.toString() === userId;
            } else {
              isLead = leadAssignee.toString() === userId;
            }
          }
          setIsLeadAssignee(isLead);
          if (isLead) {
            checkNAStatus(projectId);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  };

  const fetchTasks = async (projectId: string) => {
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

    // Double-check: Verify task is actually assigned to current user before proceeding
    if (!session?.user?.id) {
      alert("Unable to verify user. Please refresh the page.");
      return;
    }

    const userIdStr = session.user.id.toString();
    let isAssigned = false;

    // Check assignedTo
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

    // Check assignees array
    if (!isAssigned && Array.isArray(task.assignees)) {
      isAssigned = task.assignees.some((assignee: any) => {
        const assigneeId = assignee?._id?.toString() || assignee?.toString() || assignee;
        return assigneeId === userIdStr;
      });
    }

    // If not assigned, don't proceed
    if (!isAssigned) {
      alert("You can only tick tasks assigned to you.");
      return;
    }

    // Check if all subtasks are completed before allowing task completion
    if (task.status !== "completed" && task.subtasks && task.subtasks.length > 0) {
      const completedSubtasks = task.subtasks.filter(s => s.ticked).length;
      const totalSubtasks = task.subtasks.length;
      
      if (completedSubtasks < totalSubtasks) {
        alert(`This task has ${totalSubtasks} subtasks. Complete all subtasks (${completedSubtasks}/${totalSubtasks}) before marking the task as done.`);
        return;
      }
    }

    const newStatus = task.status === "completed" ? "pending" : "completed";
    
    // If completing the task, ask for time spent (only if task is assigned to user)
    let timeSpent: number | undefined;
    if (newStatus === "completed" && isAssigned) {
      const timeInput = prompt("How many hours did you spend on this task?");
      if (timeInput === null) {
        return; // User cancelled
      }
      const parsedTime = parseFloat(timeInput);
      if (isNaN(parsedTime) || parsedTime < 0) {
        alert("Please enter a valid number of hours (e.g., 2.5 for 2 hours 30 minutes)");
        return;
      }
      timeSpent = parsedTime;
    }
    
    try {
      const requestBody: any = { status: newStatus };
      if (timeSpent !== undefined) {
        requestBody.timeSpent = timeSpent;
      }
      
      const response = await fetch(`/api/employee/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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

  const handleToggleNotApplicable = async (task: Task) => {
    // Only allow marking as not applicable if task is assigned to the employee
    if (task.canTick === false) {
      alert("You can only mark tasks assigned to you as not applicable.");
      return;
    }

    const currentNotApplicable = Boolean((task as any).notApplicable);
    const newNotApplicable = !currentNotApplicable;
    
    try {
      const response = await fetch(`/api/employee/tasks/${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notApplicable: newNotApplicable }),
      });

      if (response.ok) {
        // Optimistically update the UI
        setTasks((prevTasks) => {
          const updated = { ...prevTasks };
          Object.keys(updated).forEach((section) => {
            updated[section] = updated[section].map((t: Task) => {
              if (t._id === task._id) {
                return { ...t, notApplicable: newNotApplicable } as Task;
              }
              return t;
            });
          });
          return updated;
        });
        
        // Then refresh from server
        await fetchTasks(projectId!);
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/employee/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchTasks(projectId!);
      } else {
        const errorData = await response.json();
        console.error("Error deleting task:", errorData);
        alert(errorData.error || "Failed to delete task. You can only delete tasks you created.");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. Please try again.");
    }
  };

  // Check if all subtasks are completed before allowing task completion
  const handleTaskClick = (task: Task) => {
    setSelectedTaskForSubtasks(task);
    setShowSubtaskModal(true);
  };

  const handleSubtasksChange = async () => {
    // Refresh tasks when subtasks change
    if (projectId) {
      await fetchTasks(projectId);
    }
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      alert("Please enter a section name");
      return;
    }

    const sectionName = newSectionName.trim();
    
    // Check if section already exists
    if (sections.includes(sectionName)) {
      alert("Section already exists");
      return;
    }

    if (!projectId) {
      alert("No project selected");
      return;
    }

    try {
      // Save section to database
      const response = await fetch(`/api/admin/projects/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sectionName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create section");
      }

      // Add section to local state
      setSections([...sections, sectionName]);
      setTasks({
        ...tasks,
        [sectionName]: []
      });
      
      setShowSectionInput(false);
      setNewSectionName("");
    } catch (error) {
      console.error("Error creating section:", error);
      alert(error instanceof Error ? error.message : "Failed to create section");
    }
  };

  const handleDeleteSection = async (section: string) => {
    if (!isLeadAssignee) {
      alert("Only lead assignees can delete sections");
      return;
    }

    const sectionTasks = tasks[section] || [];
    const taskCount = sectionTasks.length;
    
    if (taskCount === 0) {
      // Section is empty, just remove it from state and database
      const confirmMessage = `Are you sure you want to delete the section "${section}"?`;
      if (!confirm(confirmMessage)) return;
      
      try {
        // Remove from database
        const response = await fetch(`/api/admin/projects/sections`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            sectionName: section,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete section");
        }

        setSections((prev) => prev.filter((s) => s !== section));
        setTasks((prev) => {
          const newTasks = { ...prev };
          delete newTasks[section];
          return newTasks;
        });
      } catch (error) {
        console.error("Error deleting section:", error);
        alert(error instanceof Error ? error.message : "Failed to delete section");
      }
      return;
    }

    const confirmMessage = `Are you sure you want to delete the section "${section}"?\n\nThis will delete ${taskCount} task${taskCount > 1 ? 's' : ''} in this section. This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      // Delete all tasks in the section
      const deletePromises = sectionTasks.map((task) =>
        fetch(`/api/employee/tasks/${task._id}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);
      
      // Remove section from database
      await fetch(`/api/admin/projects/sections`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sectionName: section,
        }),
      });
      
      // Remove section from state after deleting tasks
      setSections((prev) => prev.filter((s) => s !== section));
      setTasks((prev) => {
        const newTasks = { ...prev };
        delete newTasks[section];
        return newTasks;
      });
      
      await fetchTasks(projectId!);
    } catch (error) {
      console.error("Error deleting section:", error);
      alert("Error deleting section. Please try again.");
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

  // Skeleton Loader Component
  const TaskSkeleton = () => (
    <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-neutral-200 shadow-sm animate-pulse">
      <div className="flex-shrink-0">
        <div className="w-5 h-5 bg-neutral-200 rounded-full"></div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
        <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-neutral-200 rounded"></div>
          <div className="h-3 w-16 bg-neutral-200 rounded"></div>
          <div className="h-3 w-20 bg-neutral-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  const SectionSkeleton = () => (
    <div className="flex-shrink-0 w-80 min-w-[320px] bg-neutral-50 rounded-xl p-4 border border-neutral-200">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-neutral-200 rounded w-24 animate-pulse"></div>
      </div>
      <div className="space-y-2">
        <TaskSkeleton />
        <TaskSkeleton />
        <TaskSkeleton />
      </div>
    </div>
  );

  if (status === "loading") {
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
    <div className="min-h-screen bg-neutral-50 overflow-x-hidden">
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
              {/* NA Button for Lead Assignees */}
              {isLeadAssignee && (
                <button
                  onClick={handleToggleNA}
                  disabled={naLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                    isNA
                      ? "bg-orange-50 border-orange-300 text-orange-700"
                      : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  } ${naLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={isNA ? "Click to remove NA status" : "Mark as NA (Not Applicable) for today - No fine will be applied"}
                >
                  <span className="text-sm font-medium">{isNA ? "NA ✓" : "Mark NA"}</span>
                </button>
              )}
              {/* Quick Filter: Assigned to Me */}
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
                          <button
                            onClick={() => {
                              setViewMode("calendar");
                            }}
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

      {viewMode === "board" && (
        <div className="w-full overflow-x-auto overflow-y-visible" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
          <div className="inline-flex gap-4 p-6">
            {sections.map((section) => {
              const sectionTasks = tasks[section] || [];
              let filtered = filteredTasks(sectionTasks);

              return (
                <div key={section} className="flex-shrink-0 w-80 min-w-[320px] bg-neutral-50 rounded-xl p-4 border border-neutral-200 overflow-visible">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-4 group">
                    <h3 className="font-semibold text-neutral-700">
                      {section} {sectionTasks.length > 0 && `(${sectionTasks.length})`}
                    </h3>
                    {isLeadAssignee && (
                      <button
                        onClick={() => handleDeleteSection(section)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded transition-all"
                        title="Delete section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Section Tasks */}
                  <div className="space-y-2 min-h-[200px] overflow-visible">
                    {filtered.map((task) => (
                      editingTask?._id === task._id ? (
                        <div key={task._id} className="relative z-10">
                          <EmployeeTaskForm
                            task={task}
                            section={section}
                            projectId={projectId!}
                            projectName={selectedProject?.projectName || ""}
                            onSave={async () => {
                              setEditingTask(null);
                              await fetchTasks(projectId!);
                            }}
                            onCancel={() => setEditingTask(null)}
                          />
                        </div>
                      ) : (
                        <TaskItem
                          key={task._id}
                          task={task}
                          onToggleComplete={() => handleToggleComplete(task)}
                          onToggleNotApplicable={() => handleToggleNotApplicable(task)}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => handleDeleteTask(task._id)}
                          onTaskClick={() => handleTaskClick(task)}
                          getPriorityColor={getPriorityColor}
                          formatDate={formatDate}
                          isOverdue={isOverdue(task)}
                          currentUserId={session?.user?.id}
                          isLeadAssignee={isLeadAssignee}
                        />
                      )
                    ))}
                    {creatingTask === section && (
                      <div className="relative z-10">
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
                      </div>
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

            {/* Add Section Button - Board View */}
            {!loading && !showSectionInput && (
              <div className="flex-shrink-0 w-80 min-w-[320px]">
                <button
                  onClick={() => setShowSectionInput(true)}
                  className="w-full h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border-2 border-dashed border-neutral-300 hover:border-emerald-300 transition-all"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-sm font-medium">Add Section</span>
                </button>
              </div>
            )}

            {/* Section Input - Board View */}
            {showSectionInput && (
              <div className="flex-shrink-0 w-80 min-w-[320px] bg-white rounded-xl p-4 border-2 border-emerald-300 shadow-sm">
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
                    className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowSectionInput(false);
                      setNewSectionName("");
                    }}
                    className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "list" && (
        <div className="flex max-w-7xl mx-auto">
          <div className="flex-1 p-6">
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
                    {isLeadAssignee && (
                      <button
                        onClick={() => handleDeleteSection(section)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded transition-all"
                        title="Delete section"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Section Tasks */}
                  <div className="space-y-2 overflow-visible">
                    {filtered.map((task) => (
                      editingTask?._id === task._id ? (
                        <div key={task._id} className="relative z-10">
                          <EmployeeTaskForm
                            task={task}
                            section={section}
                            projectId={projectId!}
                            projectName={selectedProject?.projectName || ""}
                            onSave={async () => {
                              setEditingTask(null);
                              await fetchTasks(projectId!);
                            }}
                            onCancel={() => setEditingTask(null)}
                          />
                        </div>
                      ) : (
                        <TaskItem
                          key={task._id}
                          task={task}
                          onToggleComplete={() => handleToggleComplete(task)}
                          onToggleNotApplicable={() => handleToggleNotApplicable(task)}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => handleDeleteTask(task._id)}
                          onTaskClick={() => handleTaskClick(task)}
                          getPriorityColor={getPriorityColor}
                          formatDate={formatDate}
                          isOverdue={isOverdue(task)}
                          currentUserId={session?.user?.id}
                          isLeadAssignee={isLeadAssignee}
                        />
                      )
                    ))}
                    {creatingTask === section && (
                      <div className="relative z-10">
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
                      </div>
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

            {/* Add Section Button - List View */}
            {!loading && !showSectionInput && sections.length > 0 && (
              <div className="mb-8">
                <button
                  onClick={() => setShowSectionInput(true)}
                  className="w-full flex items-center justify-center gap-2 p-4 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl border-2 border-dashed border-neutral-300 hover:border-emerald-300 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">Add New Section</span>
                </button>
              </div>
            )}

            {/* Section Input - List View */}
            {showSectionInput && sections.length > 0 && (
              <div className="mb-8 p-4 bg-white rounded-xl border-2 border-emerald-300 shadow-sm">
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
                    className="flex-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium transition-colors"
                  >
                    Create Section
                  </button>
                  <button
                    onClick={() => {
                      setShowSectionInput(false);
                      setNewSectionName("");
                    }}
                    className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "calendar" && (
        <div className="max-w-7xl mx-auto p-6">
          <CalendarView
            tasks={Object.values(tasks).flat()}
            filteredTasks={filteredTasks}
            onTaskClick={(task) => setEditingTask(task)}
            getPriorityColor={getPriorityColor}
            formatDate={formatDate}
          />
        </div>
      )}

      {viewMode === "board" && loading && (
        <div className="w-full overflow-x-auto overflow-y-visible p-6">
          <div className="inline-flex gap-4">
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      )}

      {viewMode === "list" && loading && (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="h-6 bg-neutral-200 rounded w-48 animate-pulse mb-4"></div>
          <div className="space-y-2">
            <TaskSkeleton />
            <TaskSkeleton />
            <TaskSkeleton />
            <TaskSkeleton />
          </div>
        </div>
      )}

      {!loading && sections.length === 0 && !creatingTask && (
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

      {/* Subtask Modal */}
      {showSubtaskModal && selectedTaskForSubtasks && selectedProject && (
        <SubtaskModal
          isOpen={showSubtaskModal}
          onClose={() => {
            setShowSubtaskModal(false);
            setSelectedTaskForSubtasks(null);
          }}
          taskId={selectedTaskForSubtasks._id}
          taskTitle={selectedTaskForSubtasks.title}
          projectId={selectedProject._id}
          projectEmployees={projectEmployees}
          currentUserId={session?.user?.id || ""}
          isLeadAssignee={isLeadAssignee}
          isAdmin={false}
          onSubtasksChange={handleSubtasksChange}
        />
      )}

    </div>
  );
}

// Calendar View Component
function CalendarView({
  tasks,
  filteredTasks,
  onTaskClick,
  getPriorityColor,
  formatDate,
}: {
  tasks: Task[];
  filteredTasks: (tasks: Task[]) => Task[];
  onTaskClick: (task: Task) => void;
  getPriorityColor: (priority: number) => string;
  formatDate: (date?: string) => string;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());

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
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
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

// Task Item Component
function TaskItem({
  task,
  onToggleComplete,
  onToggleNotApplicable,
  onEdit,
  onDelete,
  onTaskClick,
  getPriorityColor,
  formatDate,
  isOverdue,
  currentUserId,
  isLeadAssignee,
}: {
  task: Task;
  onToggleComplete: () => void;
  onToggleNotApplicable?: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onTaskClick?: () => void;
  getPriorityColor: (priority: number) => string;
  formatDate: (date?: string) => string;
  isOverdue: boolean;
  currentUserId?: string;
  isLeadAssignee?: boolean;
}) {
  const isNotApplicable = Boolean((task as any).notApplicable);
  
  // Debug: log the task to see if notApplicable is present
  // console.log('Task:', task._id, 'notApplicable:', (task as any).notApplicable, 'isNotApplicable:', isNotApplicable);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 p-3 bg-white rounded-lg border border-neutral-200 shadow-sm group min-w-0 ${
        task.status === "completed" ? "opacity-70" : ""
      } ${isNotApplicable ? "bg-gray-50 border-gray-300" : ""} ${
        isOverdue ? "border-red-300 bg-red-50" : ""
      }`}
    >
      <div className="flex-shrink-0 flex items-center gap-0.5">
        <button 
          onClick={onToggleComplete} 
          disabled={task.canTick === false}
          title={task.canTick === false ? "You can only tick tasks assigned to you" : ""}
          className="flex-shrink-0"
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
        {onToggleNotApplicable && task.canTick !== false && task.status !== "completed" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleNotApplicable();
            }}
            className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
              isNotApplicable 
                ? "bg-purple-500 border-purple-600 text-white shadow-sm hover:bg-purple-600 active:bg-purple-700" 
                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100"
            }`}
            title={isNotApplicable ? "Mark as applicable (bonus/penalty will apply)" : "Mark as not applicable (bonus/penalty won't apply)"}
          >
            {isNotApplicable ? "✓" : "NA"}
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onTaskClick) onTaskClick();
            }}
            className={`font-medium text-neutral-800 text-left hover:underline cursor-pointer truncate ${
              task.status === "completed" ? "line-through text-neutral-500" : ""
            } ${isNotApplicable ? "text-gray-500" : ""}`}
          >
            {task.title}
          </button>
          {/* Subtask Indicator Badge */}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200" onClick={(e) => {
              e.stopPropagation();
              if (onTaskClick) onTaskClick();
            }}>
              <FileText className="w-3 h-3" />
              {task.subtasks.filter(s => s.ticked).length}/{task.subtasks.length}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-neutral-500 mt-0.5">{task.description}</p>
        )}
        
        <div className="flex items-center gap-2 text-xs mt-1 text-neutral-500 flex-wrap">
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
          {!isNotApplicable && task.bonusPoints && task.bonusPoints > 0 && (
            <span className="flex items-center gap-1 text-emerald-600">
              +{task.bonusPoints} pts
            </span>
          )}
          {!isNotApplicable && task.penaltyPoints && task.penaltyPoints > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              -{task.penaltyPoints} pts
            </span>
          )}
          {isNotApplicable && (
            <span className="flex items-center gap-1 text-gray-500 italic text-xs">
              Bonus/Penalty N/A
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-neutral-100 rounded transition-all"
          title="Edit task"
        >
          <Edit2 className="w-4 h-4 text-neutral-500" />
        </button>
        {onDelete && ((isLeadAssignee) || ((task as any).createdBy && currentUserId && (task as any).createdBy === currentUserId)) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Are you sure you want to delete this task?')) {
                onDelete();
              }
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded transition-all"
            title={isLeadAssignee ? "Delete task (lead assignee)" : "Delete task (only tasks you created)"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Employee Task Form Component
function EmployeeTaskForm({
  task,
  section,
  projectId,
  projectName,
  onSave,
  onCancel,
}: {
  task?: Task;
  section: string;
  projectId: string;
  projectName: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { data: session } = useSession();
  const isEditing = !!task;
  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    taskKind: (task?.taskKind || "one-time") as TaskKind,
    priority: task?.priority || 2,
    dueDate: task?.dueDate || "",
    dueTime: task?.dueTime || "",
    deadlineDate: task?.deadlineDate || "",
    deadlineTime: task?.deadlineTime || "",
    assignedTo: task?.assignedTo?._id || (task?.assignees?.[0] && typeof task.assignees[0] === 'object' ? task.assignees[0]._id : typeof task?.assignees?.[0] === 'string' ? task.assignees[0] : "") || "", // Employee ID to assign task to (empty = self)
    customRecurrence: (task as any)?.customRecurrence || {
      type: "daysOfWeek" as "daysOfWeek" | "daysOfMonth",
      daysOfWeek: [] as number[],
      daysOfMonth: [] as number[],
      recurring: false,
    },
    customFields: [] as Array<{ name: string; type: "number" | "string" | "boolean" | "date"; defaultValue?: any }>,
  });
  const [saving, setSaving] = useState(false);
  const [isLeadAssignee, setIsLeadAssignee] = useState(false);
  const [projectEmployees, setProjectEmployees] = useState<Array<{ _id: string; name: string; email: string }>>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const menuRefs = {
    priority: useRef<HTMLDivElement>(null),
    date: useRef<HTMLDivElement>(null),
    deadline: useRef<HTMLDivElement>(null),
    assign: useRef<HTMLDivElement>(null),
    type: useRef<HTMLDivElement>(null),
  };
  const buttonRefs = {
    priority: useRef<HTMLButtonElement>(null),
    date: useRef<HTMLButtonElement>(null),
    deadline: useRef<HTMLButtonElement>(null),
    assign: useRef<HTMLButtonElement>(null),
    type: useRef<HTMLButtonElement>(null),
  };

  const fetchProjectInfo = async () => {
    if (!projectId || !session?.user?.id) return;
    
    setLoadingEmployees(true);
    try {
      // Fetch project to check if user is lead assignee
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      const projectData = await projectResponse.json();
      
      if (projectResponse.ok && projectData.project) {
        const project = projectData.project;
        const userId = session.user.id;
        
        // Check if user is lead assignee
        let isLead = false;
        let leadId: string | undefined;
        if (project.leadAssignee) {
          // Check if leadAssignee is an array (multiple lead assignees)
          if (Array.isArray(project.leadAssignee)) {
            isLead = project.leadAssignee.some((lead: any) => {
              if (!lead) return false;
              const id = typeof lead === 'object' && lead._id ? lead._id.toString() : (typeof lead === 'string' ? lead : lead.toString());
              return id === userId;
            });
          } else {
            // Single lead assignee (legacy support)
            if (typeof project.leadAssignee === 'object' && project.leadAssignee._id) {
              leadId = project.leadAssignee._id.toString();
            } else if (typeof project.leadAssignee === 'object') {
              leadId = project.leadAssignee.toString();
            } else {
              leadId = project.leadAssignee.toString();
            }
            isLead = leadId === userId;
          }
        }
        setIsLeadAssignee(isLead);

        // If lead assignee, fetch employees assigned to this project
        if (isLead) {
          const employees: Array<{ _id: string; name: string; email: string }> = [];
          
          // Add lead assignee
          if (project.leadAssignee) {
            const lead = typeof project.leadAssignee === 'object' 
              ? project.leadAssignee 
              : { _id: leadId || '', name: 'Lead Assignee', email: '' };
            employees.push({
              _id: lead._id?.toString() || leadId || '',
              name: lead.name || 'Lead Assignee',
              email: lead.email || ''
            });
          }

          // Add VA incharges (can be array or single)
          if (project.vaIncharge) {
            const vaList = Array.isArray(project.vaIncharge) ? project.vaIncharge : [project.vaIncharge];
            vaList.forEach((va: any) => {
              const vaObj = typeof va === 'object' && va._id
                ? va
                : { _id: va, name: 'VA Incharge', email: '' };
              const vaId = vaObj._id?.toString() || va.toString();
              if (!employees.find(e => e._id === vaId)) {
                employees.push({
                  _id: vaId,
                  name: vaObj.name || 'VA Incharge',
                  email: vaObj.email || ''
                });
              }
            });
          }

          // Add assignees
          if (project.assignees && Array.isArray(project.assignees)) {
            project.assignees.forEach((assignee: any) => {
              const assigneeId = typeof assignee === 'object' ? assignee._id?.toString() || assignee._id : assignee.toString();
              const assigneeName = typeof assignee === 'object' ? assignee.name : 'Employee';
              const assigneeEmail = typeof assignee === 'object' ? assignee.email : '';
              
              // Avoid duplicates
              if (!employees.find(e => e._id === assigneeId)) {
                employees.push({
                  _id: assigneeId,
                  name: assigneeName,
                  email: assigneeEmail
                });
              }
            });
          }

          setProjectEmployees(employees);
        }
      }
    } catch (error) {
      console.error('Error fetching project info:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchProjectInfo();
  }, [projectId, session?.user?.id]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (openMenu === "priority" && menuRefs.priority.current && buttonRefs.priority.current &&
          !menuRefs.priority.current.contains(target) && !buttonRefs.priority.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "date" && menuRefs.date.current && buttonRefs.date.current &&
          !menuRefs.date.current.contains(target) && !buttonRefs.date.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "deadline" && menuRefs.deadline.current && buttonRefs.deadline.current &&
          !menuRefs.deadline.current.contains(target) && !buttonRefs.deadline.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "assign" && menuRefs.assign.current && buttonRefs.assign.current &&
          !menuRefs.assign.current.contains(target) && !buttonRefs.assign.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "type" && menuRefs.type.current && buttonRefs.type.current &&
          !menuRefs.type.current.contains(target) && !buttonRefs.type.current.contains(target)) {
        setOpenMenu(null);
      }
    };

    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenu]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert("Please enter a task title");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && task) {
        // Update existing task
        const response = await fetch(`/api/employee/tasks/${task._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            dueDate: formData.dueDate || undefined,
            dueTime: formData.dueTime || undefined,
            deadlineDate: formData.deadlineDate || undefined,
            deadlineTime: formData.deadlineTime || undefined,
            taskKind: formData.taskKind,
            customRecurrence: formData.taskKind === "custom" ? formData.customRecurrence : undefined,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          onSave();
        } else {
          alert(data.error || "Failed to update task");
        }
      } else {
        // Create new task
        const response = await fetch("/api/employee/tasks/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            projectName,
            section,
            ...formData,
            assignedTo: formData.assignedTo || undefined, // Only send if selected
            deadlineDate: formData.deadlineDate || undefined,
            deadlineTime: formData.deadlineTime || undefined,
            customRecurrence: formData.taskKind === "custom" ? formData.customRecurrence : undefined,
            customFields: (formData.customFields || []).filter((f) => f.name && f.name.trim() !== ""),
          }),
        });

        const data = await response.json();
        if (response.ok) {
          onSave();
        } else {
          alert(data.error || "Failed to create task");
        }
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} task:`, error);
      alert(`Failed to ${isEditing ? 'update' : 'create'} task. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return "text-red-500";
    if (priority <= 4) return "text-orange-500";
    if (priority <= 6) return "text-yellow-500";
    return "text-green-500";
  };

  const formatDateDisplay = () => {
    if (!formData.dueDate && !formData.dueTime) return null;
    if (formData.dueDate && formData.dueTime) {
      const dateObj = new Date(`${formData.dueDate}T${formData.dueTime}`);
      return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + formData.dueTime;
    }
    if (formData.dueDate) {
      const dateObj = new Date(formData.dueDate);
      return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    }
    return formData.dueTime;
  };

  const getTaskTypeLabel = (kind: TaskKind) => {
    const labels: Record<TaskKind, string> = {
      "one-time": "One-time",
      "daily": "Daily",
      "weekly": "Weekly",
      "monthly": "Monthly",
      "recurring": "Recurring",
      "custom": "Custom",
    };
    return labels[kind] || kind;
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-3">
      {/* Task Title */}
      <input
        type="text"
        placeholder="Task name"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        className="w-full bg-transparent border-none outline-none text-sm font-medium text-neutral-900 placeholder:text-neutral-400 mb-2"
        autoFocus
      />

      {/* Description */}
      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        rows={2}
        className="w-full bg-transparent border-none outline-none text-xs text-neutral-600 placeholder:text-neutral-400 resize-none mb-3"
      />

      {/* Icon Buttons Row */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Priority Icon */}
        <div className="relative">
          <button
            ref={buttonRefs.priority}
            type="button"
            onClick={() => setOpenMenu(openMenu === "priority" ? null : "priority")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
              formData.priority ? "bg-emerald-50 text-emerald-700" : "text-neutral-500"
            }`}
          >
            <Flag className={`w-3.5 h-3.5 ${formData.priority ? getPriorityColor(formData.priority) : ""}`} />
            {formData.priority > 0 && <span className="font-medium">P{formData.priority}</span>}
          </button>
          {openMenu === "priority" && (
            <div
              ref={menuRefs.priority}
              className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 min-w-[140px] max-h-[300px] overflow-y-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, priority: p });
                    setOpenMenu(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 flex items-center gap-2 ${
                    formData.priority === p ? "bg-emerald-50 text-emerald-700" : "text-neutral-700"
                  }`}
                >
                  <Flag className={`w-3 h-3 ${getPriorityColor(p)}`} />
                  <span>Priority {p}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Due Date/Time Icon */}
        <div className="relative">
          <button
            ref={buttonRefs.date}
            type="button"
            onClick={() => setOpenMenu(openMenu === "date" ? null : "date")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
              formData.dueDate || formData.dueTime ? "bg-blue-50 text-blue-700" : "text-neutral-500"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {formatDateDisplay() ? (
              <span className="font-medium">{formatDateDisplay()}</span>
            ) : (
              <span>Due date</span>
            )}
          </button>
          {openMenu === "date" && (
            <div
              ref={menuRefs.date}
              className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 p-3 min-w-[200px]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-neutral-600 mb-1 block">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-white border border-neutral-300 rounded px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600 mb-1 block">Due Time</label>
                  <input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                    className="w-full bg-white border border-neutral-300 rounded px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Task Type Icon */}
        <div className="relative">
          <button
            ref={buttonRefs.type}
            type="button"
            onClick={() => setOpenMenu(openMenu === "type" ? null : "type")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
              formData.taskKind !== "one-time" ? "bg-purple-50 text-purple-700" : "text-neutral-500"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{getTaskTypeLabel(formData.taskKind)}</span>
          </button>
          {openMenu === "type" && (
            <div
              ref={menuRefs.type}
              className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 min-w-[120px]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {(["one-time", "daily", "weekly", "monthly", "custom"] as TaskKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, taskKind: kind });
                    if (kind === "custom") {
                      setShowCustomRecurrence(true);
                    }
                    setOpenMenu(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${
                    formData.taskKind === kind ? "bg-purple-50 text-purple-700" : "text-neutral-700"
                  }`}
                >
                  {getTaskTypeLabel(kind)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Deadline Date/Time Icon */}
        <div className="relative">
          <button
            ref={buttonRefs.deadline}
            type="button"
            onClick={() => setOpenMenu(openMenu === "deadline" ? null : "deadline")}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
              formData.deadlineDate ? "bg-red-50 text-red-700" : "text-neutral-500"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {formData.deadlineDate ? (
              <span className="font-medium">
                {new Date(formData.deadlineDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                {formData.deadlineTime && ` ${formData.deadlineTime}`}
              </span>
            ) : (
              <span>Deadline</span>
            )}
          </button>
          {openMenu === "deadline" && (
            <div
              ref={menuRefs.deadline}
              className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 p-3 min-w-[200px]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-neutral-600 mb-1 block">Deadline Date</label>
                  <input
                    type="date"
                    value={formData.deadlineDate}
                    onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value })}
                    className="w-full bg-white border border-neutral-300 rounded px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600 mb-1 block">Deadline Time</label>
                  <input
                    type="time"
                    value={formData.deadlineTime}
                    onChange={(e) => setFormData({ ...formData, deadlineTime: e.target.value })}
                    className="w-full bg-white border border-neutral-300 rounded px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Assign To Icon (only for lead assignee) */}
        {isLeadAssignee && projectEmployees.length > 0 && (
          <div className="relative">
            <button
              ref={buttonRefs.assign}
              type="button"
              onClick={() => setOpenMenu(openMenu === "assign" ? null : "assign")}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
                formData.assignedTo ? "bg-orange-50 text-orange-700" : "text-neutral-500"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {formData.assignedTo ? (
                <span className="font-medium">
                  {projectEmployees.find(e => e._id === formData.assignedTo)?.name || "Assigned"}
                </span>
              ) : (
                <span>Assign</span>
              )}
            </button>
            {openMenu === "assign" && (
              <div
                ref={menuRefs.assign}
                className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 min-w-[180px] max-h-[200px] overflow-y-auto"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, assignedTo: "" });
                    setOpenMenu(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${
                    !formData.assignedTo ? "bg-orange-50 text-orange-700" : "text-neutral-700"
                  }`}
                >
                  Myself ({session?.user?.name || "You"})
                </button>
                {projectEmployees
                  .filter(emp => emp._id && emp._id !== session?.user?.id)
                  .map((emp) => (
                    <button
                      key={emp._id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, assignedTo: emp._id });
                        setOpenMenu(null);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${
                        formData.assignedTo === emp._id ? "bg-orange-50 text-orange-700" : "text-neutral-700"
                      }`}
                    >
                      {emp.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Recurrence Modal */}
      {showCustomRecurrence && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[9999]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCustomRecurrence(false);
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Custom Recurrence</h3>
            
            {/* Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Recurrence Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      customRecurrence: {
                        type: "daysOfWeek",
                        daysOfWeek: formData.customRecurrence?.daysOfWeek ?? [],
                        daysOfMonth: [],
                        recurring: formData.customRecurrence?.recurring ?? false
                      }
                    })
                  }
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.customRecurrence?.type === "daysOfWeek"
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  Days of Week
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      customRecurrence: {
                        type: "daysOfMonth",
                        daysOfWeek: [],
                        daysOfMonth: formData.customRecurrence?.daysOfMonth ?? [],
                        recurring: formData.customRecurrence?.recurring ?? false
                      }
                    })
                  }
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.customRecurrence?.type === "daysOfMonth"
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  Days of Month
                </button>
              </div>
            </div>

            {/* Days Selection */}
            {formData.customRecurrence?.type === "daysOfWeek" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Select Days</label>
                <div className="grid grid-cols-7 gap-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        const days = formData.customRecurrence?.daysOfWeek ?? [];
                        const newDays = days.includes(index)
                          ? days.filter((d: number) => d !== index)
                          : [...days, index].sort((a: number, b: number) => a - b);
                        setFormData({
                          ...formData,
                          customRecurrence: {
                            ...formData.customRecurrence!,
                            daysOfWeek: newDays
                          }
                        });
                      }}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                        formData.customRecurrence?.daysOfWeek?.includes(index)
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.customRecurrence?.type === "daysOfMonth" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Select Dates</label>
                <div className="grid grid-cols-7 gap-2 max-h-48 overflow-y-auto">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const days = formData.customRecurrence?.daysOfMonth ?? [];
                        const newDays = days.includes(day)
                          ? days.filter((d: number) => d !== day)
                          : [...days, day].sort((a: number, b: number) => a - b);
                        setFormData({
                          ...formData,
                          customRecurrence: {
                            ...formData.customRecurrence!,
                            daysOfMonth: newDays
                          }
                        });
                      }}
                      className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                        formData.customRecurrence?.daysOfMonth?.includes(day)
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recurring Checkbox */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.customRecurrence?.recurring ?? false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customRecurrence: {
                        type: formData.customRecurrence?.type ?? "daysOfWeek",
                        daysOfWeek: formData.customRecurrence?.daysOfWeek ?? [],
                        daysOfMonth: formData.customRecurrence?.daysOfMonth ?? [],
                        recurring: e.target.checked
                      }
                    })
                  }
                  className="w-4 h-4 text-emerald-600"
                />
                <span className="text-sm text-neutral-700">
                  {formData.customRecurrence?.type === "daysOfWeek"
                    ? "Repeat every week on selected days"
                    : "Repeat every month on selected dates"}
                </span>
              </label>
              <p className="text-xs text-neutral-500 mt-1 ml-6">
                {formData.customRecurrence?.recurring
                  ? "Task will reset weekly/monthly"
                  : "Task will reset only once"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCustomRecurrence(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowCustomRecurrence(false)}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-neutral-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 text-xs font-medium"
        >
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Task"}
        </button>
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

