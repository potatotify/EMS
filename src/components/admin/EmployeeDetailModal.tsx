// src/components/admin/EmployeeDetailModal.tsx
"use client";

import { useState, useEffect } from "react";
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

interface AttendanceRecord {
  _id: string;
  userId: string;
  date: string;
  workDetails: string;
  status?: string; // Add status field
  createdAt: string;
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

export default function EmployeeDetailModal({ employeeId, onClose }: Props) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        headers: { "Content-Type": "application/json" },
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
              className={`${activeTab === "profile"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab("attendance")}
              className={`${activeTab === "attendance"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
            >
              Attendance
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
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Attendance Records
                </h3>
                <div className="text-sm text-gray-500">
                  {attendance.length} records
                </div>
              </div>

              {attendance.length > 0 ? (
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

                        // Get all attendance dates
                        const attendanceDates = new Set(
                          attendance.map((record) => {
                            const date = new Date(record.date);
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
                          const hasAttendance = attendanceDates.has(dateKey);

                          days.push(
                            <div
                              key={day}
                              className={`p-2 text-center rounded text-sm font-medium ${hasAttendance
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
                        <span>Present</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-100 rounded"></div>
                        <span>Absent</span>
                      </div>
                    </div>
                  </div>

                  {/* Detailed List */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-4">
                      Attendance Details
                    </h4>
                    <div className="space-y-3">
                      {attendance.map((record) => (
                        <div
                          key={record._id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(record.date).toLocaleDateString(
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
                                {record.workDetails || "No details provided"}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                            Present
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
                    No attendance records
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No attendance records found for this employee.
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
