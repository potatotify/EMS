"use client";

import {useState, useEffect} from "react";
import {X, Trash2} from "lucide-react";

interface Client {
  _id: string;
  name: string;
  email: string;
}

interface Project {
  _id: string;
  projectName: string;
  status: string;
  priority: string;
  clientProgress?: number;
  clientId?: string;
  clientName?: string;
}

interface UpdateProjectModalProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UpdateProjectModal({
  project,
  onClose,
  onSuccess
}: UpdateProjectModalProps) {
  const [formData, setFormData] = useState({
    status: "",
    priority: "",
    clientProgress: 0,
    clientId: ""
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchClients();
    if (project) {
      setFormData({
        status: project.status || "",
        priority: project.priority || "medium",
        clientProgress: project.clientProgress || 0,
        clientId: project.clientId || ""
      });
    }
  }, [project]);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await fetch('/api/admin/clients');
      const data = await response.json();
      if (response.ok) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/update-project", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          projectId: project._id,
          ...formData
        })
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete project "${project.projectName}"? This will permanently delete all related tasks, updates, messages, and other data. This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/admin/delete-project?projectId=${project._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Project and all related data deleted successfully');
        onSuccess();
        onClose();
      } else {
        alert(data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('An error occurred while deleting project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8">
        <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Update Project</h2>
            <p className="text-emerald-100 text-sm mt-1">{project.projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client
            </label>
            {loadingClients ? (
              <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                Loading clients...
              </div>
            ) : (
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Select a client</option>
                <option value="none">No Client (Internal Project)</option>
                {clients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.name} ({client.email})
                  </option>
                ))}
              </select>
            )}
            {project.clientName && (
              <p className="text-xs text-gray-500 mt-1">
                Current client: {project.clientName}
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) =>
                setFormData({...formData, status: e.target.value})
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="client_meeting_done">Client Meeting Done</option>
              <option value="contact_made">Contact Made</option>
              <option value="active">Active</option>
              <option value="recontacted">Recontacted</option>
              <option value="stalled">Stalled</option>
              <option value="requirements_sent">Requirements Sent</option>
              <option value="waiting_for_requirement">Waiting for Requirement</option>
              <option value="awaiting_testimonial">Awaiting Testimonial</option>
              <option value="training">Training</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.priority}
              onChange={(e) =>
                setFormData({...formData, priority: e.target.value})
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Client Progress */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Visible Progress: {formData.clientProgress}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.clientProgress}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  clientProgress: parseInt(e.target.value)
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || deleting}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

