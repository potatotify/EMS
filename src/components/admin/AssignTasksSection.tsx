"use client";

import {useState, useEffect} from "react";
import {Users, Plus, Calendar, CheckCircle, Clock, AlertCircle, X} from "lucide-react";
import {motion} from "framer-motion";

interface Employee {
  _id: string;
  name: string;
  email: string;
  skills?: string[];
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

export default function AssignTasksSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium"
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchTasks(selectedEmployee);
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/employees/approved");
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.employees);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (employeeId: string) => {
    try {
      const response = await fetch(`/api/admin/employee/${employeeId}/tasks`);
      const data = await response.json();
      if (response.ok) {
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !formData.title.trim()) {
      alert("Please select an employee and enter a task title");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/employee/${selectedEmployee}/tasks`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          dueDate: formData.dueDate || null,
          priority: formData.priority
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert("Task assigned successfully!");
        setFormData({
          title: "",
          description: "",
          dueDate: "",
          priority: "medium"
        });
        setShowForm(false);
        if (selectedEmployee) {
          await fetchTasks(selectedEmployee);
        }
      } else {
        alert("Error: " + (data.error || "Failed to assign task"));
      }
    } catch (error) {
      console.error("Error assigning task:", error);
      alert("Failed to assign task");
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
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

  const getStatusColor = (status: string, completed: boolean) => {
    if (completed) return "bg-green-100 text-green-800";
    switch (status) {
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee Selection */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Employee to Assign Task
        </label>
        <select
          value={selectedEmployee}
          onChange={(e) => {
            setSelectedEmployee(e.target.value);
            setShowForm(false);
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white text-gray-900"
        >
          <option value="">Choose an employee...</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp._id}>
              {emp.name} ({emp.email}
              {emp.skills && emp.skills.length > 0
                ? ` - ${emp.skills.join(", ")}`
                : ""}
              )
            </option>
          ))}
        </select>
      </div>

      {selectedEmployee && (
        <>
          {/* Assign Task Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                Assign New Task
              </h3>
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                {showForm ? (
                  <>
                    <X className="w-4 h-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    New Task
                  </>
                )}
              </button>
            </div>

            {showForm && (
              <motion.form
                initial={{opacity: 0, height: 0}}
                animate={{opacity: 1, height: "auto"}}
                exit={{opacity: 0, height: 0}}
                onSubmit={handleSubmit}
                className="space-y-4 pt-4 border-t"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Task Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({...formData, title: e.target.value})
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Enter task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({...formData, description: e.target.value})
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Enter task description"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({...formData, dueDate: e.target.value})
                      }
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

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
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? "Assigning..." : "Assign Task"}
                </button>
              </motion.form>
            )}
          </div>

          {/* Tasks List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Assigned Tasks
                <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  {tasks.length}
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Task
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Assigned
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No tasks assigned yet
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr key={task._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {task.dueDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-gray-400">No due date</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                              task.status,
                              task.completed
                            )}`}
                          >
                            {task.completed ? "Completed" : task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(task.assignedAt).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedEmployee && (
        <div className="text-center py-16 border-2 border-dashed border-emerald-300/50 rounded-2xl bg-linear-to-br from-emerald-50/50 to-teal-50/50">
          <Users className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-800 mb-2">
            Select an Employee
          </p>
          <p className="text-slate-600 text-sm">
            Choose an employee from the dropdown above to assign tasks
          </p>
        </div>
      )}
    </div>
  );
}

