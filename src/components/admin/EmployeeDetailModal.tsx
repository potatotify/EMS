// src/components/admin/EmployeeDetailModal.tsx
"use client";

import {useState, useEffect} from "react";
import {
  X,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
  Mail,
  Phone,
  Briefcase,
  ClipboardList,
  ListTodo,
  Plus,
  Trash2
} from "lucide-react";

interface EmployeeProfile {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: string;
  joiningDate?: string;
}

interface DailyUpdateRecord {
  _id: string;
  date: string;
  status: string;
  adminApproved: boolean;
}

interface AttendanceRecord {
  _id: string;
  userId: string;
  date: string;
  workDetails: string;
  status?: string; // Add status field
  createdAt: string;
}

interface DailyUpdate {
  _id: string;
  date: string;
  tasksCompleted: string[];
  challenges?: string;
  nextSteps?: string;
  notes?: string;
  adminApproved?: boolean;
  status?: string;
}

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

interface Props {
  employeeId: string;
  onClose: () => void;
}

export default function EmployeeDetailModal({employeeId, onClose}: Props) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [dailyUpdates, setDailyUpdate] = useState<DailyUpdate[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("attendance"); // Default to attendance tab
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium"
  });
  const [submittingTask, setSubmittingTask] = useState(false);

  useEffect(() => {
    fetchEmployeeDetails();
    fetchTasks();
  }, [employeeId]);

  const fetchEmployeeDetails = async () => {
    setLoading(true);
    try {
      console.log("Fetching employee details for ID:", employeeId);
      const response = await fetch(`/api/admin/employee/${employeeId}`);
      const data = await response.json();
      console.log("API Response:", data);
      if (response.ok) {
        setProfile(data.profile);
        setAttendance(data.attendanceRecords || []);
        setDailyUpdate(data.dailyUpdates || []);
      } else {
        console.error("Error fetching employee details:", data.error);
      }
    } catch (error) {
      console.error("Error fetching employee details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(`/api/admin/employee/${employeeId}/tasks`);
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    setSubmittingTask(true);
    try {
      const response = await fetch(`/api/admin/employee/${employeeId}/tasks`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(taskForm)
      });

      if (response.ok) {
        setTaskForm({
          title: "",
          description: "",
          dueDate: "",
          priority: "medium"
        });
        await fetchTasks();
        alert("Task assigned successfully!");
      } else {
        const data = await response.json();
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error assigning task:", error);
      alert("Failed to assign task");
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const response = await fetch(
        `/api/admin/employee/${employeeId}/tasks?taskId=${taskId}`,
        {
          method: "DELETE"
        }
      );

      if (response.ok) {
        await fetchTasks();
        alert("Task deleted successfully!");
      } else {
        alert("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-emerald-100/50">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-200 border-t-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">
            Loading employee details...
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-emerald-100/50">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-600 px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Employee Details</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-1 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("profile")}
              className={`${
                activeTab === "profile"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab("attendance")}
              className={`${
                activeTab === "attendance"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveTab("updates")}
              className={`${
                activeTab === "updates"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Daily Updates ({dailyUpdates.length})
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`${
                activeTab === "tasks"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Assign Tasks ({tasks.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 p-4 rounded-xl bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-100/50">
                <div className="h-20 w-20 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                  {profile.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {profile.fullName}
                  </h1>
                  <p className="text-emerald-700 font-medium">
                    {profile.designation || "Employee"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-emerald-100/50 bg-white/50 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-emerald-900 mb-3">
                    Contact Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {profile.email}
                        </p>
                      </div>
                    </div>
                    {profile.phone && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
                          <Phone className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium text-gray-900">
                            {profile.phone}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-emerald-100/50 bg-white/50 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-emerald-900 mb-3">
                    Employment Details
                  </h3>
                  <div className="space-y-3">
                    {profile.department && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <Briefcase className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Department</p>
                          <p className="text-sm font-medium text-gray-900">
                            {profile.department}
                          </p>
                        </div>
                      </div>
                    )}
                    {profile.joiningDate && (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Joined</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(profile.joiningDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-blue-100/50 bg-blue-50/50 backdrop-blur-sm">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">
                    Daily Updates
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Total Submissions
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {dailyUpdates.length}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Approved</p>
                        <p className="text-sm font-medium text-gray-900">
                          {
                            dailyUpdates.filter((u: any) => u.adminApproved)
                              .length
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Employee ID</p>
                        <p className="text-xs font-mono text-gray-900 truncate">
                          {profile._id}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Daily Updates Attendance
                </h3>
                <div className="text-sm text-gray-500">
                  {dailyUpdates.length} submissions
                </div>
              </div>

              {dailyUpdates.length > 0 ? (
                <div className="space-y-6">
                  {/* Calendar View */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-4">
                      Attendance Calendar
                    </h4>
                    <div className="grid grid-cols-7 gap-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            className="text-center font-semibold text-gray-600 text-sm py-2"
                          >
                            {day}
                          </div>
                        )
                      )}
                      {(() => {
                        const today = new Date();
                        const currentMonth = today.getMonth();
                        const currentYear = today.getFullYear();
                        const firstDay = new Date(currentYear, currentMonth, 1);
                        const lastDay = new Date(
                          currentYear,
                          currentMonth + 1,
                          0
                        );
                        const daysInMonth = lastDay.getDate();
                        const startingDayOfWeek = firstDay.getDay();

                        // Get all submission dates
                        const submissionDates = new Set(
                          dailyUpdates.map((update) => {
                            const date = new Date(update.date);
                            return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                          })
                        );

                        const days = [];

                        // Empty cells for days before month starts
                        for (let i = 0; i < startingDayOfWeek; i++) {
                          days.push(
                            <div key={`empty-${i}`} className="p-2"></div>
                          );
                        }

                        // Days of the month
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dateKey = `${currentYear}-${currentMonth}-${day}`;
                          const hasSubmission = submissionDates.has(dateKey);

                          days.push(
                            <div
                              key={day}
                              className={`p-2 text-center rounded text-sm font-medium ${
                                hasSubmission
                                  ? "bg-green-100 text-green-800 border-2 border-green-400"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {day}
                            </div>
                          );
                        }

                        return days;
                      })()}
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div>
                        <span>Submitted</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-100 rounded"></div>
                        <span>No submission</span>
                      </div>
                    </div>
                  </div>

                  {/* Detailed List */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-4">
                      Submission Details
                    </h4>
                    <div className="space-y-3">
                      {dailyUpdates.map((update) => (
                        <div
                          key={update._id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                update.adminApproved
                                  ? "bg-green-500"
                                  : "bg-yellow-500"
                              }`}
                            ></div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(update.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    weekday: "short",
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric"
                                  }
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {update.status}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              update.adminApproved
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {update.adminApproved ? "Approved" : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No daily updates
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No daily update submissions found for this employee.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "updates" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Daily Updates
                </h3>
                <div className="text-sm text-gray-500">
                  Showing {dailyUpdates.length} updates
                </div>
              </div>

              {dailyUpdates.length > 0 ? (
                <div className="space-y-4">
                  {dailyUpdates.map((update) => (
                    <div
                      key={update._id}
                      className="group border border-emerald-100/50 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm hover:border-emerald-200 hover:shadow-md transition-all duration-300"
                    >
                      <div className="px-4 py-3 bg-linear-to-r from-emerald-50 to-teal-50 border-b border-emerald-100/50">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <Calendar className="h-4 w-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatDate(update.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {update.tasksCompleted &&
                          update.tasksCompleted.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Tasks Completed
                              </h4>
                              <ul className="list-disc pl-5 space-y-1">
                                {update.tasksCompleted.map((task, idx) => (
                                  <li
                                    key={idx}
                                    className="text-sm text-gray-600"
                                  >
                                    {task}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        {update.challenges && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">
                              Challenges Faced
                            </h4>
                            <p className="text-sm text-gray-600">
                              {update.challenges}
                            </p>
                          </div>
                        )}
                        {update.nextSteps && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">
                              Next Steps
                            </h4>
                            <p className="text-sm text-gray-600">
                              {update.nextSteps}
                            </p>
                          </div>
                        )}
                        {update.notes && (
                          <div className="pt-3 mt-3 border-t border-gray-100">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">
                              Notes
                            </h4>
                            <p className="text-sm text-gray-600">
                              {update.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No daily updates
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No daily updates found for this employee.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "tasks" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Assign Tasks
                </h3>
                <div className="text-sm text-gray-500">
                  {tasks.filter((t) => !t.completed).length} pending,{" "}
                  {tasks.filter((t) => t.completed).length} completed
                </div>
              </div>

              {/* Task Assignment Form */}
              <form
                onSubmit={handleAssignTask}
                className="bg-emerald-50/50 rounded-xl p-6 mb-6 border border-emerald-100"
              >
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  Assign New Task
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={taskForm.title}
                      onChange={(e) =>
                        setTaskForm({...taskForm, title: e.target.value})
                      }
                      placeholder="Enter task title"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={taskForm.description}
                      onChange={(e) =>
                        setTaskForm({...taskForm, description: e.target.value})
                      }
                      placeholder="Provide task details..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(e) =>
                          setTaskForm({...taskForm, dueDate: e.target.value})
                        }
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority
                      </label>
                      <select
                        value={taskForm.priority}
                        onChange={(e) =>
                          setTaskForm({...taskForm, priority: e.target.value})
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingTask || !taskForm.title.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingTask ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Assign Task
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Tasks List */}
              {tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task._id}
                      className={`border rounded-xl p-4 transition-all ${
                        task.completed
                          ? "bg-gray-50 border-gray-200"
                          : "bg-white border-emerald-100 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-1 w-5 h-5 rounded flex items-center justify-center ${
                                task.completed
                                  ? "bg-emerald-500"
                                  : "bg-gray-200"
                              }`}
                            >
                              {task.completed && (
                                <CheckCircle className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4
                                className={`font-semibold mb-1 ${
                                  task.completed
                                    ? "text-gray-500 line-through"
                                    : "text-gray-900"
                                }`}
                              >
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span
                                  className={`px-2 py-1 rounded-full font-medium ${
                                    task.priority === "urgent"
                                      ? "bg-red-100 text-red-800"
                                      : task.priority === "high"
                                      ? "bg-red-100 text-red-800"
                                      : task.priority === "medium"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {task.priority}
                                </span>
                                {task.dueDate && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Due:{" "}
                                    {new Date(
                                      task.dueDate
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-1 rounded-full font-medium ${
                                    task.completed
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {task.status}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                Assigned{" "}
                                {new Date(task.assignedAt).toLocaleDateString()}
                                {task.completedAt &&
                                  ` • Completed ${new Date(
                                    task.completedAt
                                  ).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <ListTodo className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No tasks assigned
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Use the form above to assign tasks to this employee.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
