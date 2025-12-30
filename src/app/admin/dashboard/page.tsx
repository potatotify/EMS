"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Users,
  Clock,
  FolderKanban,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  MessageSquare,
  UserCheck,
  X,
  ListTodo,
  Calendar,
  Code,
  Shield,
  GraduationCap,
  BarChart3,
  FileSpreadsheet,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Building2,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import { motion } from "framer-motion";

import Header from "@/components/shared/Header";
import StatCard from "@/components/shared/StatCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

import PendingEmployeeCard from "@/components/admin/PendingEmployeeCard";
import ProjectsTable from "@/components/admin/ProjectsTable";
import ProjectAssignmentModal from "@/components/admin/ProjectAssignmentModal";
import ProjectDetailsModal from "@/components/admin/ProjectDetailsModal";
import DailyUpdatesReview from "@/components/admin/DailyUpdatesReview";
import AdminMessagesPanel from "@/components/admin/AdminMessagesPanel";
import EmployeesSection from "@/components/admin/EmployeesSection";
import HackathonsSection from "@/components/admin/HackathonsSection";
import ChecklistSettings from "@/components/admin/ChecklistSettings";
import EmployeePermissions from "@/components/admin/EmployeePermissions";
import ProjectTaskList from "@/components/admin/ProjectTaskList";
import TaskAnalysisSheet from "@/components/admin/TaskAnalysisSheet";
import BonusPointsSheet from "@/components/admin/BonusPointsSheet";
import ClientsTable from "@/components/admin/ClientsTable";
import EmployeeProjectsTable from "@/components/admin/EmployeeProjectsTable";
import ProjectDailyUpdatesTable from "@/components/admin/ProjectDailyUpdatesTable";
import EmployeeDailyUpdatesTable from "@/components/admin/EmployeeDailyUpdatesTable";

interface PendingEmployee {
  _id: string;
  name: string;
  email: string;
  image?: string;
  createdAt?: string;
}

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
}

type SectionType =
  | "projects"
  | "project-daily-updates"
  | "daily-updates"
  | "employee-daily-updates"
  | "pending-approvals"
  | "employees"
  | "hackathons"
  | "messages"
  | "checklist-settings"
  | "employee-permissions"
  | "project-tasks"
  | "task-analysis"
  | "bonus-summary"
  | "clients"
  | "employee-projects";

interface SidebarItem {
  id: SectionType;
  title: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State management
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionType>("projects");
  
