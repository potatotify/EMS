import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');
    const userId = new ObjectId(session.user.id);
    const notifications: any[] = [];

    if (session.user.role === 'admin') {
      // Pending employee approvals
      const pendingEmployees = await db.collection('users')
        .countDocuments({ role: 'employee', isApproved: false });
      
      if (pendingEmployees > 0) {
        notifications.push({
          id: 'pending-approvals',
          type: 'approval',
          title: 'Pending Employee Approvals',
          message: `${pendingEmployees} employee(s) waiting for approval`,
          count: pendingEmployees,
          link: '/admin/dashboard?section=pending-approvals',
          priority: 'high',
          createdAt: new Date(),
        });
      }

      // Unread messages from employees
      const unreadMessages = await db.collection('userMessages')
        .countDocuments({
          receiverId: userId,
          receiverRole: 'admin',
          readByReceiver: false,
        });

      if (unreadMessages > 0) {
        notifications.push({
          id: 'unread-messages',
          type: 'message',
          title: 'New Messages',
          message: `${unreadMessages} unread message(s) from employees`,
          count: unreadMessages,
          link: '/admin/dashboard?section=messages',
          priority: 'medium',
          createdAt: new Date(),
        });
      }

      // Overdue projects
      const now = new Date();
      const overdueProjects = await db.collection('projects')
        .countDocuments({
          deadline: { $lt: now },
          status: { $in: ['in_progress', 'pending_assignment'] },
        });

      if (overdueProjects > 0) {
        notifications.push({
          id: 'overdue-projects',
          type: 'project',
          title: 'Overdue Projects',
          message: `${overdueProjects} project(s) past deadline`,
          count: overdueProjects,
          link: '/admin/dashboard?section=projects',
          priority: 'high',
          createdAt: new Date(),
        });
      }

      // Pending daily updates to review
      const pendingUpdates = await db.collection('dailyUpdates')
        .countDocuments({
          status: { $in: ['submitted', 'pending'] },
        });

      if (pendingUpdates > 0) {
        notifications.push({
          id: 'pending-updates',
          type: 'update',
          title: 'Pending Daily Updates',
          message: `${pendingUpdates} daily update(s) need review`,
          count: pendingUpdates,
          link: '/admin/dashboard?section=daily-updates',
          priority: 'medium',
          createdAt: new Date(),
        });
      }
    } else if (session.user.role === 'employee') {
      // Unread messages from admin
      const unreadMessages = await db.collection('userMessages')
        .countDocuments({
          receiverId: userId,
          receiverRole: 'employee',
          readByReceiver: false,
        });

      if (unreadMessages > 0) {
        notifications.push({
          id: 'unread-messages',
          type: 'message',
          title: 'New Messages',
          message: `${unreadMessages} unread message(s) from admin`,
          count: unreadMessages,
          link: '/employee/dashboard?section=messages',
          priority: 'medium',
          createdAt: new Date(),
        });
      }

      // Check if daily update not submitted today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query for today's update - need to convert userId to ObjectId if it's a string
      const employeeIdObj = userId instanceof ObjectId 
        ? userId 
        : new ObjectId(typeof userId === 'string' ? userId : String(userId));
      
      const todayUpdate = await db.collection('dailyUpdates')
        .findOne({
          employeeId: employeeIdObj,
          date: { 
            $gte: today, 
            $lt: tomorrow 
          },
        });

      // Only show reminder if no update exists OR status is 'pending' (not submitted/reviewed/approved)
      // If status is 'submitted', 'reviewed', or 'approved', don't show the reminder
      const submittedStatuses = ['submitted', 'reviewed', 'approved'];
      
      // Check if update exists and has a submitted status
      const hasSubmittedUpdate = todayUpdate && 
        todayUpdate.status && 
        submittedStatuses.includes(todayUpdate.status);
      
      // Debug logging
      if (todayUpdate) {
        console.log(`Daily update found for employee ${userId}: status=${todayUpdate.status}, hasSubmitted=${hasSubmittedUpdate}`);
      } else {
        console.log(`No daily update found for employee ${userId} today`);
      }
      
      // Only show reminder if we don't have a submitted update
      if (!hasSubmittedUpdate) {
        notifications.push({
          id: 'daily-update-reminder',
          type: 'reminder',
          title: 'Daily Update Reminder',
          message: 'Please submit your daily update',
          count: 1,
          link: '/employee/dashboard?section=daily-update',
          priority: 'high',
          createdAt: new Date(),
        });
      }

      // Overdue tasks
      const overdueTasks = await db.collection('tasks')
        .countDocuments({
          assignedTo: userId,
          status: { $ne: 'completed' },
          deadline: { $lt: new Date() },
        });

      if (overdueTasks > 0) {
        notifications.push({
          id: 'overdue-tasks',
          type: 'task',
          title: 'Overdue Tasks',
          message: `${overdueTasks} task(s) past deadline`,
          count: overdueTasks,
          link: '/employee/dashboard?section=tasks',
          priority: 'high',
          createdAt: new Date(),
        });
      }
    }

    const totalUnread = notifications.reduce((sum, n) => sum + n.count, 0);

    return NextResponse.json({
      notifications: notifications.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - 
               priorityOrder[b.priority as keyof typeof priorityOrder];
      }),
      unreadCount: totalUnread,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
