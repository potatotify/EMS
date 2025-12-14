import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin or has permission to view projects
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();
    const client = await clientPromise;
    const db = client.db('worknest');

    const projects = await db.collection('projects').find({}).toArray();
    
    if (!projects || projects.length === 0) {
      return NextResponse.json({ projects: [] });
    }
    const now = new Date();

    const projectsWithAnalysis = await Promise.all(projects.map(async (project: any) => {
      let daysRemaining = null;
      let daysOverdue = 0;
      if (project.deadline) {
        try {
          const deadline = new Date(project.deadline);
          if (!isNaN(deadline.getTime())) {
            daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            daysOverdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;
          }
        } catch (e) {
          console.error('Error calculating deadline for project:', project._id, e);
        }
      }

      // Get project updates
      const projectIdObj = project._id instanceof ObjectId ? project._id : new ObjectId(project._id);
      const updates = await db.collection('dailyUpdates').find({
        projectId: projectIdObj
      }).toArray();

      const totalUpdates = updates.length;
      const totalHours = updates.reduce((sum: number, update: any) => {
        return sum + (update.hoursWorked || 0);
      }, 0);

      // Get lead assignee details
      let leadAssignee = null;
      if (project.leadAssignee) {
        try {
          // Handle different types: ObjectId, string, or FlattenMaps<ObjectId>
          let leadId: ObjectId;
          if (project.leadAssignee instanceof ObjectId) {
            leadId = project.leadAssignee;
          } else if (typeof project.leadAssignee === 'string') {
            leadId = new ObjectId(project.leadAssignee);
          } else {
            leadId = new ObjectId(String(project.leadAssignee));
          }
          const leadUser = await db.collection('users').findOne({
            _id: leadId
          });
          const leadProfile = await db.collection('employeeProfiles').findOne({
            userId: leadId
          });
          if (leadUser) {
            leadAssignee = {
              name: leadProfile?.fullName || leadUser.name || 'Unknown',
              email: leadUser.email || ''
            };
          }
        } catch (e) {
          console.error('Error fetching lead assignee:', e);
        }
      }

      // Get VA incharge details
      let vaIncharge = null;
      if (project.vaIncharge) {
        try {
          // Handle different types: ObjectId, string, or FlattenMaps<ObjectId>
          let vaId: ObjectId;
          if (project.vaIncharge instanceof ObjectId) {
            vaId = project.vaIncharge;
          } else if (typeof project.vaIncharge === 'string') {
            vaId = new ObjectId(project.vaIncharge);
          } else {
            vaId = new ObjectId(String(project.vaIncharge));
          }
          const vaUser = await db.collection('users').findOne({
            _id: vaId
          });
          const vaProfile = await db.collection('employeeProfiles').findOne({
            userId: vaId
          });
          if (vaUser) {
            vaIncharge = {
              name: vaProfile?.fullName || vaUser.name || 'Unknown',
              email: vaUser.email || ''
            };
          }
        } catch (e) {
          console.error('Error fetching VA incharge:', e);
        }
      }

      // Get update incharge details
      let updateIncharge = null;
      if (project.updateIncharge) {
        try {
          // Handle different types: ObjectId, string, or FlattenMaps<ObjectId>
          let updateId: ObjectId;
          if (project.updateIncharge instanceof ObjectId) {
            updateId = project.updateIncharge;
          } else if (typeof project.updateIncharge === 'string') {
            updateId = new ObjectId(project.updateIncharge);
          } else {
            updateId = new ObjectId(String(project.updateIncharge));
          }
          const updateUser = await db.collection('users').findOne({
            _id: updateId
          });
          const updateProfile = await db.collection('employeeProfiles').findOne({
            userId: updateId
          });
          if (updateUser) {
            updateIncharge = {
              name: updateProfile?.fullName || updateUser.name || 'Unknown',
              email: updateUser.email || ''
            };
          }
        } catch (e) {
          console.error('Error fetching update incharge:', e);
        }
      }

      return {
        _id: project._id.toString(),
        projectName: project.projectName || 'Unnamed Project',
        clientName: project.clientName || 'Unknown Client',
        description: project.description || '',
        deadline: project.deadline,
        status: project.status || 'pending_assignment',
        priority: project.priority || 'medium',
        tags: project.tags || [],
        leadAssignee,
        vaIncharge,
        updateIncharge,
        startDate: project.startDate || null,
        budget: project.budget || null,
        clientProgress: project.clientProgress || 0,
        internalProgress: project.internalProgress || 0,
        totalUpdates,
        totalHours,
        daysRemaining: daysRemaining !== null && daysRemaining >= 0 ? daysRemaining : null,
        daysOverdue,
        createdAt: project.createdAt || null
      };
    }));

    return NextResponse.json({ projects: projectsWithAnalysis });
  } catch (error) {
    console.error('Error fetching project analysis:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



