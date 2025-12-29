"use client";

import {useSession} from "next-auth/react";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {Calendar, Clock, User, TrendingUp, Lock, ListTodo, CalendarClock} from "lucide-react";
import PlannedTimeModal from "./PlannedTimeModal";

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
  leadAssignee?: any;
  assignees?: any[];
}

interface ProjectProgressCardProps {
  project: Project;
  onUpdate: (project: Project) => void;
}

export default function ProjectProgressCard({
  project,
  onUpdate
}: ProjectProgressCardProps) {
  const {data: session} = useSession();
  const router = useRouter();
  const [showPlannedTimeModal, setShowPlannedTimeModal] = useState(false);
  
  // Check if current user is the lead assignee (supports both single and array)
  const userId = (session?.user as any)?.id;
  const isLeadAssignee = (() => {
    if (!project.leadAssignee) return false;
    
    if (Array.isArray(project.leadAssignee)) {
      // Check if user is in the array of lead assignees
      return project.leadAssignee.some((lead: any) => {
        if (typeof lead === 'object' && lead._id) {
          return lead._id === userId;
        }
        return lead === userId;
      });
    }
    
    // Single lead assignee (legacy)
    if (typeof project.leadAssignee === 'object' && project.leadAssignee._id) {
      return project.leadAssignee._id === userId;
    }
    return project.leadAssignee === userId;
  })();

  // Check if current user is assigned to the project (lead or regular assignee)
  const isAssignedToProject = (() => {
    // Check if user is lead assignee
    if (isLeadAssignee) return true;

    // Check if user is in assignees array
    if (project.assignees && Array.isArray(project.assignees)) {
      return project.assignees.some((assignee: any) => {
        if (typeof assignee === 'object' && assignee._id) {
          return assignee._id === userId;
        }
        return assignee === userId;
      });
    }

    return false;
  })();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityText = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const getStatusText = (status: string) => {
    return status
      .replace("_", " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {project.projectName}
          </h3>
          <p className="text-sm text-gray-600">{project.description}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(
            project.priority
          )}`}
        >
          {getPriorityText(project.priority)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-500" />
          <div>
            <p className="text-gray-600">Deadline</p>
            <p className="font-medium text-gray-900">
              {new Date(project.deadline).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-gray-500" />
          <div>
            <p className="text-gray-600">Status</p>
            <p className="font-medium text-gray-900">
              {getStatusText(project.status)}
            </p>
          </div>
        </div>
      </div>

      {/* Links */}
      {(project.githubLink ||
        project.loomLink ||
        project.whatsappGroupLink) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {project.githubLink && (
            <a
              href={project.githubLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
            >
              GitHub
            </a>
          )}
          {project.loomLink && (
            <a
              href={project.loomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 bg-purple-100 hover:bg-purple-200 rounded-full text-purple-700 transition-colors"
            >
              Loom
            </a>
          )}
          {project.whatsappGroupLink && (
            <a
              href={project.whatsappGroupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 rounded-full text-green-700 transition-colors"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/employee/project-tasks?projectId=${project._id}`)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <ListTodo className="w-4 h-4" />
            View Tasks
          </button>
          {isAssignedToProject ? (
            <button
              onClick={() => onUpdate(project)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              Submit Update
            </button>
          ) : (
            <div className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded-lg font-medium cursor-not-allowed">
              <Lock className="w-4 h-4" />
              Not Assigned
            </div>
          )}
        </div>
        {isLeadAssignee && (
          <button
            onClick={() => setShowPlannedTimeModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            <CalendarClock className="w-4 h-4" />
            Planned Time
          </button>
        )}
      </div>

      {showPlannedTimeModal && (
        <PlannedTimeModal
          projectId={project._id}
          projectName={project.projectName}
          currentPlannedDate={(project as any).plannedDate}
          currentPlannedTime={(project as any).plannedTime}
          onClose={() => setShowPlannedTimeModal(false)}
          onSuccess={async () => {
            // Refresh project data by fetching from API
            try {
              const response = await fetch(`/api/projects/${project._id}`);
              if (response.ok) {
                const data = await response.json();
                if (data.project && onUpdate) {
                  onUpdate(data.project);
                }
              }
            } catch (error) {
              console.error("Error refreshing project:", error);
            }
          }}
        />
      )}
    </div>
  );
}
