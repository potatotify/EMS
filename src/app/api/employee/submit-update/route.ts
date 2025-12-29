import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if the project exists and verify user is the lead assignee
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(data.projectId)
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify user is assigned to this project (check assignees array)
    const userId = new ObjectId(session.user.id);
    let isAssignedToProject = false;
    
    // Check if user is in the assignees array
    if (project.assignees && Array.isArray(project.assignees)) {
      isAssignedToProject = project.assignees.some((assignee: any) => {
        const assigneeId = typeof assignee === 'string' ? new ObjectId(assignee) : new ObjectId(assignee);
        return assigneeId.equals(userId);
      });
    }
    
    // Also check lead assignees as they should also be able to submit
    if (!isAssignedToProject && project.leadAssignee) {
      if (Array.isArray(project.leadAssignee)) {
        isAssignedToProject = project.leadAssignee.some((lead: any) => {
          const leadId = typeof lead === 'string' ? new ObjectId(lead) : new ObjectId(lead);
          return leadId.equals(userId);
        });
      } else {
        const leadAssigneeId = typeof project.leadAssignee === 'string' 
          ? new ObjectId(project.leadAssignee) 
          : new ObjectId(project.leadAssignee);
        isAssignedToProject = leadAssigneeId.equals(userId);
      }
    }

    if (!isAssignedToProject) {
      return NextResponse.json({ 
        error: 'Only employees assigned to this project can submit daily project updates' 
      }, { status: 403 });
    }

    // Create daily update
    const update = {
      projectId: new ObjectId(data.projectId),
      employeeId: new ObjectId(session.user.id),
      employeeName: session.user.name,
      date: new Date(),
      progress: data.progress, // percentage 0-100
      hoursWorked: data.hoursWorked,
      tasksCompleted: data.tasksCompleted || [],
      challenges: data.challenges || '',
      nextSteps: data.nextSteps || '',
      notes: data.notes || '',
      createdAt: new Date(),
    };

    await db.collection('dailyUpdates').insertOne(update);

    // Update project's last update timestamp
    await db.collection('projects').updateOne(
      { _id: new ObjectId(data.projectId) },
      {
        $set: {
          lastUpdateAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Update submitted successfully' 
    });
  } catch (error) {
    console.error('Error submitting update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
