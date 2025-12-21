"use client";

import {Users, Calendar, Tag, Eye} from "lucide-react";

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

interface ProjectListItemProps {
  project: Project;
  onAssign: (project: Project) => void;
  onViewDetails: (projectId: string) => void;
}

export default function ProjectListItem({
  project,
  onAssign,
  onViewDetails
}: ProjectListItemProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_assignment":
        return "bg-amber-100 text-amber-800";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "on_hold":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-600";
      case "high":
        return "text-red-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="group relative rounded-xl overflow-hidden border border-emerald-100/50 bg-white/80 backdrop-blur-md p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-emerald-200">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(20, 184, 166, 0.05))"
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {project.projectName}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Client:{" "}
              <span className="font-medium text-gray-900">
                {project.clientName}
              </span>
            </p>
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {project.description}
            </p>
          </div>
          <span
            className={`ml-4 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(
              project.status
            )}`}
          >
            {project.status.replace("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Deadline</p>
              <p className="font-medium text-gray-900">
                {new Date(project.deadline).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tag
              className={`w-4 h-4 ${getPriorityColor(
                project.priority
              )} shrink-0`}
            />
            <div>
              <p className="text-xs text-gray-500">Priority</p>
              <p
                className={`font-medium ${getPriorityColor(project.priority)}`}
              >
                {project.priority.charAt(0).toUpperCase() +
                  project.priority.slice(1)}
              </p>
            </div>
          </div>
          {project.leadAssignee && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Lead</p>
                <p className="font-medium text-gray-900 truncate">
                  {(() => {
                    const leadAssignee = project.leadAssignee;
                    if (Array.isArray(leadAssignee)) {
                      if (leadAssignee.length === 0) return "Assigned";
                      return leadAssignee.map(lead => lead?.name || 'Unknown').join(', ');
                    }
                    return leadAssignee.name || "Assigned";
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {project.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-xs px-2.5 py-1 bg-linear-to-r from-emerald-100 to-teal-100 text-emerald-700 rounded-full font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {project.status === "pending_assignment" && (
            <button
              onClick={() => onAssign(project)}
              className="flex-1 px-4 py-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium shadow-md transition-all duration-300 hover:shadow-lg"
            >
              Assign Project
            </button>
          )}
          <button
            onClick={() => onViewDetails(project._id)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium shadow-md transition-all duration-300 hover:shadow-lg"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">View Details</span>
          </button>
        </div>
      </div>
    </div>
  );
}
