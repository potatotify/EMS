"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Calendar, FolderKanban, Search, Briefcase } from "lucide-react";
import { motion } from "framer-motion";

interface EmployeeProject {
  _id: string;
  projectName: string;
  clientName: string;
  description: string;
  status: string;
  priority: string;
  deadline: string | null;
  createdAt: string | null;
  role: string;
}

interface Employee {
  _id: string;
  name: string;
  email: string;
  createdAt: string | null;
  projects: EmployeeProject[];
  projectCount: number;
}

export default function EmployeeProjectsTable() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/employees-with-projects");
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.employees || []);
      } else {
        console.error("Error fetching employees:", data.error);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "pending_assignment":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Lead Assignee":
        return "bg-purple-100 text-purple-700";
      case "VA Incharge":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.projects.some((p) =>
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search employees or projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Projects
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Project Count
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <React.Fragment key={employee._id}>
                    <tr
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => toggleEmployee(employee._id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                            {employee.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-neutral-900">{employee.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {employee.projects && employee.projects.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {employee.projects.map((project) => (
                              <span
                                key={project._id}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                title={project.projectName}
                              >
                                {project.projectName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-neutral-400">No projects assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-neutral-900">
                            {employee.projectCount}
                          </span>
                          <span className="text-sm text-neutral-500">projects</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {formatDate(employee.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                          {expandedEmployees.has(employee._id) ? "Hide" : "View"} Projects
                        </button>
                      </td>
                    </tr>
                    {expandedEmployees.has(employee._id) && employee.projects.length > 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-neutral-50">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-neutral-900 mb-3">
                              Projects ({employee.projects.length})
                            </h4>
                            <div className="grid gap-3">
                              {employee.projects.map((project) => (
                                <motion.div
                                  key={project._id}
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="bg-white rounded-lg border border-neutral-200 p-4"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h5 className="font-medium text-neutral-900">
                                          {project.projectName}
                                        </h5>
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(
                                            project.role
                                          )}`}
                                        >
                                          {project.role}
                                        </span>
                                      </div>
                                      <p className="text-sm text-neutral-600 mb-1">
                                        Client: <span className="font-medium">{project.clientName}</span>
                                      </p>
                                      {project.description && (
                                        <p className="text-sm text-neutral-600 mb-2">
                                          {project.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <span
                                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                                            project.status
                                          )}`}
                                        >
                                          {project.status}
                                        </span>
                                        <span
                                          className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                                            project.priority
                                          )}`}
                                        >
                                          {project.priority}
                                        </span>
                                        {project.deadline && (
                                          <div className="flex items-center gap-1 text-xs text-neutral-600">
                                            <Calendar className="w-3 h-3" />
                                            <span>Due: {formatDate(project.deadline)}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

