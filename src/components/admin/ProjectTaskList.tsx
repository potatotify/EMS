"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
  FileText,
  MoreHorizontal,
  Play,
  Calendar,
  Folder,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SubtaskModal from "@/components/admin/SubtaskModal";
import { useSession } from "next-auth/react";

type TaskKind = "one-time" | "daily" | "weekly" | "monthly" | "recurring" | "custom";
type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
type ViewMode = "list" | "board" | "calendar";
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
  bonusCurrency?: number;
  penaltyPoints?: number;
  penaltyCurrency?: number;
  status: TaskStatus;
  completedAt?: string;
  completedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  tickedAt?: string;
  timeSpent?: number; // Time spent on task in hours
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
  customRecurrence?: {
    type: "daysOfWeek" | "daysOfMonth";
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    recurring: boolean;
  };
}

interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  clientProgress?: number;
  leadAssignee?: any | any[]; // Can be ObjectId, populated object, or array of both
  vaIncharge?: any; // Can be ObjectId or populated object
  updateIncharge?: any; // Can be ObjectId or populated object
  assignees?: any[]; // Array of assignees
}

interface Employee {
  _id: string;
  name: string;
  email?: string;
  fullName?: string;
  userId?: string;
}

export default function ProjectTaskList() {
  const { data: session } = useSession();
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
  
  // Subtask modal state
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [selectedTaskForSubtasks, setSelectedTaskForSubtasks] = useState<Task | null>(null);
  const [isCurrentUserLeadAssignee, setIsCurrentUserLeadAssignee] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is admin or lead assignee
  useEffect(() => {
    if (session?.user) {
      const userRole = session.user.role;
      setIsAdmin(userRole === 'admin');
    }
  }, [session]);

  // Check if user is lead assignee for selected project
  useEffect(() => {
    if (!selectedProject || !session?.user?.id) {
      setIsCurrentUserLeadAssignee(false);
      return;
    }

    const userId = session.user.id;
    const leadAssignee = selectedProject.leadAssignee;

    // Check if leadAssignee is an array (multiple lead assignees)
    if (Array.isArray(leadAssignee)) {
      const isLead = leadAssignee.some((lead: any) => {
        if (!lead) return false;
        if (typeof lead === 'string') return lead === userId;
        if (lead._id) return lead._id.toString() === userId;
        return lead.toString() === userId;
      });
      setIsCurrentUserLeadAssignee(isLead);
    } else if (leadAssignee) {
      // Single lead assignee (legacy support)
      if (typeof leadAssignee === 'string') {
        setIsCurrentUserLeadAssignee(leadAssignee === userId);
      } else if (leadAssignee._id) {
        setIsCurrentUserLeadAssignee(leadAssignee._id.toString() === userId);
      } else {
        setIsCurrentUserLeadAssignee(leadAssignee.toString() === userId);
      }
    } else {
      setIsCurrentUserLeadAssignee(false);
    }
  }, [selectedProject, session]);

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
    const leadAssignee = project.leadAssignee;
    if (Array.isArray(leadAssignee)) {
      // Multiple lead assignees
      leadAssignee.forEach((lead: any) => {
        const leadId = getAssigneeId(lead);
        if (leadId) assigneeIds.add(leadId);
      });
    } else if (leadAssignee) {
      // Single lead assignee (legacy support)
      const leadId = getAssigneeId(leadAssignee);
      if (leadId) assigneeIds.add(leadId);
    }
    // Handle vaIncharge (can be array or single)
    if (project.vaIncharge) {
      if (Array.isArray(project.vaIncharge)) {
        project.vaIncharge.forEach((va: any) => {
          const vaId = getAssigneeId(va);
          if (vaId) assigneeIds.add(vaId);
        });
      } else {
        const vaId = getAssigneeId(project.vaIncharge);
        if (vaId) assigneeIds.add(vaId);
      }
    }
    const updateId = getAssigneeId(project.updateIncharge);
    if (updateId) assigneeIds.add(updateId);

    // Add all assignees from the assignees array
    if (project.assignees && Array.isArray(project.assignees)) {
      project.assignees.forEach((assignee: any) => {
        const assigneeId = getAssigneeId(assignee);
        if (assigneeId) assigneeIds.add(assigneeId);
      });
    }

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
      // First, reset any recurring tasks that need to be reset
      try {
        await fetch("/api/tasks/reset-recurring?scope=all", {
          method: "POST",
        });
      } catch (error) {
        console.error("Error resetting recurring tasks:", error);
        // Continue even if reset fails
      }

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
      bonusCurrency: 0,
      penaltyPoints: 0,
      penaltyCurrency: 0,
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
      console.log("Task ID:", taskId);
      
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
          console.log("Response data:", data);
        } catch (jsonError) {
          console.error("Failed to parse JSON response:", jsonError);
          const text = await response.text();
          console.error("Response text:", text);
          alert(`Failed to parse response: ${text.substring(0, 200)}`);
          return;
        }
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        alert(`Failed to update task: ${response.status} ${response.statusText}\n${text.substring(0, 200)}`);
        return;
      }

      if (response.ok) {
        console.log("Task updated successfully:", data);
        await fetchTasks(selectedProjectId!);
        setEditingTask(null);
      } else {
        console.error("Error updating task - Status:", response.status);
        console.error("Error updating task - Data:", JSON.stringify(data, null, 2));
        const errorMessage = data?.error || data?.message || data?.details || `Failed to update task (${response.status})`;
        alert(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error updating task - Exception:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      const errorMessage = error instanceof Error ? error.message : "Failed to update task. Please try again.";
      alert(`Error: ${errorMessage}`);
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

  // Check if all subtasks are completed before allowing task completion
  const checkSubtasksCompletion = async (taskId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/subtasks/check-completion?taskId=${taskId}`);
      const data = await response.json();
      
      if (response.ok) {
        if (!data.canComplete) {
          alert(`This task has ${data.totalSubtasks} subtasks. Complete all subtasks (${data.completedSubtasks}/${data.totalSubtasks}) before marking the task as done.`);
          return false;
        }
        return true;
      }
      // If API fails, allow task completion (fail gracefully)
      return true;
    } catch (error) {
      console.error('Error checking subtask completion:', error);
      // Fail gracefully - allow task completion if check fails
      return true;
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    // If marking as complete, check if all subtasks are completed
    if (task.status !== 'completed') {
      const canComplete = await checkSubtasksCompletion(task._id);
      if (!canComplete) {
        return; // Don't proceed with completion
      }
    }

    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    try {
      const response = await fetch(`/api/admin/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchTasks(selectedProjectId!);
      }
    } catch (error) {
      console.error('Error toggling task status:', error);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskForSubtasks(task);
    setShowSubtaskModal(true);
  };

  const handleSubtasksChange = async () => {
    // Refresh tasks when subtasks change
    if (selectedProjectId) {
      await fetchTasks(selectedProjectId);
    }
  };

  const handleDeleteSection = async (section: string) => {
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
            projectId: selectedProjectId,
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
        fetch(`/api/admin/tasks/${task._id}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);
      
      // Remove section from database
      await fetch(`/api/admin/projects/sections`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
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
      
      await fetchTasks(selectedProjectId!);
    } catch (error) {
      console.error("Error deleting section:", error);
      alert("Error deleting section. Please try again.");
    }
  };

  const handleToggleComplete = async (task: Task) => {
    await handleToggleTaskStatus(task);
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim() || !selectedProjectId) return;

    const sectionName = newSectionName.trim();
    
    // Add the new section to the sections list without creating a task
    // Check if section already exists
    if (sections.includes(sectionName)) {
      alert("Section already exists");
      return;
    }
    
    try {
      // Save section to database
      const response = await fetch(`/api/admin/projects/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          sectionName,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create section");
      }

      // Add empty section to state
      setSections((prev) => [...prev, sectionName]);
      setTasks((prev) => ({
        ...prev,
        [sectionName]: []
      }));
      
      setNewSectionName("");
      setShowSectionInput(false);
    } catch (error) {
      console.error("Error creating section:", error);
      alert(error instanceof Error ? error.message : "Failed to create section");
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

  // Skeleton Loader Components
  const TaskSkeleton = () => (
    <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-neutral-200 shadow-sm animate-pulse">
      <div className="shrink-0">
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
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-neutral-900">{project.projectName}</div>
                    <div className="text-sm text-neutral-500">{project.clientName}</div>
                  </div>
                </div>
                {project.clientProgress !== undefined ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-linear-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-300"
                        style={{width: `${project.clientProgress}%`}}
                      />
                    </div>
                    <span className="text-xs font-semibold text-neutral-700 w-10 text-right">
                      {project.clientProgress}%
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400">Progress not set</div>
                )}
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

      {viewMode === "board" && loading && (
        <div className="w-full overflow-x-auto" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
          <div className="inline-flex gap-1 pl-1 pr-2 py-2">
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      )}

      {viewMode === "board" && !loading && (
        <div className="w-full overflow-x-auto" style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
          <div className="inline-flex gap-1 pl-1 pr-2 py-2">
            {sections.map((section) => {
              const sectionTasks = tasks[section] || [];
              let filtered = filteredTasks(sectionTasks);
              
              return (
                <div key={section} className="shrink-0 w-72 bg-neutral-50 rounded-lg p-2 border border-neutral-200 overflow-visible">
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
                  <div className="space-y-1 min-h-[150px] overflow-visible">
                    {filtered.map((task) => (
                      <div key={task._id} className={editingTask?._id === task._id ? "relative z-9999" : "relative"}>
                        <TaskItem
                          task={task}
                          employees={employees}
                          isEditing={editingTask?._id === task._id}
                          onEdit={() => setEditingTask(task)}
                          onSave={(updates) => handleUpdateTask(task._id, updates)}
                          onCancel={() => setEditingTask(null)}
                          onDelete={() => handleDeleteTask(task._id)}
                          onToggleComplete={() => handleToggleComplete(task)}
                          onTaskClick={() => handleTaskClick(task)}
                          getPriorityColor={getPriorityColor}
                          formatDate={formatDate}
                          isOverdue={isOverdue(task)}
                          isAdmin={isAdmin}
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
            {!loading && (
              <div className="shrink-0">
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
                      className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 text-xs font-medium transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSectionInput(true)}
                  className="w-72 h-12 flex items-center justify-center gap-2 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border-2 border-dashed border-neutral-300 hover:border-emerald-300 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add section</span>
                </button>
              )}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "list" && loading && (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="mb-8">
            <div className="h-6 bg-neutral-200 rounded w-48 animate-pulse mb-4"></div>
            <div className="space-y-2">
              <TaskSkeleton />
              <TaskSkeleton />
              <TaskSkeleton />
              <TaskSkeleton />
            </div>
          </div>
        </div>
      )}

      {viewMode === "list" && !loading && (
        <div className="flex max-w-7xl mx-auto">
          <div className="flex-1 p-2">
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
                        onTaskClick={() => handleTaskClick(task)}
                        getPriorityColor={getPriorityColor}
                        formatDate={formatDate}
                        isOverdue={isOverdue(task)}
                        isAdmin={isAdmin}
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

            {/* Add Section - Only show in List view */}
            {viewMode === "list" && !loading && (
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
          </div>
        </div>
      )}

      {viewMode === "calendar" && (
        <div className="max-w-7xl mx-auto p-6">
          <CalendarView
            tasks={Object.values(tasks).flat()}
            filteredTasks={filteredTasks}
            onTaskClick={(task) => {
              const taskInSection = Object.entries(tasks).find(([_, taskList]) =>
                taskList.some(t => t._id === task._id)
              );
              if (taskInSection) {
                setEditingTask(task);
              }
            }}
            getPriorityColor={getPriorityColor}
            formatDate={formatDate}
          />
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
          projectEmployees={employees}
          currentUserId={session?.user?.id || ""}
          isAdmin={isAdmin}
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
  employees,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onToggleComplete,
  onTaskClick,
  getPriorityColor,
  formatDate,
  isOverdue,
  isAdmin,
}: {
  task: Task;
  employees: Employee[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<Task>) => void;
  onCancel: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onTaskClick?: () => void;
  getPriorityColor: (priority: number) => string;
  formatDate: (date?: string) => string;
  isOverdue: boolean;
  isAdmin: boolean;
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
    bonusCurrency: task.bonusCurrency,
    penaltyPoints: task.penaltyPoints,
    penaltyCurrency: task.penaltyCurrency,
    customFields: task.customFields && Array.isArray(task.customFields) ? [...task.customFields] : [],
    customRecurrence: task.customRecurrence || {
      type: "daysOfWeek",
      daysOfWeek: [],
      daysOfMonth: [],
      recurring: true
    },
  });

  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRefs = {
    priority: useRef<HTMLDivElement>(null),
    date: useRef<HTMLDivElement>(null),
    assign: useRef<HTMLDivElement>(null),
    type: useRef<HTMLDivElement>(null),
    section: useRef<HTMLDivElement>(null),
    more: useRef<HTMLDivElement>(null),
  };
  const buttonRefs = {
    priority: useRef<HTMLButtonElement>(null),
    date: useRef<HTMLButtonElement>(null),
    assign: useRef<HTMLButtonElement>(null),
    type: useRef<HTMLButtonElement>(null),
    section: useRef<HTMLButtonElement>(null),
    more: useRef<HTMLButtonElement>(null),
  };

  // Update formData when task changes (e.g., after save)
  useEffect(() => {
    if (task.customFields && Array.isArray(task.customFields)) {
      setFormData((prev) => ({
        ...prev,
        customFields: [...task.customFields!],
      }));
    }
  }, [task.customFields]);

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
      if (openMenu === "assign" && menuRefs.assign.current && buttonRefs.assign.current &&
          !menuRefs.assign.current.contains(target) && !buttonRefs.assign.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "type" && menuRefs.type.current && buttonRefs.type.current &&
          !menuRefs.type.current.contains(target) && !buttonRefs.type.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "section" && menuRefs.section.current && buttonRefs.section.current &&
          !menuRefs.section.current.contains(target) && !buttonRefs.section.current.contains(target)) {
        setOpenMenu(null);
      }
      if (openMenu === "more" && menuRefs.more.current && buttonRefs.more.current &&
          !menuRefs.more.current.contains(target) && !buttonRefs.more.current.contains(target)) {
        setOpenMenu(null);
      }
    };

    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenu]);

  const handleSave = () => {
    // Ensure assignedDate and assignedTime have defaults if empty
    const now = new Date();
    const defaultDate = now.toISOString().split("T")[0];
    const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    
    // Extract ID from assignedTo (it might be an object or a string)
    const assignedToId = formData.assignedTo 
      ? (typeof formData.assignedTo === 'string' 
          ? formData.assignedTo 
          : (formData.assignedTo as any)?._id || formData.assignedTo)
      : undefined;
    
    // Ensure only one employee is assigned - send as array of IDs
    const assignees = assignedToId ? [assignedToId] : [];
    
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
    
    // Clean up date fields - remove empty strings and convert to undefined
    const cleanDateField = (date: string | undefined) => {
      if (!date || date.trim() === "") return undefined;
      return date;
    };

    const dataToSave = {
      ...formData,
      assignedDate: cleanDateField(formData.assignedDate) || defaultDate,
      assignedTime: formData.assignedTime || defaultTime,
      dueDate: cleanDateField(formData.dueDate),
      dueTime: formData.dueTime || undefined,
      deadlineDate: cleanDateField(formData.deadlineDate),
      deadlineTime: formData.deadlineTime || undefined,
      assignedTo: assignedToId, // Send only the ID string
      assignees: assignees, // Only one employee allowed - array of ID strings
      customFields: validCustomFields.length > 0 ? validCustomFields : undefined,
    };
    
    console.log("Saving task with customFields:", dataToSave.customFields);
    onSave(dataToSave);
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

  // Render modal and task card together
  return (
    <>
      {isEditing ? (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-3">
        {/* Task Title */}
        <input
          type="text"
          placeholder="Task name"
          value={formData.title || ""}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full bg-transparent border-none outline-none text-sm font-medium text-neutral-900 placeholder:text-neutral-400 mb-2"
          autoFocus
        />

        {/* Description */}
        <textarea
          placeholder="Description"
          value={formData.description || ""}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="w-full bg-transparent border-none outline-none text-xs text-neutral-600 placeholder:text-neutral-400 resize-none mb-3"
        />

        {/* Icon Buttons Row */}
        <div className="flex items-center gap-1 flex-wrap relative overflow-visible">
          {/* Priority Icon */}
          <div className="relative overflow-visible">
            <button
              ref={buttonRefs.priority}
              type="button"
              onClick={() => setOpenMenu(openMenu === "priority" ? null : "priority")}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
                formData.priority ? "bg-emerald-50 text-emerald-700" : "text-neutral-500"
              }`}
            >
              <Flag className={`w-3.5 h-3.5 ${formData.priority ? getPriorityColor(formData.priority || 2) : ""}`} />
              {formData.priority && formData.priority > 0 && <span className="font-medium">P{formData.priority}</span>}
            </button>
            {openMenu === "priority" && (
              <div
                ref={menuRefs.priority}
                className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl z-9999 min-w-[140px]"
                onMouseDown={(e) => e.stopPropagation()}
                style={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch'
                }}
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
                      value={formData.dueDate ? new Date(formData.dueDate).toISOString().split("T")[0] : ""}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
                      className="w-full bg-white border border-neutral-300 rounded px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-600 mb-1 block">Due Time</label>
                    <input
                      type="time"
                      value={formData.dueTime || ""}
                      onChange={(e) => setFormData({ ...formData, dueTime: e.target.value || undefined })}
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
              <span>{getTaskTypeLabel(formData.taskKind || "one-time")}</span>
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

          {/* Assign To Icon */}
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
                <span className="font-medium">{formData.assignedTo.name || "Assigned"}</span>
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
                    setFormData({ ...formData, assignedTo: undefined, assignees: [] });
                    setOpenMenu(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${
                    !formData.assignedTo ? "bg-orange-50 text-orange-700" : "text-neutral-700"
                  }`}
                >
                  No employee assigned
                </button>
                {employees.map((emp) => (
                  <button
                    key={emp._id}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        assignedTo: {
                          _id: emp._id,
                          name: emp.name,
                          email: emp.email || ''
                        },
                        assignees: [emp._id],
                      });
                      setOpenMenu(null);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 ${
                      formData.assignedTo?._id === emp._id ? "bg-orange-50 text-orange-700" : "text-neutral-700"
                    }`}
                  >
                    {emp.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section Icon */}
          <div className="relative">
            <button
              ref={buttonRefs.section}
              type="button"
              onClick={() => setOpenMenu(openMenu === "section" ? null : "section")}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
                formData.section ? "bg-indigo-50 text-indigo-700" : "text-neutral-500"
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              {formData.section ? (
                <span className="font-medium">{formData.section}</span>
              ) : (
                <span>Section</span>
              )}
            </button>
            {openMenu === "section" && (
              <div
                ref={menuRefs.section}
                className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 p-2 min-w-[200px]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  placeholder="Section name"
                  value={formData.section || ""}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full bg-white border border-neutral-300 rounded px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setOpenMenu(null);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* More Options Icon */}
          <div className="relative">
            <button
              ref={buttonRefs.more}
              type="button"
              onClick={() => setOpenMenu(openMenu === "more" ? null : "more")}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs ${
                formData.bonusPoints || formData.penaltyPoints || (formData.customFields && formData.customFields.length > 0) ? "bg-gray-50 text-gray-700" : "text-neutral-500"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>More</span>
            </button>
            {openMenu === "more" && (
              <div
                ref={menuRefs.more}
                className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 p-3 min-w-[280px] max-h-[400px] overflow-y-auto"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="space-y-3">
                  {/* Assigned Date/Time */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Assigned Date</label>
                      <input
                        type="date"
                        value={formData.assignedDate ? new Date(formData.assignedDate).toISOString().split("T")[0] : ""}
                        onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value || undefined })}
                        className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Assigned Time</label>
                      <input
                        type="time"
                        value={formData.assignedTime || ""}
                        onChange={(e) => setFormData({ ...formData, assignedTime: e.target.value || undefined })}
                        className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Deadline Date/Time */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Deadline Date</label>
                      <input
                        type="date"
                        value={formData.deadlineDate ? new Date(formData.deadlineDate).toISOString().split("T")[0] : ""}
                        onChange={(e) => setFormData({ ...formData, deadlineDate: e.target.value || undefined })}
                        className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Deadline Time</label>
                      <input
                        type="time"
                        value={formData.deadlineTime || ""}
                        onChange={(e) => setFormData({ ...formData, deadlineTime: e.target.value || undefined })}
                        className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Bonus/Penalty Points and Currency - Only for Admin */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-neutral-600 mb-1 block">Bonus Points</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.bonusPoints || 0}
                            onChange={(e) => setFormData({ ...formData, bonusPoints: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-600 mb-1 block">Bonus Currency (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.bonusCurrency || 0}
                            onChange={(e) => setFormData({ ...formData, bonusCurrency: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-neutral-600 mb-1 block">Penalty Points</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.penaltyPoints || 0}
                            onChange={(e) => setFormData({ ...formData, penaltyPoints: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-600 mb-1 block">Penalty Currency (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.penaltyCurrency || 0}
                            onChange={(e) => setFormData({ ...formData, penaltyCurrency: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom Fields */}
                  <div className="border-t border-neutral-200 pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-neutral-700">Custom Fields</label>
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
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                      {formData.customFields?.map((field, index) => {
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
                                  className="w-full bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
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
                                  className="w-full bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
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
                                  className="w-full bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
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
                                  className="w-full bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
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
                              className="flex-1 min-w-0 bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
                            />
                            <select
                              value={field.type}
                              onChange={(e) => {
                                const newFields = [...(formData.customFields || [])];
                                const newType = e.target.value as "number" | "string" | "boolean" | "date";
                                const currentValue = field.defaultValue;
                                let newValue = currentValue;
                                
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
                              className="w-18 bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs text-neutral-900 focus:outline-none focus:border-emerald-500"
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
                              className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors shrink-0"
                              title="Remove"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                      {(!formData.customFields || formData.customFields.length === 0) && (
                        <p className="text-xs text-neutral-500 italic text-center py-1">
                          No custom fields
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
            onClick={onDelete}
            className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors text-xs font-medium"
          >
            Save
          </button>
        </div>
      </div>
      ) : (
        <div
        className={`flex items-start gap-2 p-2 rounded-lg bg-white border border-neutral-200 hover:border-emerald-300 hover:shadow-sm transition-all group ${
          task.status === "completed" ? "opacity-60" : ""
        }`}
      >
      <button
        onClick={onToggleComplete}
        className="mt-0.5 shrink-0"
      >
        {task.status === "completed" ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <Circle className="w-4 h-4 text-neutral-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onTaskClick) onTaskClick();
            }}
            className={`text-sm text-left hover:underline cursor-pointer ${task.status === "completed" ? "line-through text-neutral-400" : "text-neutral-900"}`}
          >
            {task.title}
          </button>
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
          {task.tickedAt && task.status === "completed" && (
            (() => {
              const tickedTime = new Date(task.tickedAt);
              const deadlineDate = task.deadlineDate ? new Date(task.deadlineDate) : null;
              const deadlineTime = task.deadlineTime;
              
              let deadlineDateTime: Date | null = null;
              if (deadlineDate) {
                deadlineDateTime = new Date(deadlineDate);
                if (deadlineTime) {
                  const [hours, minutes] = deadlineTime.split(':').map(Number);
                  deadlineDateTime.setHours(hours, minutes, 0, 0);
                } else {
                  deadlineDateTime.setHours(23, 59, 59, 999);
                }
              }
              
              let timeDiffText = "";
              let timeDiffColor = "";
              
              if (deadlineDateTime) {
                const diffMs = tickedTime.getTime() - deadlineDateTime.getTime();
                const diffHours = Math.abs(diffMs) / (1000 * 60 * 60);
                const diffDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);
                
                if (diffMs < 0) {
                  // Completed before deadline (early)
                  if (diffDays >= 1) {
                    timeDiffText = `${Math.floor(diffDays)}d early`;
                  } else {
                    timeDiffText = `${Math.floor(diffHours)}h early`;
                  }
                  timeDiffColor = "text-emerald-600";
                } else {
                  // Completed after deadline (late)
                  if (diffDays >= 1) {
                    timeDiffText = `${Math.floor(diffDays)}d late`;
                  } else {
                    timeDiffText = `${Math.floor(diffHours)}h late`;
                  }
                  timeDiffColor = "text-red-500";
                }
              }
              
              const tickedTimeStr = tickedTime.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              
              return (
                <div className={`flex items-center gap-1 ${timeDiffColor || "text-neutral-500"}`}>
                  <span className="text-[9px]">Ticked: {tickedTimeStr}</span>
                  {timeDiffText && (
                    <span className={`text-[9px] font-medium ${timeDiffColor}`}>
                      ({timeDiffText})
                    </span>
                  )}
                </div>
              );
            })()
          )}
          {task.timeSpent && task.status === "completed" && (
            <div className="flex items-center gap-1 text-blue-600">
              <Clock className="w-2.5 h-2.5" />
              <span className="text-[9px] font-medium">{task.timeSpent}h spent</span>
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
      )}

    {/* Custom Recurrence Modal - accessible from both editing and normal view */}
    {showCustomRecurrence && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-neutral-900">Custom Recurrence</h3>
            <p className="text-sm text-neutral-600 mt-1">Choose days of the week or days of the month for this task</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Type Selection */}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-3 block">Recurrence Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    customRecurrence: {
                      type: "daysOfWeek",
                      daysOfWeek: formData.customRecurrence?.daysOfWeek ?? [],
                      daysOfMonth: [],
                      recurring: true
                    }
                  })}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.customRecurrence?.type === "daysOfWeek"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="font-medium text-neutral-900">Days of Week</div>
                  <div className="text-xs text-neutral-600 mt-1">Select weekdays</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    customRecurrence: {
                      type: "daysOfMonth",
                      daysOfWeek: [],
                      daysOfMonth: formData.customRecurrence?.daysOfMonth ?? [],
                      recurring: true
                    }
                  })}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.customRecurrence?.type === "daysOfMonth"
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <div className="font-medium text-neutral-900">Days of Month</div>
                  <div className="text-xs text-neutral-600 mt-1">Select days (1-31)</div>
                </button>
              </div>
            </div>

            {/* Date/Day Selection */}
            {formData.customRecurrence?.type === "daysOfWeek" ? (
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Days of Week</label>
                <div className="grid grid-cols-7 gap-2">
                  {[
                    { day: 0, label: "Sun" },
                    { day: 1, label: "Mon" },
                    { day: 2, label: "Tue" },
                    { day: 3, label: "Wed" },
                    { day: 4, label: "Thu" },
                    { day: 5, label: "Fri" },
                    { day: 6, label: "Sat" }
                  ].map(({ day, label }) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const days = formData.customRecurrence?.daysOfWeek || [];
                        setFormData({
                          ...formData,
                          customRecurrence: {
                            type: formData.customRecurrence?.type ?? "daysOfWeek",
                            daysOfWeek: days.includes(day)
                              ? days.filter(d => d !== day)
                              : [...days, day].sort((a, b) => a - b),
                            daysOfMonth: formData.customRecurrence?.daysOfMonth ?? [],
                            recurring: true
                          }
                        });
                      }}
                      className={`p-3 rounded-lg text-sm font-medium transition-all ${
                        formData.customRecurrence?.daysOfWeek?.includes(day)
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {formData.customRecurrence?.daysOfWeek && formData.customRecurrence.daysOfWeek.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.customRecurrence.daysOfWeek.map((day) => {
                      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                      return (
                        <div
                          key={day}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm"
                        >
                          <span>{dayNames[day]}</span>
                          <button
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              customRecurrence: {
                                type: formData.customRecurrence?.type ?? "daysOfWeek",
                                daysOfWeek: formData.customRecurrence?.daysOfWeek?.filter(d => d !== day) || [],
                                daysOfMonth: formData.customRecurrence?.daysOfMonth ?? [],
                                recurring: true
                              }
                            })}
                            className="hover:bg-emerald-200 rounded p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Days (1-31)</label>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const days = formData.customRecurrence?.daysOfMonth || [];
                        setFormData({
                          ...formData,
                        customRecurrence: {
                          type: formData.customRecurrence?.type ?? "daysOfMonth",
                          daysOfWeek: formData.customRecurrence?.daysOfWeek ?? [],
                          daysOfMonth: days.includes(day)
                            ? days.filter(d => d !== day)
                            : [...days, day].sort((a, b) => a - b),
                          recurring: true
                        }
                        });
                      }}
                      className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                        formData.customRecurrence?.daysOfMonth?.includes(day)
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {formData.customRecurrence?.daysOfMonth && formData.customRecurrence.daysOfMonth.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.customRecurrence.daysOfMonth.map((day) => (
                      <div
                        key={day}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm"
                      >
                        <span>Day {day}</span>
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            customRecurrence: {
                              type: formData.customRecurrence?.type ?? "daysOfMonth",
                              daysOfWeek: formData.customRecurrence?.daysOfWeek ?? [],
                              daysOfMonth: formData.customRecurrence?.daysOfMonth?.filter(d => d !== day) || [],
                              recurring: true
                            }
                          })}
                          className="hover:bg-emerald-200 rounded p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-sm font-medium text-emerald-900 mb-1">Summary</div>
              <div className="text-sm text-emerald-700">
                {formData.customRecurrence?.type === "daysOfWeek" ? (
                  formData.customRecurrence?.daysOfWeek && formData.customRecurrence.daysOfWeek.length > 0 ? (
                    `Task will repeat every week on ${formData.customRecurrence.daysOfWeek.length} selected day${formData.customRecurrence.daysOfWeek.length > 1 ? 's' : ''}`
                  ) : (
                    "No days selected"
                  )
                ) : (
                  formData.customRecurrence?.daysOfMonth && formData.customRecurrence.daysOfMonth.length > 0 ? (
                    `Task will repeat every month on day${formData.customRecurrence.daysOfMonth.length > 1 ? 's' : ''} ${formData.customRecurrence.daysOfMonth.join(', ')}`
                  ) : (
                    "No days selected"
                  )
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCustomRecurrence(false)}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                const hasSelection = formData.customRecurrence?.type === "daysOfWeek"
                  ? (formData.customRecurrence?.daysOfWeek?.length || 0) > 0
                  : (formData.customRecurrence?.daysOfMonth?.length || 0) > 0;
                
                if (!hasSelection) {
                  alert("Please select at least one day");
                  return;
                }
                setShowCustomRecurrence(false);
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}


