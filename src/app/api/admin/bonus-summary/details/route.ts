import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeeName = searchParams.get('employeeName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!employeeName) {
      return NextResponse.json({ error: 'Employee name is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Find employee by name
    const employee = await db.collection('users').findOne({
      name: employeeName,
      role: 'employee'
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employeeId = employee._id;

    console.log('=== BONUS DETAILS DEBUG ===');
    console.log('Employee ID:', employeeId.toString());
    console.log('Employee Name:', employeeName);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDateTime;
    }

    console.log('Date Filter:', JSON.stringify(dateFilter));

    // Fetch tasks with bonus/penalty - check both assignees array and assignedTo field
    // Match the logic from bonus-summary route
    const tasksQuery: any = {
      $or: [
        { assignees: employeeId },
        { assignees: employeeId.toString() },
        { assignedTo: employeeId },
        { assignedTo: employeeId.toString() }
      ]
    };

    // Add date filter if exists
    if (Object.keys(dateFilter).length > 0) {
      tasksQuery.$or.push(
        { createdAt: dateFilter },
        { completedAt: dateFilter },
        { tickedAt: dateFilter },
        { assignedDate: dateFilter }
      );
    }

    console.log('Tasks Query:', JSON.stringify(tasksQuery));

    // Get all tasks
    const allTasks = await db.collection('tasks').find(tasksQuery).toArray();
    console.log('All tasks found:', allTasks.length);
    
    // Filter to only tasks with bonus or penalty and within date range
    const tasks = allTasks.filter(task => {
      const hasBonus = (task.bonusPoints && task.bonusPoints > 0) ||
                       (task.bonusCurrency && task.bonusCurrency > 0) ||
                       (task.penaltyPoints && task.penaltyPoints > 0) ||
                       (task.penaltyCurrency && task.penaltyCurrency > 0);
      
      if (!hasBonus) return false;

      // Check if this task is for this employee
      let isForEmployee = false;
      if (Array.isArray(task.assignees) && task.assignees.length > 0) {
        isForEmployee = task.assignees.some((id: any) => 
          id && (id.toString() === employeeId.toString())
        );
      } else if (task.assignedTo) {
        isForEmployee = task.assignedTo.toString() === employeeId.toString();
      }

      if (!isForEmployee) return false;

      // Check date if filter exists
      if (Object.keys(dateFilter).length > 0) {
        const taskDate = task.tickedAt || task.completedAt || task.assignedDate || task.createdAt;
        if (!taskDate) return false;
        
        const date = new Date(taskDate);
        if (dateFilter.$gte && date < dateFilter.$gte) return false;
        if (dateFilter.$lte && date > dateFilter.$lte) return false;
      }

      return true;
    });

    console.log('Tasks with bonus/penalty for employee:', tasks.length);
    if (tasks.length > 0) {
      console.log('First task sample:', {
        title: tasks[0].title,
        bonusPoints: tasks[0].bonusPoints,
        bonusCurrency: tasks[0].bonusCurrency,
        penaltyPoints: tasks[0].penaltyPoints,
        penaltyCurrency: tasks[0].penaltyCurrency,
        assignedTo: tasks[0].assignedTo,
        assignees: tasks[0].assignees
      });
    }

    // Populate project names for tasks
    const tasksWithDetails = await Promise.all(
      tasks.map(async (task) => {
        let projectName = 'Unknown Project';
        if (task.projectId) {
          const project = await db.collection('projects').findOne({
            _id: new ObjectId(task.projectId)
          });
          if (project) {
            projectName = project.projectName;
          }
        }

        return {
          date: task.completedAt || task.createdAt,
          taskTitle: task.title,
          projectName,
          bonusPoints: task.bonusPoints || 0,
          bonusCurrency: task.bonusCurrency || 0,
          penaltyPoints: task.penaltyPoints || 0,
          penaltyCurrency: task.penaltyCurrency || 0
        };
      })
    );

    // Fetch checklist rewards/fines from daily updates
    const dailyUpdatesQuery: any = {
      employeeId: employeeId,
      adminApproved: true
    };

    if (Object.keys(dateFilter).length > 0) {
      dailyUpdatesQuery.date = dateFilter;
    }

    const dailyUpdates = await db.collection('dailyUpdates').find(dailyUpdatesQuery).toArray();
    console.log('Daily updates found:', dailyUpdates.length);

    // Get checklist config to calculate rewards/fines
    const checklistConfig = await db.collection('checklistConfigs').findOne({ type: 'global' });
    const rewardMap = new Map<string, { bonus: number; bonusCurrency: number; fine: number; fineCurrency: number }>();
    
    if (checklistConfig && checklistConfig.checks) {
      for (const check of checklistConfig.checks) {
        if (typeof check === 'string') continue;
        const label = (check.text || '').toLowerCase().trim();
        if (!label) continue;
        rewardMap.set(label, {
          bonus: check.bonus || 0,
          bonusCurrency: check.bonusCurrency || 0,
          fine: check.fine || 0,
          fineCurrency: check.fineCurrency || 0
        });
      }
    }

    const checklistEntries: any[] = [];
    for (const du of dailyUpdates) {
      if (!du.checklist || !Array.isArray(du.checklist)) continue;
      
      for (const item of du.checklist) {
        const labelKey = (item.label || '').toLowerCase().trim();
        const cfg = rewardMap.get(labelKey);
        if (!cfg) continue;

        let bonusPoints = 0;
        let bonusCurrency = 0;
        let penaltyPoints = 0;
        let penaltyCurrency = 0;

        if (item.checked) {
          bonusPoints = cfg.bonus;
          bonusCurrency = cfg.bonusCurrency;
        } else {
          penaltyPoints = cfg.fine;
          penaltyCurrency = cfg.fineCurrency;
        }

        if (bonusPoints > 0 || bonusCurrency > 0 || penaltyPoints > 0 || penaltyCurrency > 0) {
          checklistEntries.push({
            date: du.date || du.createdAt,
            description: `Checklist: ${item.label}`,
            bonusPoints,
            bonusCurrency,
            penaltyPoints,
            penaltyCurrency
          });
        }
      }
    }

    console.log('Checklist entries with rewards/penalties:', checklistEntries.length);

    // Fetch project rewards/fines
    const projectsQuery: any = {
      leadAssignee: { $in: [employeeId, employeeId.toString()] }
    };

    if (Object.keys(dateFilter).length > 0) {
      projectsQuery.$or = [
        { assignedAt: dateFilter },
        { updatedAt: dateFilter },
        { createdAt: dateFilter }
      ];
    }

    const projects = await db.collection('projects').find(projectsQuery).toArray();
    console.log('Projects found:', projects.length);

    const projectEntries: any[] = [];
    for (const project of projects) {
      const bonusPoints = project.bonusPoints || 0;
      const bonusCurrency = project.bonusCurrency || 0;
      const penaltyPoints = project.penaltyPoints || 0;
      const penaltyCurrency = project.penaltyCurrency || 0;

      if (bonusPoints > 0 || bonusCurrency > 0 || penaltyPoints > 0 || penaltyCurrency > 0) {
        projectEntries.push({
          date: project.assignedAt || project.updatedAt || project.createdAt,
          description: `Project: ${project.projectName}`,
          projectName: project.projectName,
          bonusPoints,
          bonusCurrency,
          penaltyPoints,
          penaltyCurrency
        });
      }
    }

    console.log('Project entries with rewards/penalties:', projectEntries.length);

    // Fetch custom bonus entries
    const customBonusQuery: any = {
      $or: [
        { employeeId: employeeId },
        { employeeId: employeeId.toString() }
      ],
      'customBonusEntries.0': { $exists: true }
    };
    if (Object.keys(dateFilter).length > 0) {
      customBonusQuery.date = dateFilter;
    }

    const customBonusRows = await db.collection('bonusSummary').find(customBonusQuery).toArray();
    const customBonus: any[] = [];
    
    customBonusRows.forEach(row => {
      if (row.customBonusEntries && Array.isArray(row.customBonusEntries)) {
        row.customBonusEntries.forEach((entry: any) => {
          customBonus.push({
            date: row.date,
            description: entry.description,
            type: entry.type,
            value: entry.value
          });
        });
      }
    });

    // Fetch custom fine entries
    const customFineQuery: any = {
      $or: [
        { employeeId: employeeId },
        { employeeId: employeeId.toString() }
      ],
      'customFineEntries.0': { $exists: true }
    };
    if (Object.keys(dateFilter).length > 0) {
      customFineQuery.date = dateFilter;
    }

    const customFineRows = await db.collection('bonusSummary').find(customFineQuery).toArray();
    const customFine: any[] = [];
    
    customFineRows.forEach(row => {
      if (row.customFineEntries && Array.isArray(row.customFineEntries)) {
        row.customFineEntries.forEach((entry: any) => {
          customFine.push({
            date: row.date,
            description: entry.description,
            type: entry.type,
            value: entry.value
          });
        });
      }
    });

    // Calculate summary
    let totalPointsEarned = 0;
    let totalCurrencyEarned = 0;
    let totalPointsPenalty = 0;
    let totalCurrencyPenalty = 0;

    // Sum from tasks
    tasksWithDetails.forEach(task => {
      totalPointsEarned += task.bonusPoints;
      totalCurrencyEarned += task.bonusCurrency;
      totalPointsPenalty += task.penaltyPoints;
      totalCurrencyPenalty += task.penaltyCurrency;
    });

    // Sum from checklists
    checklistEntries.forEach(entry => {
      totalPointsEarned += entry.bonusPoints;
      totalCurrencyEarned += entry.bonusCurrency;
      totalPointsPenalty += entry.penaltyPoints;
      totalCurrencyPenalty += entry.penaltyCurrency;
    });

    // Sum from projects
    projectEntries.forEach(entry => {
      totalPointsEarned += entry.bonusPoints;
      totalCurrencyEarned += entry.bonusCurrency;
      totalPointsPenalty += entry.penaltyPoints;
      totalCurrencyPenalty += entry.penaltyCurrency;
    });

    // Sum from custom bonus
    customBonus.forEach(entry => {
      if (entry.type === 'points') {
        totalPointsEarned += entry.value;
      } else {
        totalCurrencyEarned += entry.value;
      }
    });

    // Sum from custom fine
    customFine.forEach(entry => {
      if (entry.type === 'points') {
        totalPointsPenalty += entry.value;
      } else {
        totalCurrencyPenalty += entry.value;
      }
    });

    return NextResponse.json({
      employeeName,
      tasks: tasksWithDetails,
      checklists: checklistEntries,
      projects: projectEntries,
      customBonus,
      customFine,
      summary: {
        totalPointsEarned,
        totalCurrencyEarned,
        totalPointsPenalty,
        totalCurrencyPenalty
      }
    });
  } catch (error) {
    console.error('Error fetching employee bonus details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee bonus details' },
      { status: 500 }
    );
  }
}
