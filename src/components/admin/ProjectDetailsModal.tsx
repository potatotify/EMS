"use client";

import {useState, useEffect} from "react";
import {
  X,
  Calendar,
  User,
  TrendingUp,
  Edit2,
  ExternalLink,
  Video,
  Trash2,
  Send,
  MessageSquare,
  Clock,
  Settings
} from "lucide-react";
import UpdateHistoryCard from "@/components/employee/UpdateHistoryCard";
import ProjectAssignmentModal from "./ProjectAssignmentModal";
import UpdateProjectModal from "./UpdateProjectModal";

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
  vaIncharge?: string | { name: string; email?: string };
  freelancer?: string;
  assignees?: Array<string | { name: string; email?: string; _id?: string }>;
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

interface Meeting {
  _id: string;
  projectId: string;
  meetingDate: string;
  meetingTime: string;
  topic: string;
  meetingLink: string;
  createdAt: string;
}

export default function ProjectDetailsModal({
  projectId,
  onClose,
  onUpdate
}: ProjectDetailsModalProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: "",
    meetingTime: "",
    topic: "",
    meetingLink: ""
  });
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/messages`);
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const fetchMeetings = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/meetings`);
      const data = await response.json();
      if (response.ok) {
        setMeetings(data.meetings || []);
      }
    } catch (error) {
      console.error("Error fetching meetings:", error);
    }
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchedulingMeeting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/meetings`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(meetingForm)
      });

      if (response.ok) {
        setMeetingForm({
          meetingDate: "",
          meetingTime: "",
          topic: "",
          meetingLink: ""
        });
        setShowScheduleForm(false);
        await fetchMeetings();
        alert("Meeting scheduled successfully!");
      } else {
        const data = await response.json();
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      alert("Failed to schedule meeting");
    } finally {
      setSchedulingMeeting(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm("Are you sure you want to delete this meeting?")) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/meetings?meetingId=${meetingId}`,
        {
          method: "DELETE"
        }
      );

      if (response.ok) {
        await fetchMeetings();
        alert("Meeting deleted successfully!");
      } else {
        alert("Failed to delete meeting");
      }
    } catch (error) {
      console.error("Error deleting meeting:", error);
      alert("Failed to delete meeting");
    }
  };
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: newMessage})
      });

      if (response.ok) {
        setNewMessage("");
        await fetchMessages();
      } else {
        alert("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    fetchUpdates();
    fetchMessages();
    fetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (response.ok) {
        setProject(data.project);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
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
      console.error("Error fetching updates:", error);
    }
  };

  const handleEditSuccess = async () => {
    await fetchProjectDetails();
    onUpdate();
    setShowEditModal(false);
  };

  const handleUpdateSuccess = async () => {
    await fetchProjectDetails();
    onUpdate();
    setShowUpdateModal(false);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {project.projectName}
            </h2>
            <p className="text-emerald-100 text-sm">
              Client: {project.clientName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUpdateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors"
            >
              <Settings className="w-4 h-4" />
              Update
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <p className="text-gray-900">{project.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <div className="flex items-center gap-2 text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {new Date(project.startDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deadline
                  </label>
                  <div className="flex items-center gap-2 text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {new Date(project.deadline).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget
                </label>
                <p className="text-gray-900 font-semibold">₹{project.budget}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    project.status
                  )}`}
                >
                  {project.status.replace("_", " ").toUpperCase()}
                </span>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <span className="text-gray-900 font-medium capitalize">
                  {project.priority}
                </span>
              </div>

              {/* Client Progress */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Visible Progress: {project.clientProgress || 0}%
                </label>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-emerald-600 h-4 rounded-full transition-all flex items-center justify-end pr-2"
                    style={{width: `${project.clientProgress || 0}%`}}
                  >
                    <span className="text-xs text-white font-semibold">
                      {project.clientProgress || 0}%
                    </span>
                  </div>
                </div>
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
                  <p className="text-gray-600 font-medium">Lead Assignee{Array.isArray(project.leadAssigneeDetails) && project.leadAssigneeDetails.length > 1 ? 's' : ''}</p>
                  {Array.isArray(project.leadAssigneeDetails) ? (
                    project.leadAssigneeDetails.map((lead: any, idx: number) => (
                      <div key={idx} className="mb-2">
                        <p className="text-gray-900">{lead.name}</p>
                        <p className="text-gray-500 text-xs">{lead.email}</p>
                      </div>
                    ))
                  ) : (
                    <>
                      <p className="text-gray-900">
                        {project.leadAssigneeDetails.name}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {project.leadAssigneeDetails.email}
                      </p>
                    </>
                  )}
                </div>
              )}
              {project.vaIncharge && (
                <div>
                  <p className="text-gray-600 font-medium">VA Incharge</p>
                  <p className="text-gray-900">
                    {typeof project.vaIncharge === 'object' ? project.vaIncharge.name : project.vaIncharge}
                  </p>
                  {typeof project.vaIncharge === 'object' && project.vaIncharge.email && (
                    <p className="text-gray-500 text-xs">{project.vaIncharge.email}</p>
                  )}
                </div>
              )}
              {project.assignees && Array.isArray(project.assignees) && project.assignees.length > 0 && (
                <div>
                  <p className="text-gray-600 font-medium">Assignees ({project.assignees.length})</p>
                  <div className="space-y-1">
                    {project.assignees.map((assignee, index) => (
                      <div key={index}>
                        <p className="text-gray-900">
                          {typeof assignee === 'object' ? assignee.name : assignee}
                        </p>
                        {typeof assignee === 'object' && assignee.email && (
                          <p className="text-gray-500 text-xs">{assignee.email}</p>
                        )}
                      </div>
                    ))}
                  </div>
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
                  <p className="text-gray-600 font-medium">
                    Coders Recommendation
                  </p>
                  <p className="text-gray-900">
                    {project.codersRecommendation}
                  </p>
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
          {(project.githubLink ||
            project.loomLink ||
            project.whatsappGroupLink) && (
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
                <p className="text-center text-gray-500 py-8">
                  No messages yet
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`flex ${
                      msg.senderRole === "admin"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.senderRole === "admin"
                          ? "bg-emerald-600 text-white"
                          : "bg-white border border-gray-200 text-gray-900"
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 opacity-80">
                        {msg.senderRole === "admin" ? "You" : msg.senderName}
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

          {/* Meeting Scheduling Section */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-600" />
                Scheduled Meetings ({meetings.length})
              </h3>
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-sm"
              >
                {showScheduleForm ? "Cancel" : "+ Schedule Meeting"}
              </button>
            </div>

            {/* Schedule Meeting Form */}
            {showScheduleForm && (
              <form
                onSubmit={handleScheduleMeeting}
                className="bg-gray-50 rounded-xl p-6 mb-6 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meeting Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={meetingForm.meetingDate}
                      onChange={(e) =>
                        setMeetingForm({
                          ...meetingForm,
                          meetingDate: e.target.value
                        })
                      }
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meeting Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={meetingForm.meetingTime}
                      onChange={(e) =>
                        setMeetingForm({
                          ...meetingForm,
                          meetingTime: e.target.value
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Topic *
                  </label>
                  <input
                    type="text"
                    required
                    value={meetingForm.topic}
                    onChange={(e) =>
                      setMeetingForm({...meetingForm, topic: e.target.value})
                    }
                    placeholder="e.g., Project kickoff, Progress review"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Link *
                  </label>
                  <input
                    type="url"
                    required
                    value={meetingForm.meetingLink}
                    onChange={(e) =>
                      setMeetingForm({
                        ...meetingForm,
                        meetingLink: e.target.value
                      })
                    }
                    placeholder="https://zoom.us/j/..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={schedulingMeeting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {schedulingMeeting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Schedule Meeting
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Meetings List */}
            <div className="space-y-3">
              {meetings.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No meetings scheduled yet</p>
                </div>
              ) : (
                meetings.map((meeting) => (
                  <div
                    key={meeting._id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          {meeting.topic}
                        </h4>
                        <div className="space-y-2 text-sm text-gray-600">
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-emerald-600" />
                            {new Date(meeting.meetingDate).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric"
                              }
                            )}
                          </p>
                          <p className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-600" />
                            <span className="text-base font-semibold text-gray-900">
                              {meeting.meetingTime}
                            </span>
                          </p>
                        </div>
                        <a
                          href={meeting.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Join Meeting
                        </a>
                      </div>
                      <button
                        onClick={() => handleDeleteMeeting(meeting._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete meeting"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Project Modal */}
      {showEditModal && project && (
        <ProjectAssignmentModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
          isEdit={true}
        />
      )}

      {/* Update Project Modal */}
      {showUpdateModal && project && (
        <UpdateProjectModal
          project={project}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </div>
  );
}
