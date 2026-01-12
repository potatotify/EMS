import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// POST - Mark/Unmark NA for a project on a specific date
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { projectId, date, isNA } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Verify user is a lead assignee of this project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId)
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is a lead assignee
    let isLeadAssignee = false;
    if (project.leadAssignee) {
      if (Array.isArray(project.leadAssignee)) {
        isLeadAssignee = project.leadAssignee.some((lead: any) => {
          const leadId = typeof lead === 'object' && lead._id ? lead._id.toString() : lead.toString();
          return leadId === session.user.id;
        });
      } else {
        const leadId = typeof project.leadAssignee === 'object' && project.leadAssignee._id
          ? project.leadAssignee._id.toString()
          : project.leadAssignee.toString();
        isLeadAssignee = leadId === session.user.id;
      }
    }

    if (!isLeadAssignee) {
      return NextResponse.json({ error: 'Only lead assignees can mark NA' }, { status: 403 });
    }

    const targetDate = date ? new Date(date) : new Date();
    const dateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);

    if (isNA) {
      // Mark as NA
      await db.collection('dailyTaskNA').updateOne(
        {
          employeeId: new ObjectId(session.user.id),
          projectId: new ObjectId(projectId),
          date: { $gte: dateStart, $lt: dateEnd }
        },
        {
          $set: {
            employeeId: new ObjectId(session.user.id),
            projectId: new ObjectId(projectId),
            projectName: project.projectName || 'Unknown',
            date: dateStart,
            markedAt: new Date()
          }
        },
        { upsert: true }
      );
    } else {
      // Unmark NA
      await db.collection('dailyTaskNA').deleteOne({
        employeeId: new ObjectId(session.user.id),
        projectId: new ObjectId(projectId),
        date: { $gte: dateStart, $lt: dateEnd }
      });
    }

    return NextResponse.json({ 
      success: true,
      message: isNA ? 'Marked as NA for today' : 'NA status removed'
    });
  } catch (error) {
    console.error('Error marking task NA:', error);
    return NextResponse.json(
      { error: 'Failed to mark task NA' },
      { status: 500 }
    );
  }
}

// GET - Check if NA is marked for a project on a specific date
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const date = searchParams.get('date');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const targetDate = date ? new Date(date) : new Date();
    const dateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);

    const naRecord = await db.collection('dailyTaskNA').findOne({
      employeeId: new ObjectId(session.user.id),
      projectId: new ObjectId(projectId),
      date: { $gte: dateStart, $lt: dateEnd }
    });

    return NextResponse.json({ 
      isNA: !!naRecord
    });
  } catch (error) {
    console.error('Error checking task NA:', error);
    return NextResponse.json(
      { error: 'Failed to check task NA' },
      { status: 500 }
    );
  }
}
