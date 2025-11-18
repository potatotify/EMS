'use client';

import { Eye } from 'lucide-react';

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

interface ProjectCardProps {
  project: Project;
  onViewDetails?: (projectId: string) => void;
}

export default function ProjectCard({ project, onViewDetails }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_assignment': return 'bg-amber-100 text-amber-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'on_hold': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="p-5 border border-gray-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{project.projectName}</h3>
          <p className="text-sm text-gray-600 mt-1">{project.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
          {getStatusText(project.status)}
        </span>
      </div>

      {/* Progress Bar */}
      {project.clientProgress !== undefined && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-semibold text-emerald-700">{project.clientProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-linear-to-r from-emerald-500 to-emerald-600 h-3 rounded-full transition-all"
              style={{ width: `${project.clientProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <span className="text-gray-600">Start Date:</span>
          <p className="font-medium text-gray-900">{new Date(project.startDate).toLocaleDateString()}</p>
        </div>
        <div>
          <span className="text-gray-600">Deadline:</span>
          <p className="font-medium text-gray-900">{new Date(project.deadline).toLocaleDateString()}</p>
        </div>
        <div>
          <span className="text-gray-600">Budget:</span>
          <p className="font-medium text-gray-900">₹{project.budget}</p>
        </div>
        <div>
          <span className="text-gray-600">Created:</span>
          <p className="font-medium text-gray-900">{new Date(project.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {onViewDetails && (
        <button
          onClick={() => onViewDetails(project._id)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          <Eye className="w-4 h-4" />
          View Details
        </button>
      )}
    </div>
  );
}
