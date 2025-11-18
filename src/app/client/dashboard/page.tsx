'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, Clock, CheckCircle2, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import Header from '@/components/shared/Header';
import StatCard from '@/components/shared/StatCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CreateProjectModal from '@/components/client/CreateProjectModal';
import ProjectCard from '@/components/client/ProjectCard';
import ProjectDetailsModal from '@/components/client/ProjectDetailsModal';

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewProjectId, setViewProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      const profileCompleted = (session?.user as any)?.profileCompleted;
      if (!profileCompleted) {
        router.push('/client/onboarding');
      } else {
        fetchProjects();
      }
    }
  }, [status, session, router]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return <LoadingSpinner />;
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F2FBF5]">
      <Header title="Client Dashboard" userName={session?.user?.name || ''} />

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
            value={projects.filter(p => p.status === 'in_progress').length}
            icon={Clock}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            title="Completed"
            value={projects.filter(p => p.status === 'completed').length}
            icon={CheckCircle2}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-600"
          />
        </div>

        {/* Create Project Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create New Project
          </button>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
          <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">My Projects</h2>
          </div>
          <div className="p-6">
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">No projects yet</p>
                <p className="text-gray-600">Create your first project to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project._id}
                    project={project}
                    onViewDetails={setViewProjectId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
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
