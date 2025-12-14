"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  FolderKanban, 
  TrendingUp, 
  CheckCircle, 
  Calendar,
  MessageSquare,
  ListTodo,
  Shield,
  Loader2
} from "lucide-react";
import { PERMISSIONS } from "@/lib/permission-constants";
import EmployeesSection from "@/components/admin/EmployeesSection";
import ProjectsTable from "@/components/admin/ProjectsTable";
import DailyUpdatesReview from "@/components/admin/DailyUpdatesReview";
import AssignTasksSection from "@/components/admin/AssignTasksSection";
import AdminMessagesPanel from "@/components/admin/AdminMessagesPanel";

interface PermissionData {
  permissions: string[];
  isAdmin: boolean;
}

type FeatureSection = 
  | "employees" 
  | "projects" 
  | "daily-updates" 
  | "tasks" 
  | "attendance"
  | "messages"
  | null;

export default function AdminFeatures() {
  const [permissionData, setPermissionData] = useState<PermissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<FeatureSection>(null);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (activeSection === "projects") {
      fetchProjects();
    }
  }, [activeSection]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/employee/permissions");
      const data = await response.json();
      if (response.ok) {
        setPermissionData(data);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!permissionData) return false;
    if (permissionData.isAdmin) return true;
    return permissionData.permissions.includes(permission);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!permissionData || (!permissionData.isAdmin && permissionData.permissions.length === 0)) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <Shield className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
        <p>You don't have access to any admin features</p>
      </div>
    );
  }

  const availableFeatures = [
    {
      id: "employees" as FeatureSection,
      title: "Manage Employees",
      icon: <Users className="w-5 h-5" />,
      permission: PERMISSIONS.MANAGE_EMPLOYEES,
      description: "View and manage employee profiles"
    },
    {
      id: "projects" as FeatureSection,
      title: "Manage Projects",
      icon: <FolderKanban className="w-5 h-5" />,
      permission: PERMISSIONS.MANAGE_PROJECTS,
      description: "View and manage all projects"
    },
    {
      id: "daily-updates" as FeatureSection,
      title: "Review Daily Updates",
      icon: <TrendingUp className="w-5 h-5" />,
      permission: PERMISSIONS.REVIEW_DAILY_UPDATES,
      description: "Review and approve daily updates"
    },
    {
      id: "tasks" as FeatureSection,
      title: "Assign Tasks",
      icon: <CheckCircle className="w-5 h-5" />,
      permission: PERMISSIONS.ASSIGN_TASKS,
      description: "Assign and manage tasks"
    },
    {
      id: "attendance" as FeatureSection,
      title: "View Attendance",
      icon: <Calendar className="w-5 h-5" />,
      permission: PERMISSIONS.VIEW_ATTENDANCE,
      description: "View employee attendance records"
    },
    {
      id: "messages" as FeatureSection,
      title: "Messages",
      icon: <MessageSquare className="w-5 h-5" />,
      permission: PERMISSIONS.VIEW_MESSAGES,
      description: "View and manage messages"
    }
  ].filter(feature => {
    // For employees feature, check both MANAGE_EMPLOYEES and VIEW_EMPLOYEES
    if (feature.id === "employees") {
      return hasPermission(PERMISSIONS.MANAGE_EMPLOYEES) || hasPermission(PERMISSIONS.VIEW_EMPLOYEES);
    }
    return hasPermission(feature.permission);
  });

  const renderContent = () => {
    switch (activeSection) {
      case "employees":
        return <EmployeesSection />;
      case "projects":
        return (
          <ProjectsTable 
            projects={projects} 
            onViewDetails={() => {}} 
            onAssign={() => {}} 
            onRefresh={fetchProjects} 
          />
        );
      case "daily-updates":
        return <DailyUpdatesReview />;
      case "tasks":
        return <AssignTasksSection />;
      case "attendance":
        return <EmployeesSection />; // EmployeesSection includes attendance
      case "messages":
        return <AdminMessagesPanel />;
      default:
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">Admin Features</h2>
                  <p className="text-emerald-100">Access granted admin features based on your permissions</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableFeatures.map((feature) => (
                <motion.button
                  key={feature.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveSection(feature.id)}
                  className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200 hover:border-emerald-300 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                      {feature.icon}
                    </div>
                    <h3 className="font-semibold text-neutral-900">{feature.title}</h3>
                  </div>
                  <p className="text-sm text-neutral-600">{feature.description}</p>
                </motion.button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {activeSection && (
        <button
          onClick={() => setActiveSection(null)}
          className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
        >
          ← Back to Features
        </button>
      )}
      {renderContent()}
    </div>
  );
}

