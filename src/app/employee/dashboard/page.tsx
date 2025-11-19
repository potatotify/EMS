'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FolderKanban, Clock, TrendingUp, AlertCircle, Mail } from 'lucide-react';

import Header from '@/components/shared/Header';
import StatCard from '@/components/shared/StatCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

import ProjectProgressCard from '@/components/employee/ProjectProgressCard';
import DailyUpdateModal from '@/components/employee/DailyUpdateModal';
import DailyUpdateForm from '@/components/employee/DailyUpdateForm';

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
  const { data: session, status } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (status === 'authenticated') {
      const profileCompleted = (session?.user as any)?.profileCompleted;
      if (!profileCompleted) {
        router.push('/employee/onboarding');
      } else {
        fetchProjects();
        fetchUnreadMessages();
      }
    }
  }, [status, session, router]);

  const fetchUnreadMessages = async () => {
    try {
      const res = await fetch('/api/employee/messages/unread-count');
      const data = await res.json();
      if (res.ok) {
        setUnreadMessages(data.unread || 0);
      }
    } catch (err) {
      console.error('Error fetching unread message count', err);
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

  const isApproved = (session?.user as any)?.isApproved;

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-[#F2FBF5]">
        <Header title="Employee Dashboard" userName={session?.user?.name || ''} />
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
    <div className="min-h-screen bg-[#F2FBF5]">
      <Header
        title="Employee Dashboard"
        userName={session?.user?.name || ''}
        rightActions={
          <button
            type="button"
            onClick={() => router.push('/employee/messages')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 border border-emerald-100"
          >
            <Mail className="w-4 h-4" />
            <span>Messages</span>
            {unreadMessages > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-emerald-600 text-white text-[10px]">
                {unreadMessages}
              </span>
            )}
          </button>
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
            value={projects.filter((p) => p.status === 'in_progress').length}
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

        {/* Daily Update Form */}
        <DailyUpdateForm />

        {/* Projects Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden mb-8">
          <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">My Projects</h2>
          </div>
          <div className="p-6">
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">No projects assigned yet</p>
                <p className="text-gray-600">Projects assigned to you will appear here</p>
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
        </div>

        {/* Quick Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Daily Update Tips</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Submit your daily updates before end of day</li>
                <li>• Be specific about tasks completed</li>
                <li>• Report any blockers immediately</li>
                <li>• Update progress percentage accurately</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Daily Update Modal */}
      {selectedProject && (
        <DailyUpdateModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSuccess={() => {
            setSelectedProject(null);
            alert('Update submitted successfully!');
          }}
        />
      )}
    </div>
  );
}
