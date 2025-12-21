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

    // Verify user is a lead assignee (support both single and array)
    const userId = new ObjectId(session.user.id);
    let isLeadAssignee = false;
    
    if (project.leadAssignee) {
      if (Array.isArray(project.leadAssignee)) {
        // Check if user is in the array of lead assignees
        isLeadAssignee = project.leadAssignee.some((lead: any) => {
          const leadId = typeof lead === 'string' ? new ObjectId(lead) : new ObjectId(lead);
          return leadId.equals(userId);
        });
      } else {
        // Single lead assignee (legacy)
        const leadAssigneeId = typeof project.leadAssignee === 'string' 
          ? new ObjectId(project.leadAssignee) 
          : new ObjectId(project.leadAssignee);
        isLeadAssignee = leadAssigneeId.equals(userId);
      }
    }

    if (!isLeadAssignee) {
      return NextResponse.json({ 
        error: 'Only the lead assignee can submit daily project updates' 
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
