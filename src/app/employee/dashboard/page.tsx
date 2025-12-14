"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {
  FolderKanban,
  Clock,
  CheckCircle,
  Award,
  Shield,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Mail
} from "lucide-react";
import {motion} from "framer-motion";

import Header from "@/components/shared/Header";
import StatCard from "@/components/shared/StatCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

import ProjectProgressCard from "@/components/employee/ProjectProgressCard";
import AttendanceModal from "@/components/employee/AttendanceForm";
import EmployeeBonusPointsSheet from "@/components/employee/EmployeeBonusPointsSheet";
import AdminFeatures from "@/components/employee/AdminFeatures";
import DailyUpdateModal from "@/components/employee/DailyUpdateModal";

interface Project {
  _id: string;
  projectName: string;
  description: string;
  deadline: string;
  status: string;
  priority: string;
  leadAssignee?: any;
  githubLink?: string;
  loomLink?: string;
  whatsappGroupLink?: string;
}

type SectionType = "projects" | "all-tasks" | "bonus-fine" | "permissions";

interface SidebarItem {
  id: SectionType;
  title: string;
  icon: React.ReactNode;
  badge?: number;
}

export default function EmployeeDashboard() {
  const {data: session, status} = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionType>("projects");
  
  // Sidebar collapse state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("employee-sidebar-collapsed");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("employee-sidebar-collapsed", String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  useEffect(() => {
    if (status === "authenticated") {
      const profileCompleted = (session?.user as any)?.profileCompleted;
      if (!profileCompleted) {
        router.push("/employee/onboarding");
      } else {
        fetchProjects();
        fetchUnreadMessages();
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    if (activeSection === "all-tasks") {
      router.push("/employee/all-tasks");
    }
  }, [activeSection, router]);

  const fetchUnreadMessages = async () => {
    try {
      const res = await fetch("/api/employee/messages/unread-count");
      const data = await res.json();
      if (res.ok) {
        setUnreadMessages(data.unread || 0);
      }
    } catch (err) {
      console.error("Error fetching unread message count", err);
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
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <LoadingSpinner />;
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const isApproved = (session?.user as any)?.isApproved;

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-[#F2FBF5]">
        <Header
          title="Employee Dashboard"
          userName={session?.user?.name || ""}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-2xl shadow-xl border border-amber-200 p-12 max-w-2xl text-center">
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Account Pending Approval
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Your employee account is awaiting approval from the admin.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <p className="text-sm text-amber-900">
                  You'll receive an email once your account has been approved.
                  Please check back later.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const sidebarItems: SidebarItem[] = [
    {
      id: "projects",
      title: "My Projects",
      icon: <FolderKanban className="w-5 h-5" />
    },
    {
      id: "all-tasks",
      title: "All Tasks",
      icon: <CheckCircle className="w-5 h-5" />
    },
    {
      id: "bonus-fine",
      title: "Bonus & Fine",
      icon: <Award className="w-5 h-5" />
    },
    {
      id: "permissions",
      title: "My Permissions",
      icon: <Shield className="w-5 h-5" />
    }
  ];

  const inProgressProjects = projects.filter((p) => p.status === "in_progress");

  const renderContent = () => {
    switch (activeSection) {
      case "projects":
        return (
          <div className="space-y-6">
            {projects.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-emerald-300/50 rounded-2xl bg-linear-to-br from-emerald-50/50 to-teal-50/50">
                <FolderKanban className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  No projects assigned yet
                </p>
                <p className="text-gray-600">
                  Projects assigned to you will appear here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((project) => (
                  <ProjectProgressCard
                    key={project._id}
                    project={project}
                    onUpdate={setSelectedProject}
                  />
                ))}
              </div>
            )}
          </div>
        );
      case "all-tasks":
        return null; // Navigation handled by useEffect
      case "bonus-fine":
        return <EmployeeBonusPointsSheet />;
      case "permissions":
        return <AdminFeatures />;
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
        title="Employee Dashboard"
        userName={session?.user?.name || ""}
        rightActions={
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{scale: 1.05}}
              whileTap={{scale: 0.95}}
              type="button"
              onClick={() => setShowAttendanceModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-effect border border-white/40 text-emerald-700 text-sm font-semibold hover:shadow-lg transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>Mark Attendance</span>
            </motion.button>
            <motion.button
              whileHover={{scale: 1.05}}
              whileTap={{scale: 0.95}}
              type="button"
              onClick={() => router.push("/employee/messages")}
              className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-effect border border-white/40 text-emerald-700 text-sm font-semibold hover:shadow-lg transition-all"
            >
              <Mail className="w-4 h-4" />
              <span>Messages</span>
              {unreadMessages > 0 && (
                <motion.span
                  initial={{scale: 0}}
                  animate={{scale: 1}}
                  className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 rounded-full gradient-emerald text-white text-xs font-bold shadow-lg"
                >
                  {unreadMessages}
                </motion.span>
              )}
            </motion.button>
          </div>
        }
      />

      <div className="flex h-[calc(100vh-5rem)]">
        {/* Left Sidebar - Collapsible */}
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
          <div className="max-w-[1920px] mx-auto p-6 lg:p-8">
            {/* Section Header */}
            <motion.div
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
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
            </motion.div>

            {/* Content */}
            <motion.div
              key={activeSection}
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -20}}
              transition={{duration: 0.3}}
            >
              {renderContent()}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Daily Update Modal */}
      {selectedProject && (
        <DailyUpdateModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={() => {
            setSelectedProject(null);
            alert("Update submitted successfully!");
          }}
        />
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <AttendanceModal
          onClose={() => setShowAttendanceModal(false)}
          onSuccess={() => {
            setShowAttendanceModal(false);
          }}
        />
      )}
    </div>
  );
}
