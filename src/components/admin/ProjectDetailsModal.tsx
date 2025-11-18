'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, User, TrendingUp, Edit2, Save, ExternalLink } from 'lucide-react';
import UpdateHistoryCard from '@/components/employee/UpdateHistoryCard';
import { MessageSquare, Send } from 'lucide-react';


interface Project {
  _id: string;
  projectName: string;
  clientName: string;
  description: string;
  startDate: string;
  deadline: string;
  budget: string;
  status: string;
  priority: string;
  clientProgress?: number;
  leadAssigneeDetails?: {
    name: string;
    email: string;
  };
  vaIncharge?: string;
  freelancer?: string;
  updateIncharge?: string;
  codersRecommendation?: string;
  leadership?: string;
  githubLink?: string;
  loomLink?: string;
  whatsappGroupLink?: string;
  tags?: string[];
}

interface DailyUpdate {
  _id: string;
  employeeName: string;
  date: string;
  progress: number;
  hoursWorked: number;
  tasksCompleted: string[];
  challenges: string;
  nextSteps: string;
  notes: string;
}

interface ProjectDetailsModalProps {
  projectId: string;
  onClose: () => void;
  onUpdate: () => void;
}
interface Message {
  _id: string;
  senderRole: string;
  senderName: string;
  message: string;
  createdAt: string;
}


export default function ProjectDetailsModal({ projectId, onClose, onUpdate }: ProjectDetailsModalProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    status: '',
    priority: '',
    clientProgress: 0,
  });
  const [messages, setMessages] = useState<Message[]>([]);
const [newMessage, setNewMessage] = useState('');
const [sending, setSending] = useState(false);
const fetchMessages = async () => {
  try {
    const response = await fetch(`/api/projects/${projectId}/messages`);
    const data = await response.json();
    if (response.ok) {
      setMessages(data.messages);
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
};
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newMessage.trim()) return;

  setSending(true);
  try {
    const response = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage }),
    });

    if (response.ok) {
      setNewMessage('');
      await fetchMessages();
    } else {
      alert('Failed to send message');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  } finally {
    setSending(false);
  }
};

  

  useEffect(() => {
    fetchProjectDetails();
    fetchUpdates();
    fetchMessages();
  }, [projectId]);
  


  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (response.ok) {
        setProject(data.project);
        setEditData({
          status: data.project.status,
          priority: data.project.priority,
          clientProgress: data.project.clientProgress || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpdates = async () => {
    try {
      const response = await fetch(`/api/admin/project-updates/${projectId}`);
      const data = await response.json();
      if (response.ok) {
        setUpdates(data.updates);
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project?._id,
          ...editData,
        }),
      });

      if (response.ok) {
        await fetchProjectDetails();
        setEditMode(false);
        onUpdate();
        alert('Project updated successfully!');
      } else {
        const data = await response.json();
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_assignment': return 'bg-amber-100 text-amber-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'on_hold': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{project.projectName}</h2>
            <p className="text-emerald-100 text-sm">Client: {project.clientName}</p>
          </div>
          <div className="flex items-center gap-3">
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit Project
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 hover:bg-emerald-50 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Project Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-gray-900">{project.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <div className="flex items-center gap-2 text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {new Date(project.startDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                  <div className="flex items-center gap-2 text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {new Date(project.deadline).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                <p className="text-gray-900 font-semibold">₹{project.budget}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                {editMode ? (
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="pending_assignment">Pending Assignment</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                ) : (
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}>
                    {project.status.replace('_', ' ').toUpperCase()}
                  </span>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                {editMode ? (
                  <select
                    value={editData.priority}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                ) : (
                  <span className="text-gray-900 font-medium capitalize">{project.priority}</span>
                )}
              </div>

              {/* Client Progress */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Visible Progress: {editData.clientProgress}%
                </label>
                {editMode ? (
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editData.clientProgress}
                    onChange={(e) => setEditData({ ...editData, clientProgress: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                ) : (
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-emerald-600 h-4 rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: `${project.clientProgress || 0}%` }}
                    >
                      <span className="text-xs text-white font-semibold">
                        {project.clientProgress || 0}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Team Details */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              Team Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {project.leadAssigneeDetails && (
                <div>
                  <p className="text-gray-600 font-medium">Lead Assignee</p>
                  <p className="text-gray-900">{project.leadAssigneeDetails.name}</p>
                  <p className="text-gray-500 text-xs">{project.leadAssigneeDetails.email}</p>
                </div>
              )}
              {project.vaIncharge && (
                <div>
                  <p className="text-gray-600 font-medium">VA Incharge</p>
                  <p className="text-gray-900">{project.vaIncharge}</p>
                </div>
              )}
              {project.updateIncharge && (
                <div>
                  <p className="text-gray-600 font-medium">Update Incharge</p>
                  <p className="text-gray-900">{project.updateIncharge}</p>
                </div>
              )}
              {project.freelancer && (
                <div>
                  <p className="text-gray-600 font-medium">Freelancer</p>
                  <p className="text-gray-900">{project.freelancer}</p>
                </div>
              )}
              {project.codersRecommendation && (
                <div>
                  <p className="text-gray-600 font-medium">Coders Recommendation</p>
                  <p className="text-gray-900">{project.codersRecommendation}</p>
                </div>
              )}
              {project.leadership && (
                <div>
                  <p className="text-gray-600 font-medium">Leadership</p>
                  <p className="text-gray-900">{project.leadership}</p>
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          {(project.githubLink || project.loomLink || project.whatsappGroupLink) && (
            <div className="flex flex-wrap gap-3">
              {project.githubLink && (
                <a
                  href={project.githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  GitHub
                </a>
              )}
              {project.loomLink && (
                <a
                  href={project.loomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Loom
                </a>
              )}
              {project.whatsappGroupLink && (
                <a
                  href={project.whatsappGroupLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
            </div>
          )}

          {/* Daily Updates Section */}
          <div className="border-t pt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Daily Updates ({updates.length})
            </h3>
            {updates.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No updates submitted yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div key={update._id}>
                    <p className="text-sm font-medium text-emerald-700 mb-2">
                      By: {update.employeeName}
                    </p>
                    <UpdateHistoryCard update={update} />
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Messages Section */}
<div className="border-t pt-6">
  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
    <MessageSquare className="w-5 h-5 text-emerald-600" />
    Messages with Client
  </h3>

  {/* Messages List */}
  <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-96 overflow-y-auto space-y-3">
    {messages.length === 0 ? (
      <p className="text-center text-gray-500 py-8">No messages yet</p>
    ) : (
      messages.map((msg) => (
        <div
          key={msg._id}
          className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] rounded-lg p-3 ${
              msg.senderRole === 'admin'
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}
          >
            <p className="text-xs font-semibold mb-1 opacity-80">
              {msg.senderRole === 'admin' ? 'You' : msg.senderName}
            </p>
            <p className="text-sm">{msg.message}</p>
            <p className="text-xs mt-1 opacity-70">
              {new Date(msg.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))
    )}
  </div>

  {/* Message Input */}
  <form onSubmit={handleSendMessage} className="flex gap-2">
    <input
      type="text"
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      placeholder="Type your message to client..."
      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
    />
    <button
      type="submit"
      disabled={sending || !newMessage.trim()}
      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {sending ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <Send className="w-4 h-4" />
          Send
        </>
      )}
    </button>
  </form>
</div>

        </div>
      </div>
    </div>
  );
}
