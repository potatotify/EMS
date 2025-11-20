"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {useState, useEffect} from "react";
import {
  Users,
  Clock,
  FolderKanban,
  RefreshCw,
  CheckCircle,
  X,
  Search,
  TrendingUp,
  Trophy,
  MessageSquare
} from "lucide-react";
import {motion} from "framer-motion";

import Header from "@/components/shared/Header";
import StatCard from "@/components/shared/StatCard";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import CollapsibleSection from "@/components/shared/CollapsibleSection";

import PendingEmployeeCard from "@/components/admin/PendingEmployeeCard";
import ProjectListItem from "@/components/admin/ProjectListItem";
import ProjectAssignmentModal from "@/components/admin/ProjectAssignmentModal";
import ProjectDetailsModal from "@/components/admin/ProjectDetailsModal";
import EmployeeList from "@/components/admin/EmployeeList";
import EmployeeDetailModal from "@/components/admin/EmployeeDetailModal";
import DailyUpdatesReview from "@/components/admin/DailyUpdatesReview";
import BonusLeaderboard from "@/components/admin/BonusLeaderboard";
import AdminMessagesPanel from "@/components/admin/AdminMessagesPanel";

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

export default function AdminDashboard() {
  const {data: session, status} = useSession();
  const router = useRouter();

  // State management
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployee[]>(
    []
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );

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
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userId, approve})
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

  // Filter projects based on search
  const filteredProjects = projects.filter((project) =>
    project.projectName.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-emerald-50/20 to-teal-50/30 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 opacity-20">
        <div
          className="absolute top-0 right-0 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "0s"}}
        />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl animate-float"
          style={{animationDelay: "2s"}}
        />
      </div>

      <Header
        title="Admin Dashboard"
        userName={session?.user?.name || ""}
        rightActions={
          <button
            onClick={() => setShowEmployeeList(true)}
            className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:opacity-90"
          >
            <Users className="w-4 h-4" />
            View Employees
          </button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Approvals"
            value={pendingEmployees.length}
            icon={Clock}
            iconBgColor="bg-amber-100"
            iconColor="text-amber-600"
          />
          <StatCard
            title="Total Projects"
            value={projects.length}
            icon={FolderKanban}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-600"
          />
          <StatCard
            title="Pending Assignment"
            value={pendingProjects.length}
            icon={Users}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            title="In Progress"
            value={inProgressProjects.length}
            icon={CheckCircle}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-600"
          />
        </div>

        {/* Pending Employee Approvals */}
        {pendingEmployees.length > 0 && (
          <CollapsibleSection
            title="Pending Employee Approvals"
            icon={<Users className="w-6 h-6 text-white" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              <motion.button
                whileHover={{scale: 1.05}}
                whileTap={{scale: 0.95}}
                onClick={fetchPendingEmployees}
                className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </motion.button>
              {pendingEmployees.map((employee, index) => (
                <motion.div
                  key={employee._id}
                  initial={{opacity: 0, x: -20}}
                  animate={{opacity: 1, x: 0}}
                  transition={{delay: index * 0.1}}
                >
                  <PendingEmployeeCard
                    employee={employee}
                    onApprove={handleApproveEmployee}
                    isLoading={actionLoading === employee._id}
                  />
                </motion.div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Projects Section */}
        <CollapsibleSection
          title="All Projects"
          icon={<FolderKanban className="w-6 h-6 text-white" />}
          defaultOpen={false}
        >
          <div className="space-y-6">
            <motion.button
              whileHover={{scale: 1.05}}
              whileTap={{scale: 0.95}}
              onClick={fetchProjects}
              className="inline-flex items-center gap-2 px-4 py-2 gradient-emerald text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </motion.button>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects by name..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white/80 backdrop-blur-sm text-gray-900 placeholder-gray-500"
              />
            </div>

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
                <p className="text-slate-600 text-sm">
                  Projects will appear here once clients create them
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No projects found matching "{projectSearch}"
                  </div>
                ) : (
                  filteredProjects.map((project, index) => (
                    <motion.div
                      key={project._id}
                      initial={{opacity: 0, x: -20}}
                      animate={{opacity: 1, x: 0}}
                      transition={{delay: index * 0.1}}
                    >
                      <ProjectListItem
                        project={project}
                        onAssign={setSelectedProject}
                        onViewDetails={setViewProjectId}
                      />
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Daily Updates Review Section */}
        <CollapsibleSection
          title="Daily Updates Review"
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          defaultOpen={false}
        >
          <DailyUpdatesReview />
        </CollapsibleSection>

        {/* Bonus Leaderboard Section */}
        <CollapsibleSection
          title="Bonus Leaderboard"
          icon={<Trophy className="w-6 h-6 text-white" />}
          defaultOpen={false}
        >
          <BonusLeaderboard />
        </CollapsibleSection>

        {/* Admin Messages Section */}
        <CollapsibleSection
          title="Messages"
          icon={<MessageSquare className="w-6 h-6 text-white" />}
          defaultOpen={false}
        >
          <AdminMessagesPanel />
        </CollapsibleSection>
      </main>

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

      {/* Employee List Modal */}
      {showEmployeeList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
          <motion.div
            initial={{opacity: 0, scale: 0.95, y: 20}}
            animate={{opacity: 1, scale: 1, y: 0}}
            exit={{opacity: 0, scale: 0.95, y: 20}}
            className="glass-effect rounded-3xl p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto border border-white/40 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-emerald-700 to-teal-600">
                All Employees
              </h2>
              <motion.button
                whileHover={{scale: 1.1, rotate: 90}}
                whileTap={{scale: 0.9}}
                onClick={() => setShowEmployeeList(false)}
                className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-red-500 transition-all duration-200 shadow-md"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>
            <EmployeeList
              onSelectEmployee={(id) => {
                setSelectedEmployeeId(id);
                setShowEmployeeList(false);
              }}
            />
          </motion.div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedEmployeeId && (
        <EmployeeDetailModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </div>
  );
}