  // Sidebar collapse state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admin-sidebar-collapsed");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin-sidebar-collapsed", String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPendingEmployees(), fetchProjects()]);
    setLoading(false);
  };

  const fetchPendingEmployees = async () => {
    try {
      const response = await fetch("/api/admin/pending-employees");
      const data = await response.json();
      if (response.ok) {
        setPendingEmployees(data.employees);
      }
    } catch (error) {
      console.error("Error fetching pending employees:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const handleApproveEmployee = async (userId: string, approve: boolean) => {
    setActionLoading(userId);
    try {
      const response = await fetch("/api/admin/approve-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, approve })
      });
      const data = await response.json();
      if (response.ok) {
        await fetchPendingEmployees();
        alert(data.message);
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error approving employee:", error);
      alert("Failed to process request");
    } finally {
      setActionLoading(null);
    }
  };

  if (status === "loading" || loading) {
    return <LoadingSpinner />;
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const pendingProjects = projects.filter(
    (p) => p.status === "pending_assignment"
  );
  const inProgressProjects = projects.filter((p) => p.status === "in_progress");

  const sidebarItems: SidebarItem[] = [
    // Sheets first
    {
      id: "projects",
      title: "Project Overview",
      icon: <FolderKanban className="w-5 h-5" />
    },
    {
      id: "project-daily-updates",
      title: "Project Daily Updates",
      icon: <Calendar className="w-5 h-5" />
    },
    {
      id: "project-tasks",
      title: "Project Tasks",
      icon: <CheckSquare className="w-5 h-5" />
    },
    {
      id: "bonus-summary",
      title: "Bonus Points Summary",
      icon: <FileSpreadsheet className="w-5 h-5" />
    },
    {
      id: "task-analysis",
      title: "Task Analysis",
      icon: <BarChart3 className="w-5 h-5" />
    },
    // New sections
    {
      id: "clients",
      title: "Clients",
      icon: <Building2 className="w-5 h-5" />
    },
    {
      id: "employee-projects",
      title: "Employee Projects",
      icon: <Briefcase className="w-5 h-5" />
    },
    // Rest of the items
    {
      id: "daily-updates",
      title: "Daily Updates Review",
      icon: <TrendingUp className="w-5 h-5" />
    },
    {
      id: "employee-daily-updates",
      title: "Employee Daily Updates",
      icon: <CalendarDays className="w-5 h-5" />
    },
    {
      id: "pending-approvals",
      title: "Pending Approvals",
      icon: <UserCheck className="w-5 h-5" />,
      badge: pendingEmployees.length > 0 ? pendingEmployees.length : undefined
    },
    {
      id: "employees",
      title: "Employees & Attendance",
      icon: <Users className="w-5 h-5" />
    },
    {
      id: "hackathons",
      title: "Hackathons",
      icon: <Code className="w-5 h-5" />
    },
    {
      id: "messages",
      title: "Messages",
      icon: <MessageSquare className="w-5 h-5" />
    },
    {
      id: "checklist-settings",
      title: "Checklist Settings",
      icon: <ListTodo className="w-5 h-5" />
    },
    {
      id: "employee-permissions",
      title: "Employee Permissions",
      icon: <Shield className="w-5 h-5" />
    }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "projects":
        return (
          <ProjectsTable
            projects={projects}
            onViewDetails={setViewProjectId}
            onAssign={setSelectedProject}
            onRefresh={fetchProjects}
          />
        );
      case "project-daily-updates":
        return <ProjectDailyUpdatesTable />;
      case "daily-updates":
        return <DailyUpdatesReview />;
      case "employee-daily-updates":
        return <EmployeeDailyUpdatesTable />;
      case "pending-approvals":
        return (
          <div className="space-y-4">
            {pendingEmployees.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-emerald-300/50 rounded-2xl bg-linear-to-br from-emerald-50/50 to-teal-50/50">
                <UserCheck className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
                <p className="text-lg font-bold text-slate-800 mb-2">
                  No pending approvals
                </p>
                <p className="text-slate-600 text-sm">
                  All employee approvals have been processed
                </p>
              </div>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={fetchPendingEmployees}
                  className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </motion.button>
                {pendingEmployees.map((employee, index) => (
                  <motion.div
                    key={employee._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <PendingEmployeeCard
                      employee={employee}
                      onApprove={handleApproveEmployee}
                      isLoading={actionLoading === employee._id}
                    />
                  </motion.div>
                ))}
              </>
            )}
          </div>
        );
      case "employees":
        return <EmployeesSection />;
      case "hackathons":
        return <HackathonsSection />;
      case "messages":
        return <AdminMessagesPanel />;
      case "checklist-settings":
        return <ChecklistSettings />;
      case "employee-permissions":
        return <EmployeePermissions />;
      case "project-tasks":
        return <ProjectTaskList />;
      case "task-analysis":
        return <TaskAnalysisSheet />;
      case "bonus-summary":
        return <BonusPointsSheet />;
      case "clients":
        return <ClientsTable />;
      case "employee-projects":
        return <EmployeeProjectsTable />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 relative">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 -z-10 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(0 0 0) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      <Header
        title="Admin Dashboard"
        userName={session?.user?.name || ""}
      />

      <div className="flex h-[calc(100vh-5rem)] lg:h-[calc(100vh-5rem)]">
        {/* Left Sidebar - Modern Design with Collapse */}
        <motion.aside
          initial={false}
          animate={{
            width: isSidebarCollapsed ? "80px" : "256px",
          }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="bg-white border-r border-neutral-200 flex flex-col shadow-sm relative"
        >
          {/* Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleSidebar}
            className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full bg-white border-2 border-neutral-200 shadow-md flex items-center justify-center text-neutral-600 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </motion.button>

          <nav className="flex-1 overflow-y-auto p-4">
            <motion.h3
              initial={false}
              animate={{
                opacity: isSidebarCollapsed ? 0 : 1,
                height: isSidebarCollapsed ? 0 : "auto",
              }}
              transition={{ duration: 0.2 }}
              className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4 px-3 overflow-hidden"
            >
              Navigation
            </motion.h3>
            <div className="space-y-1">
              {sidebarItems.map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.01, x: isSidebarCollapsed ? 0 : 4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 relative group ${
                    activeSection === item.id
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20"
                      : "text-neutral-700 hover:bg-neutral-100"
                  } ${isSidebarCollapsed ? "justify-center" : ""}`}
                  title={isSidebarCollapsed ? item.title : undefined}
                >
                  <motion.div
                    animate={{
                      scale: activeSection === item.id ? 1.1 : 1,
                    }}
                    className="flex-shrink-0"
                  >
                    {item.icon}
                  </motion.div>
                  <motion.span
                    initial={false}
                    animate={{
                      opacity: isSidebarCollapsed ? 0 : 1,
                      width: isSidebarCollapsed ? 0 : "auto",
                    }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 font-medium text-sm overflow-hidden whitespace-nowrap"
                  >
                    {item.title}
                  </motion.span>
                  {item.badge && (
                    <motion.span
                      initial={false}
                      animate={{
                        opacity: isSidebarCollapsed ? 0 : 1,
                        scale: isSidebarCollapsed ? 0 : 1,
                      }}
                      transition={{ duration: 0.2 }}
                      className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
                        activeSection === item.id
                          ? "bg-white/20 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </div>
          </nav>
        </motion.aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-neutral-50/50">
          <div className={`${activeSection === "project-tasks" ? "w-full p-0" : "max-w-[1920px] mx-auto p-6 lg:p-8"}`}>
            {/* Section Header - Hidden for project-tasks */}
            {activeSection !== "project-tasks" && activeSection !== "bonus-summary" && activeSection !== "daily-updates" && activeSection !== "project-daily-updates" && activeSection !== "task-analysis" && activeSection !== "hackathons" && activeSection !== "checklist-settings" && activeSection !== "employee-permissions" && activeSection !== "clients" && activeSection !== "employee-projects" && activeSection !== "employee-daily-updates" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
                    {sidebarItems.find((item) => item.id === activeSection)?.icon}
                  </div>
                  <h2 className="text-3xl font-bold text-neutral-900">
                    {sidebarItems.find((item) => item.id === activeSection)?.title}
                  </h2>
                </div>
                <p className="text-neutral-600 ml-14">
                  Manage and monitor your {sidebarItems.find((item) => item.id === activeSection)?.title.toLowerCase()}
                </p>
              </motion.div>
            )}

            {/* Content */}
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Project Assignment Modal */}
      {selectedProject && (
        <ProjectAssignmentModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={() => {
            setSelectedProject(null);
            fetchProjects();
          }}
        />
      )}

      {/* Project Details Modal */}
      {viewProjectId && (
        <ProjectDetailsModal
          projectId={viewProjectId}
          onClose={() => setViewProjectId(null)}
          onUpdate={fetchProjects}
        />
      )}

    </div>
  );
}
