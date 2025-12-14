"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {FolderKanban, Clock, CheckCircle2, Eye, LayoutDashboard, ChevronLeft, ChevronRight} from "lucide-react";
import {useEffect, useState} from "react";
import {motion} from "framer-motion";
import Header from "@/components/shared/Header";
import StatCard from "@/components/shared/StatCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import ProjectCard from "@/components/client/ProjectCard";
import ProjectDetailsModal from "@/components/client/ProjectDetailsModal";

interface Project {
  _id: string;
  projectName: string;
  description: string;
  startDate: string;
  deadline: string;
  budget: string;
  status: string;
  clientProgress?: number;
  createdAt: string;
}

type SectionType = "projects";

interface SidebarItem {
  id: SectionType;
  title: string;
  icon: React.ReactNode;
}

export default function ClientDashboard() {
  const {data: session, status} = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionType>("projects");
  
  // Sidebar collapse state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("client-sidebar-collapsed");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("client-sidebar-collapsed", String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  useEffect(() => {
    if (status === "authenticated") {
      const profileCompleted = (session?.user as any)?.profileCompleted;
      if (!profileCompleted) {
        router.push("/client/onboarding");
      } else {
        fetchProjects();
      }
    }
  }, [status, session, router]);

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

  const sidebarItems: SidebarItem[] = [
    {
      id: "projects",
      title: "My Projects",
      icon: <FolderKanban className="w-5 h-5" />
    }
  ];

  const inProgressProjects = projects.filter((p) => p.status === "in_progress");
  const completedProjects = projects.filter((p) => p.status === "completed");

  const renderContent = () => {
    switch (activeSection) {
      case "projects":
        return (
          <div className="space-y-6">
            {projects.length === 0 ? (
              <motion.div
                initial={{opacity: 0, scale: 0.95}}
                animate={{opacity: 1, scale: 1}}
                className="text-center py-16 border-2 border-dashed border-emerald-300/50 rounded-2xl bg-linear-to-br from-emerald-50/50 to-teal-50/50"
              >
                <FolderKanban className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
                <p className="text-lg font-bold text-slate-800 mb-2">
                  No projects yet
                </p>
                <p className="text-slate-600 mb-4">
                  Contact your administrator to create a new project
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {projects.map((project, index) => (
                  <motion.div
                    key={project._id}
                    initial={{opacity: 0, x: -20}}
                    animate={{opacity: 1, x: 0}}
                    transition={{delay: index * 0.05}}
                  >
                    <ProjectCard
                      project={project}
                      onViewDetails={setViewProjectId}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-emerald-50/20 to-teal-50/30 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 opacity-20">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl animate-float" />
        <div
          className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "2s"}}
        />
      </div>

      <Header 
        title="Client Dashboard" 
        userName={session?.user?.name || ""}
      />

      <div className="flex h-[calc(100vh-80px)]">
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
          className="bg-white/90 backdrop-blur-sm border-r border-emerald-100/50 shadow-lg flex flex-col relative"
        >
          {/* Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleSidebar}
            className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full bg-white border-2 border-emerald-200 shadow-md flex items-center justify-center text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </motion.button>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            <motion.h3
              initial={false}
              animate={{
                opacity: isSidebarCollapsed ? 0 : 1,
                height: isSidebarCollapsed ? 0 : "auto",
              }}
              transition={{ duration: 0.2 }}
              className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 overflow-hidden"
            >
              Sections
            </motion.h3>
            <div className="space-y-1">
              {sidebarItems.map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.02, x: isSidebarCollapsed ? 0 : 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveSection(item.id);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                    activeSection === item.id
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
                      : "bg-gray-50/50 text-gray-700 hover:bg-gray-100/50"
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
                    className="flex-1 font-medium overflow-hidden whitespace-nowrap"
                  >
                    {item.title}
                  </motion.span>
                </motion.button>
              ))}
            </div>
          </nav>
        </motion.aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Section Header */}
            <div className="mb-6">
              <motion.div
                initial={{opacity: 0, y: -10}}
                animate={{opacity: 1, y: 0}}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {sidebarItems.find((item) => item.id === activeSection)?.icon}
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-teal-600">
                    {sidebarItems.find((item) => item.id === activeSection)?.title}
                  </h2>
                </div>
              </motion.div>
            </div>

            {/* Content */}
            <motion.div
              key={activeSection}
              initial={{opacity: 0, x: 20}}
              animate={{opacity: 1, x: 0}}
              exit={{opacity: 0, x: -20}}
              transition={{duration: 0.3}}
              className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-emerald-100/50 p-6"
            >
              {renderContent()}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Project Details Modal */}
      {viewProjectId && (
        <ProjectDetailsModal
          projectId={viewProjectId}
          onClose={() => setViewProjectId(null)}
        />
      )}
    </div>
  );
}
