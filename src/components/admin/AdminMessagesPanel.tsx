"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Send,
  MessageSquare,
  Search,
  User,
  Mail,
  Clock,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Users,
  Filter,
  Loader2
} from "lucide-react";

interface Employee {
  _id: string;
  name: string;
  email: string;
  skills?: string[];
}

interface Message {
  _id: string;
  senderId?: string;
  receiverId?: string;
  senderRole: string;
  receiverRole: string;
  message: string;
  createdAt: string;
  readByReceiver: boolean;
  sender?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  receiver?: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  isSent: boolean;
}

export default function AdminMessagesPanel() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composeMessage, setComposeMessage] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [messageFilter, setMessageFilter] = useState<"all" | "sent" | "received">("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchMessages();
    // Refresh messages every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch("/api/employees/approved");
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error("Error fetching employees for messaging", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await fetch("/api/admin/messages");
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Error fetching messages", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map((e) => e._id));
    }
  };

  const handleSend = async () => {
    if (!composeMessage.trim() || selectedIds.length === 0) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: selectedIds, message: composeMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`✓ Message sent to ${data.count} employee(s)`);
        setComposeMessage("");
        setSelectedIds([]);
        setTimeout(() => {
          setStatus(null);
          fetchMessages();
        }, 2000);
      } else {
        setStatus(`✗ ${data.error || "Failed to send message"}`);
      }
    } catch (err) {
      console.error("Error sending admin message", err);
      setStatus("✗ Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    const skillsText = (emp.skills || []).join(", ").toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      skillsText.includes(q)
    );
  });

  const filteredMessages = messages.filter((msg) => {
    if (messageFilter === "sent" && !msg.isSent) return false;
    if (messageFilter === "received" && msg.isSent) return false;
    if (selectedEmployee) {
      if (msg.isSent) {
        return msg.receiver?._id === selectedEmployee;
      } else {
        return msg.sender?._id === selectedEmployee;
      }
    }
    return true;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getUniqueEmployees = () => {
    const employeesMap = new Map<string, { name: string; email: string; lastMessage?: Date }>();
    
    messages.forEach((msg) => {
      if (msg.isSent && msg.receiver) {
        const key = msg.receiver._id;
        const existing = employeesMap.get(key);
        if (!existing || !existing.lastMessage || new Date(msg.createdAt) > existing.lastMessage) {
          employeesMap.set(key, {
            name: msg.receiver.name,
            email: msg.receiver.email,
            lastMessage: new Date(msg.createdAt),
          });
        }
      } else if (!msg.isSent && msg.sender) {
        const key = msg.sender._id;
        const existing = employeesMap.get(key);
        if (!existing || !existing.lastMessage || new Date(msg.createdAt) > existing.lastMessage) {
          employeesMap.set(key, {
            name: msg.sender.name,
            email: msg.sender.email,
            lastMessage: new Date(msg.createdAt),
          });
        }
      }
    });

    return Array.from(employeesMap.entries())
      .map(([id, data]) => ({ _id: id, ...data }))
      .sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return b.lastMessage.getTime() - a.lastMessage.getTime();
      });
  };

  const unreadCount = messages.filter((msg) => !msg.isSent && !msg.readByReceiver).length;
  const sentCount = messages.filter((msg) => msg.isSent).length;
  const receivedCount = messages.filter((msg) => !msg.isSent).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Messages</p>
              <p className="text-3xl font-bold mt-1">{messages.length}</p>
            </div>
            <MessageSquare className="w-10 h-10 opacity-80" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Sent</p>
              <p className="text-3xl font-bold mt-1">{sentCount}</p>
            </div>
            <ArrowUp className="w-10 h-10 opacity-80" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Received</p>
              <p className="text-3xl font-bold mt-1">{receivedCount}</p>
            </div>
            <ArrowDown className="w-10 h-10 opacity-80" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`rounded-xl p-4 text-white shadow-lg ${
            unreadCount > 0
              ? "bg-gradient-to-br from-red-500 to-pink-600"
              : "bg-gradient-to-br from-gray-500 to-gray-600"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-opacity-90 text-sm font-medium">Unread</p>
              <p className="text-3xl font-bold mt-1">{unreadCount}</p>
            </div>
            <Mail className="w-10 h-10 opacity-80" />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List - Takes 2 columns on large screens */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMessageFilter("all")}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    messageFilter === "all"
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setMessageFilter("sent")}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    messageFilter === "sent"
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  Sent
                </button>
                <button
                  onClick={() => setMessageFilter("received")}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                    messageFilter === "received"
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  Received
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={fetchMessages}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-600 font-medium">No messages found</p>
                <p className="text-neutral-500 text-sm mt-1">
                  {filter ? "Try adjusting your search" : "Start a conversation"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
                {filteredMessages.map((msg, idx) => {
                  const contact = msg.isSent ? msg.receiver : msg.sender;
                  return (
                    <motion.div
                      key={msg._id}
                      initial={{ opacity: 0, x: msg.isSent ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`p-4 hover:bg-neutral-50 transition-colors ${
                        !msg.readByReceiver && !msg.isSent ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                            msg.isSent
                              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                              : "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"
                          }`}
                        >
                          {contact?.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-neutral-900 text-sm">
                                {contact?.name || "Unknown"}
                              </p>
                              {!msg.isSent && !msg.readByReceiver && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              )}
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  msg.isSent
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {msg.isSent ? "Sent" : "Received"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-neutral-500">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTime(msg.createdAt)}
                            </div>
                          </div>
                          <p className="text-xs text-neutral-600 mb-1">{contact?.email}</p>
                          <p className="text-neutral-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compose Panel - Takes 1 column on large screens */}
        <div className="space-y-4">
          {/* Quick Contacts */}
          {getUniqueEmployees().length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Quick Contacts
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {getUniqueEmployees().slice(0, 5).map((emp) => (
                  <button
                    key={emp._id}
                    onClick={() => {
                      setSelectedEmployee(
                        selectedEmployee === emp._id ? null : emp._id
                      );
                      setMessageFilter("all");
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-colors text-sm ${
                      selectedEmployee === emp._id
                        ? "bg-emerald-100 text-emerald-900"
                        : "hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <p className="font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{emp.email}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compose Message */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Compose Message
            </h3>

            {/* Employee Selection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-neutral-700">
                  Select Employees
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {selectedIds.length === filteredEmployees.length
                    ? "Clear All"
                    : "Select All"}
                </button>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-neutral-200 rounded-lg p-2">
                {loadingEmployees ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center py-2">
                    No employees found
                  </p>
                ) : (
                  filteredEmployees.map((emp) => (
                    <label
                      key={emp._id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-neutral-50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp._id)}
                        onChange={() => toggleSelect(emp._id)}
                        className="w-3.5 h-3.5 text-emerald-600 border-neutral-300 rounded focus:ring-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-900 truncate">{emp.name}</p>
                        <p className="text-neutral-500 truncate">{emp.email}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Message Textarea */}
            <div className="mb-4">
              <label className="text-xs font-medium text-neutral-700 block mb-2">
                Message
              </label>
              <textarea
                rows={4}
                value={composeMessage}
                onChange={(e) => setComposeMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                placeholder="Type your message here..."
              />
              <p className="text-xs text-neutral-500 mt-1">
                {selectedIds.length} employee(s) selected
              </p>
            </div>

            {/* Status and Send Button */}
            {status && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  status.startsWith("✓")
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {status}
              </div>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !composeMessage.trim() || selectedIds.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}