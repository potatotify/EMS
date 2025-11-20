"use client";

import {useState, useEffect} from "react";
import {
  X,
  Calendar,
  TrendingUp,
  MessageSquare,
  Send,
  Video,
  ExternalLink,
  Clock
} from "lucide-react";

interface Project {
  _id: string;
  projectName: string;
  description: string;
  startDate: string;
  deadline: string;
  budget: string;
  status: string;
  clientProgress?: number;
  leadAssigneeDetails?: {
    name: string;
    email: string;
  };
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

interface ProjectDetailsModalProps {
  projectId: string;
  onClose: () => void;
}

export default function ProjectDetailsModal({
  projectId,
  onClose
}: ProjectDetailsModalProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchProjectDetails();
    fetchMessages();
    fetchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        const data = await response.json();
        setProject(data.project);
      } else {
        console.error("Failed to load project");
        alert("Failed to load project details");
        onClose();
      }
    } catch (error) {
      console.error("Error fetching project:", error);
      alert("Error loading project details");
      onClose();
    } finally {
      setLoading(false);
    }
  };

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
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-emerald-700 px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {project.projectName}
            </h2>
            <p className="text-emerald-100 text-sm">Project Details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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

              {project.leadAssigneeDetails && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead Developer
                  </label>
                  <p className="text-gray-900 font-medium">
                    {project.leadAssigneeDetails.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {project.leadAssigneeDetails.email}
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Progress
                </label>
                <div className="w-full bg-gray-200 rounded-full h-8">
                  <div
                    className="bg-linear-to-r from-emerald-500 to-emerald-600 h-8 rounded-full transition-all flex items-center justify-end pr-3"
                    style={{width: `${project.clientProgress || 0}%`}}
                  >
                    <span className="text-sm text-white font-bold">
                      {project.clientProgress || 0}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {project.clientProgress === 100
                    ? "Project completed!"
                    : "Work in progress"}
                </p>
              </div>
            </div>
          </div>

          {/* Messages Section */}
          <div className="border-t pt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              Message to Team
            </h3>

            {/* Messages List */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-96 overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`flex ${
                      msg.senderRole === "client"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.senderRole === "client"
                          ? "bg-emerald-600 text-white"
                          : "bg-white border border-gray-200 text-gray-900"
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 opacity-80">
                        {msg.senderRole === "client" ? "You" : msg.senderName}
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
                placeholder="Type your message..."
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

          {/* Scheduled Meetings Section */}
          <div className="border-t pt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-emerald-600" />
              Scheduled Meetings ({meetings.length})
            </h3>

            <div className="space-y-3">
              {meetings.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    No upcoming meetings scheduled
                  </p>
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
