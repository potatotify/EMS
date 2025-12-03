/**
 * Client-safe permission constants
 * This file can be imported in both client and server components
 */

// Define permissions directly here for client-side use
export const PERMISSIONS = {
  // Employee Management
  MANAGE_EMPLOYEES: 'manage_employees',
  APPROVE_EMPLOYEES: 'approve_employees',
  VIEW_EMPLOYEES: 'view_employees',
  
  // Project Management
  MANAGE_PROJECTS: 'manage_projects',
  ASSIGN_PROJECTS: 'assign_projects',
  VIEW_PROJECTS: 'view_projects',
  
  // Daily Updates
  REVIEW_DAILY_UPDATES: 'review_daily_updates',
  MANAGE_CHECKLISTS: 'manage_checklists',
  
  // Tasks
  ASSIGN_TASKS: 'assign_tasks',
  MANAGE_TASKS: 'manage_tasks',
  
  // Attendance
  VIEW_ATTENDANCE: 'view_attendance',
  MANAGE_ATTENDANCE: 'manage_attendance',
  
  // Leaderboard & Bonuses
  MANAGE_LEADERBOARD: 'manage_leaderboard',
  MANAGE_BONUSES: 'manage_bonuses',
  
  // Hackathons
  MANAGE_HACKATHONS: 'manage_hackathons',
  
  // Messages
  VIEW_MESSAGES: 'view_messages',
  MANAGE_MESSAGES: 'manage_messages',
  
  // Permissions Management (only for full admins)
  MANAGE_PERMISSIONS: 'manage_permissions',
} as const;

// Export the Permission type
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Permission descriptions for UI
 */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [PERMISSIONS.MANAGE_EMPLOYEES]: 'Add, edit, and remove employees',
  [PERMISSIONS.APPROVE_EMPLOYEES]: 'Approve or reject employee registrations',
  [PERMISSIONS.VIEW_EMPLOYEES]: 'View employee profiles and information',
  [PERMISSIONS.MANAGE_PROJECTS]: 'Create, edit, and delete projects',
  [PERMISSIONS.ASSIGN_PROJECTS]: 'Assign projects to employees',
  [PERMISSIONS.VIEW_PROJECTS]: 'View all projects',
  [PERMISSIONS.REVIEW_DAILY_UPDATES]: 'Review and approve daily updates',
  [PERMISSIONS.MANAGE_CHECKLISTS]: 'Manage daily update checklists',
  [PERMISSIONS.ASSIGN_TASKS]: 'Assign tasks to employees',
  [PERMISSIONS.MANAGE_TASKS]: 'Create, edit, and delete tasks',
  [PERMISSIONS.VIEW_ATTENDANCE]: 'View employee attendance records',
  [PERMISSIONS.MANAGE_ATTENDANCE]: 'Mark and modify attendance',
  [PERMISSIONS.MANAGE_LEADERBOARD]: 'Manage leaderboard and rankings',
  [PERMISSIONS.MANAGE_BONUSES]: 'Assign bonuses and fines',
  [PERMISSIONS.MANAGE_HACKATHONS]: 'Manage hackathons and events',
  [PERMISSIONS.VIEW_MESSAGES]: 'View messages and communications',
  [PERMISSIONS.MANAGE_MESSAGES]: 'Send and manage messages',
  [PERMISSIONS.MANAGE_PERMISSIONS]: 'Manage employee permissions (Admin only)',
};

/**
 * Permission categories for grouping in UI
 */
export const PERMISSION_CATEGORIES = {
  'Employee Management': [
    PERMISSIONS.MANAGE_EMPLOYEES,
    PERMISSIONS.APPROVE_EMPLOYEES,
    PERMISSIONS.VIEW_EMPLOYEES,
  ],
  'Project Management': [
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.ASSIGN_PROJECTS,
    PERMISSIONS.VIEW_PROJECTS,
  ],
  'Daily Updates': [
    PERMISSIONS.REVIEW_DAILY_UPDATES,
    PERMISSIONS.MANAGE_CHECKLISTS,
  ],
  'Tasks': [
    PERMISSIONS.ASSIGN_TASKS,
    PERMISSIONS.MANAGE_TASKS,
  ],
  'Attendance': [
    PERMISSIONS.VIEW_ATTENDANCE,
    PERMISSIONS.MANAGE_ATTENDANCE,
  ],
  'Leaderboard & Bonuses': [
    PERMISSIONS.MANAGE_LEADERBOARD,
    PERMISSIONS.MANAGE_BONUSES,
  ],
  'Hackathons': [
    PERMISSIONS.MANAGE_HACKATHONS,
  ],
  'Messages': [
    PERMISSIONS.VIEW_MESSAGES,
    PERMISSIONS.MANAGE_MESSAGES,
  ],
  'System': [
    PERMISSIONS.MANAGE_PERMISSIONS,
  ],
};

