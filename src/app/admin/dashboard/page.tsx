'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Users, Clock, FolderKanban, RefreshCw, CheckCircle, X } from 'lucide-react';

import Header from '@/components/shared/Header';
import StatCard from '@/components/shared/StatCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

import PendingEmployeeCard from '@/components/admin/PendingEmployeeCard';
import ProjectListItem from '@/components/admin/ProjectListItem';
import ProjectAssignmentModal from '@/components/admin/ProjectAssignmentModal';
import ProjectDetailsModal from '@/components/admin/ProjectDetailsModal';
import EmployeeList from '@/components/admin/EmployeeList';
import EmployeeDetailModal from '@/components/admin/EmployeeDetailModal';

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
  const { data: session, status } = useSession();
  const router = useRouter();

  // State management
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
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
      const response = await fetch('/api/admin/pending-employees');
      const data = await response.json();
      if (response.ok) {
        setPendingEmployees(data.employees);
      }
    } catch (error) {
      console.error('Error fetching pending employees:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleApproveEmployee = async (userId: string, approve: boolean) => {
    setActionLoading(userId);
    try {
      const response = await fetch('/api/admin/approve-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approve }),
      });
      const data = await response.json();
      if (response.ok) {
        await fetchPendingEmployees();
        alert(data.message);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error approving employee:', error);
      alert('Failed to process request');
    } finally {
      setActionLoading(null);
    }
  };

  if (status === 'loading' || loading) {
    return <LoadingSpinner />;
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  const pendingProjects = projects.filter((p) => p.status === 'pending_assignment');
  const inProgressProjects = projects.filter((p) => p.status === 'in_progress');

  return (
    <div className="min-h-screen bg-[#F2FBF5]">
      <Header title="Admin Dashboard" userName={session?.user?.name || ''} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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
          <div className="rounded-2xl overflow-hidden border border-emerald-100/50 bg-white/80 backdrop-blur-md p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-emerald-200 flex items-center justify-center">
            <button
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg px-4 py-2 font-semibold shadow-md transition-all duration-300 hover:shadow-lg"
              onClick={() => setShowEmployeeList(true)}
            >
              View Employees
            </button>
          </div>
        </div>

        {/* Pending Employee Approvals */}
        {pendingEmployees.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-emerald-100/50 bg-white/80 backdrop-blur-md shadow-lg mb-8">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">Pending Employee Approvals</h2>
              </div>
              <button
                onClick={fetchPendingEmployees}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="p-6 space-y-4">
              {pendingEmployees.map((employee) => (
                <PendingEmployeeCard
                  key={employee._id}
                  employee={employee}
                  onApprove={handleApproveEmployee}
                  isLoading={actionLoading === employee._id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Projects Section */}
        <div className="rounded-2xl overflow-hidden border border-emerald-100/50 bg-white/80 backdrop-blur-md shadow-lg">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderKanban className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">All Projects</h2>
            </div>
            <button
              onClick={fetchProjects}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          <div className="p-6">
            {projects.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-emerald-200 rounded-2xl">
                <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">No projects yet</p>
                <p className="text-gray-600">Projects will appear here once clients create them</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <ProjectListItem
                    key={project._id}
                    project={project}
                    onAssign={setSelectedProject}
                    onViewDetails={setViewProjectId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-emerald-100/50 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-emerald-900">All Employees</h2>
              <button
                onClick={() => setShowEmployeeList(false)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <EmployeeList
              onSelectEmployee={(id) => {
                setSelectedEmployeeId(id);
                setShowEmployeeList(false);
              }}
            />
          </div>
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
