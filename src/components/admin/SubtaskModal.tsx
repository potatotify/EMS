"use client";

import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Calendar,
  User,
  Flag,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type SubtaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";

interface Subtask {
  _id: string;
  taskId: string;
  projectId: string;
  title: string;
  description?: string;
  assignee?: { _id: string; name: string; email: string };
  assigneeName?: string;
  dueDate?: string;
  dueTime?: string;
  priority: number;
  status: SubtaskStatus;
  ticked: boolean;
  tickedAt?: string;
  completedAt?: string;
  completedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  order: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Employee {
  _id: string;
  name: string;
  email?: string;
}

interface SubtaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectEmployees: Employee[];
  currentUserId: string;
  isLeadAssignee?: boolean;
  isAdmin?: boolean;
  onSubtasksChange?: () => void;
}

export default function SubtaskModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  projectId,
  projectEmployees,
  currentUserId,
  isLeadAssignee = false,
  isAdmin = false,
  onSubtasksChange,
}: SubtaskModalProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignee: "", // Single assignee ID
    dueDate: "",
    dueTime: "",
    priority: 2,
  });

  useEffect(() => {
    if (isOpen) {
      fetchSubtasks();
    }
  }, [isOpen, taskId]);

  const fetchSubtasks = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/subtasks?taskId=${taskId}`);
      const data = await response.json();
      
      if (response.ok) {
        setSubtasks(data.subtasks || []);
      } else {
        setError(data.error || "Failed to fetch subtasks");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch subtasks");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubtask = async () => {
    if (!formData.title.trim()) {
      setError("Subtask title is required");
      return;
    }
    if (!formData.assignee) {
      setError("Assignee is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          projectId,
          ...formData,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSubtasks([...subtasks, data.subtask]);
        setFormData({
          title: "",
          description: "",
          assignee: "",
          dueDate: "",
          dueTime: "",
          priority: 2,
        });
        setShowAddForm(false);
        if (onSubtasksChange) onSubtasksChange();
      } else {
        setError(data.error || "Failed to create subtask");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create subtask");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubtask = async () => {
    if (!editingSubtask) return;
    if (!formData.title.trim()) {
      setError("Subtask title is required");
      return;
    }
    if (!formData.assignee) {
      setError("Assignee is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/subtasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtaskId: editingSubtask,
          ...formData,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSubtasks(subtasks.map((st) => 
          st._id === editingSubtask ? data.subtask : st
        ));
        setFormData({
          title: "",
          description: "",
          assignee: "",
          dueDate: "",
          dueTime: "",
          priority: 2,
        });
        setShowAddForm(false);
        if (onSubtasksChange) onSubtasksChange();
      } else {
        setError(data.error || "Failed to create subtask");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create subtask");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentTicked: boolean) => {
    const newTicked = !currentTicked;
    
    // Find the subtask to check assignment
    const subtask = subtasks.find(s => s._id === subtaskId);
    if (!subtask) {
      setError("Subtask not found");
      return;
    }
    
    // Check if user is the assignee or admin/lead before allowing toggle
    const isAssignee = subtask.assignee?._id === currentUserId;
    const canManageSubtasks = isAdmin || isLeadAssignee;
    
    if (!isAssignee && !canManageSubtasks) {
      setError("You can only tick subtasks assigned to you");
      return;
    }
    
    // If completing the subtask, ask for time spent (only if user is the assignee)
    let timeSpent: number | undefined;
    if (newTicked) {
      // Only ask for hours if the user is the assignee (not admin/lead)
      if (isAssignee) {
        const timeInput = prompt("How many hours did you spend on this subtask?");
        if (timeInput === null) {
          // User cancelled
          return;
        }
        const parsedTime = parseFloat(timeInput);
        if (isNaN(parsedTime) || parsedTime < 0) {
          alert("Please enter a valid number of hours (e.g., 2.5 for 2 hours 30 minutes)");
          return;
        }
        timeSpent = parsedTime;
      }
    }
    
    setLoading(true);
    setError("");
    try {
      const requestBody: any = {
        ticked: newTicked,
      };
      if (timeSpent !== undefined) {
        requestBody.timeSpent = timeSpent;
      }
      
      const response = await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Refresh subtasks list
        await fetchSubtasks();
        if (onSubtasksChange) onSubtasksChange();
      } else {
        setError(data.error || "Failed to update subtask");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update subtask");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!confirm("Are you sure you want to delete this subtask?")) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/subtasks?subtaskId=${subtaskId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      
      if (response.ok) {
        setSubtasks(subtasks.filter((st) => st._id !== subtaskId));
        if (onSubtasksChange) onSubtasksChange();
      } else {
        setError(data.error || "Failed to delete subtask");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete subtask");
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (employeeId: string) => {
    setFormData({
      ...formData,
      assignee: employeeId,
    });
  };

  const handleEditSubtask = (subtask: Subtask) => {
    setEditingSubtask(subtask._id);
    setFormData({
      title: subtask.title,
      description: subtask.description || "",
      assignee: subtask.assignee?._id || "",
      dueDate: subtask.dueDate || "",
      dueTime: subtask.dueTime || "",
      priority: subtask.priority,
    });
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingSubtask(null);
    setFormData({
      title: "",
      description: "",
      assignee: "",
      dueDate: "",
      dueTime: "",
      priority: 2,
    });
    setShowAddForm(false);
  };

  const canManageSubtasks = isAdmin || isLeadAssignee;
  const completedCount = subtasks.filter((st) => st.status === "completed").length;
  const totalCount = subtasks.length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl border border-neutral-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="border-b border-neutral-200 p-6 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">Subtasks</h2>
              <p className="text-neutral-600 text-sm">
                {taskTitle} • <span className="text-emerald-600 font-medium">{completedCount}/{totalCount}</span> completed
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-neutral-50">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Subtasks List */}
            <div className="space-y-3 mb-6">
              {subtasks.length === 0 && !showAddForm && (
                <div className="text-center py-12 text-neutral-400">
                  <Circle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-neutral-600 font-medium">No subtasks yet</p>
                  <p className="text-sm mt-1">Click "Add Subtask" to create one</p>
                </div>
              )}

              {subtasks.map((subtask) => {
                const canToggle = subtask.assignee?._id === currentUserId || canManageSubtasks;
                
                return (
                  <div
                    key={subtask._id}
                    className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Checkbox */}
                      <button
                        onClick={() => {
                          if (canToggle) {
                            handleToggleSubtask(subtask._id, subtask.ticked);
                          }
                        }}
                        disabled={!canToggle}
                        className={`mt-1 ${canToggle ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        title={!canToggle ? "Only assignee or admin/lead can toggle this subtask" : ""}
                      >
                        {subtask.ticked ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-neutral-400 hover:text-emerald-500 transition-colors" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium ${subtask.ticked ? "text-neutral-400 line-through" : "text-neutral-800"}`}>
                          {subtask.title}
                        </h4>
                        {subtask.description && (
                          <p className="text-sm text-neutral-600 mt-1">{subtask.description}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          {/* Assignee */}
                          <div className="flex items-center gap-2 text-sm text-neutral-600">
                            <User className="w-4 h-4 text-blue-500" />
                            <span>{subtask.assignee?.name || subtask.assigneeName || "Unassigned"}</span>
                          </div>

                          {/* Priority */}
                          <div className="flex items-center gap-2 text-sm">
                            <Flag className={`w-4 h-4 ${
                              subtask.priority >= 8 ? 'text-red-500' :
                              subtask.priority >= 5 ? 'text-orange-500' :
                              subtask.priority >= 3 ? 'text-yellow-500' :
                              'text-neutral-400'
                            }`} />
                            <span className="text-neutral-600">P{subtask.priority}</span>
                          </div>

                          {/* Due Date */}
                          {subtask.dueDate && (
                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                              <Calendar className="w-4 h-4 text-purple-500" />
                              <span>{new Date(subtask.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}

                          {/* Completed Info */}
                          {subtask.ticked && subtask.completedBy && (
                            <div className="flex items-center gap-2 text-sm text-emerald-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>by {subtask.completedBy.name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {canManageSubtasks && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditSubtask(subtask)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-500"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteSubtask(subtask._id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Subtask Form */}
            {showAddForm && canManageSubtasks && (
              <div className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm">
                <h4 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  {editingSubtask ? "Edit Subtask" : "New Subtask"}
                </h4>
                
                {/* Title */}
                <input
                  type="text"
                  placeholder="Subtask title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 mb-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 placeholder:text-neutral-400"
                />

                {/* Description */}
                <textarea
                  placeholder="Description (optional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 mb-3 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 resize-none placeholder:text-neutral-400"
                  rows={2}
                />

                {/* Assignee */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-neutral-700 mb-2 block">Assign To</label>
                  <select
                    value={formData.assignee}
                    onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Select an employee</option>
                    {projectEmployees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date & Priority */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-700 mb-2 block">Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-700 mb-2 block">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                        <option key={p} value={p}>P{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={editingSubtask ? handleUpdateSubtask : handleCreateSubtask}
                    disabled={loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    {editingSubtask ? "Update Subtask" : "Save Subtask"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {canManageSubtasks && (
            <div className="border-t border-neutral-200 p-4 bg-white">
              {!showAddForm && (
                <button
                  onClick={() => {
                    setEditingSubtask(null);
                    setShowAddForm(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Subtask
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
