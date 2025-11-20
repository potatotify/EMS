"use client";

import {useState, useEffect} from "react";
import {CheckCircle, Calendar, AlertCircle, ListTodo} from "lucide-react";

interface Task {
  _id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: string;
  status: string;
  completed: boolean;
  assignedBy: string;
  assignedAt: string;
  completedAt: string | null;
}

export default function EmployeeTasksSection() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/employee/tasks");
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (
    taskId: string,
    currentCompleted: boolean
  ) => {
    setUpdatingTaskId(taskId);
    try {
      const response = await fetch(`/api/employee/tasks/${taskId}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({completed: !currentCompleted})
      });

      if (response.ok) {
        await fetchTasks(); // Refresh the task list
      } else {
        alert("Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Failed to update task");
    } finally {
      setUpdatingTaskId(null);
    }
  };

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

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-start mb-4">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
            {pendingTasks.length} Pending
          </span>
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">
            {completedTasks.length} Completed
          </span>
        </div>
      </div>
      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <ListTodo className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900 mb-2">
            No tasks assigned yet
          </p>
          <p className="text-gray-600">
            Tasks assigned by admin will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Pending Tasks
              </h3>
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <div
                    key={task._id}
                    className="border border-emerald-100 rounded-xl p-4 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span
                            className={`px-2 py-1 rounded-full font-medium ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span
                              className={`px-2 py-1 rounded-full flex items-center gap-1 ${
                                isOverdue(task.dueDate)
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                              {isOverdue(task.dueDate) && (
                                <AlertCircle className="w-3 h-3 ml-1" />
                              )}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Assigned by {task.assignedBy} on{" "}
                          {new Date(task.assignedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleToggleTask(task._id, task.completed)
                        }
                        disabled={updatingTaskId === task._id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                      >
                        {updatingTaskId === task._id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Mark Complete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Completed Tasks
              </h3>
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <div
                    key={task._id}
                    className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 shrink-0">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-500 line-through mb-1">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-gray-500 mb-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span
                            className={`px-2 py-1 rounded-full font-medium ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full font-medium">
                            Completed
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Completed on{" "}
                          {task.completedAt
                            ? new Date(task.completedAt).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
