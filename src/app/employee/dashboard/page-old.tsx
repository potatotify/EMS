"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {
  FolderKanban,
  Clock,
  TrendingUp,
  AlertCircle,
  Mail,
  CheckCircle,
  ChevronDown
} from "lucide-react";
import {motion} from "framer-motion";

import Header from "@/components/shared/Header";
import StatCard from "@/components/shared/StatCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

import ProjectProgressCard from "@/components/employee/ProjectProgressCard";
import DailyUpdateModal from "@/components/employee/DailyUpdateModal";
import DailyUpdateForm from "@/components/employee/DailyUpdateForm";
import AttendanceModal from "@/components/employee/AttendanceForm";
import EmployeeTasksSection from "@/components/employee/EmployeeTasksSection";
import CollapsibleSection from "@/components/shared/CollapsibleSection";

interface Project {
  _id: string;
  projectName: string;
  description: string;
  deadline: string;
  status: string;
  priority: string;
  githubLink?: string;
  loomLink?: string;
  whatsappGroupLink?: string;
}

export default function EmployeeDashboard() {
  const {data: session, status} = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

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

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-emerald-50/20 to-teal-50/30 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-float" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "2s"}}
        />
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
              <CheckCircle className="w-4 h-4" />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Assigned Projects"
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
            title="Updates This Week"
            value={0}
            icon={TrendingUp}
            iconBgColor="bg-purple-100"
            iconColor="text-purple-600"
          />
          <StatCard
            title="Messages"
            value={unreadMessages}
            icon={Mail}
            iconBgColor="bg-amber-100"
            iconColor="text-amber-600"
          />
        </div>

        {/* Daily Update Form - Collapsible */}
        <CollapsibleSection
          title="Submit Daily Update"
          icon={<TrendingUp className="w-6 h-6 text-white" />}
        >
          <DailyUpdateForm />
        </CollapsibleSection>

        {/* Tasks Section - Collapsible */}
        <CollapsibleSection
          title="My Tasks"
          icon={<CheckCircle className="w-6 h-6 text-white" />}
        >
          <EmployeeTasksSection />
        </CollapsibleSection>

        {/* Projects Section - Collapsible */}
        <CollapsibleSection
          title="My Projects"
          icon={<FolderKanban className="w-6 h-6 text-white" />}
        >
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
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
        </CollapsibleSection>

        {/* Quick Tips - Collapsible */}
        <CollapsibleSection
          title="Daily Update Tips"
          icon={<AlertCircle className="w-6 h-6 text-white" />}
          headerColor="from-blue-600 to-blue-700"
        >
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Submit your daily updates before end of day</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Be specific about tasks completed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Report any blockers immediately</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Update progress percentage accurately</span>
            </li>
          </ul>
        </CollapsibleSection>
      </main>

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
