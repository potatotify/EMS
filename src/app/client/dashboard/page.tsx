"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {Plus, FolderKanban, Clock, CheckCircle2, Eye} from "lucide-react";
import {useEffect, useState} from "react";
import {motion} from "framer-motion";
import Header from "@/components/shared/Header";
import StatCard from "@/components/shared/StatCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import CreateProjectModal from "@/components/client/CreateProjectModal";
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

export default function ClientDashboard() {
  const {data: session, status} = useSession();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);

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

      <Header title="Client Dashboard" userName={session?.user?.name || ""} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Projects"
            value={projects.length}
            icon={FolderKanban}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-600"
          />
          <StatCard
            title="In Progress"
            value={projects.filter((p) => p.status === "in_progress").length}
            icon={Clock}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            title="Completed"
            value={projects.filter((p) => p.status === "completed").length}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-600"
          />
        </div>

        {/* Create Project Button */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          className="mb-8"
        >
          <motion.button
            whileHover={{scale: 1.02, y: -2}}
            whileTap={{scale: 0.98}}
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-3 px-8 py-4 gradient-emerald hover:opacity-90 text-white rounded-2xl font-bold shadow-xl transition-all text-lg relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
            <Plus className="w-6 h-6 relative z-10" />
            <span className="relative z-10">Create New Project</span>
          </motion.button>
        </motion.div>

        {/* Projects List */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: 0.2}}
          className="glass-effect rounded-3xl shadow-2xl border border-white/40 overflow-hidden"
        >
          <div className="gradient-emerald px-6 py-5">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <FolderKanban className="w-5 h-5" />
              </div>
              My Projects
            </h2>
          </div>
          <div className="p-6">
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
                <p className="text-slate-600">
                  Create your first project to get started
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {projects.map((project, index) => (
                  <motion.div
                    key={project._id}
                    initial={{opacity: 0, x: -20}}
                    animate={{opacity: 1, x: 0}}
                    transition={{delay: index * 0.1}}
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
        </motion.div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchProjects();
          }}
        />
      )}

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
