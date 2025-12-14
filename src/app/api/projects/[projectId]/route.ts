import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    // Await params
    const params = await context.params;
    const { projectId } = params;

    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Helper function to populate employee details
    const populateEmployee = async (employeeId: any) => {
      if (!employeeId) return null;
      try {
        const employee = await db.collection('users').findOne({
          _id: new ObjectId(employeeId)
        });
        if (employee) {
          return {
            _id: employee._id.toString(),
            name: employee.name,
            email: employee.email
          };
        }
      } catch (error) {
        // If not a valid ObjectId, might be a string (legacy data)
        if (typeof employeeId === 'string') {
          return { _id: employeeId, name: employeeId, email: "" };
        }
      }
      return null;
    };

    // Populate lead assignee details if exists
    if (project.leadAssignee) {
      project.leadAssignee = await populateEmployee(project.leadAssignee) || project.leadAssignee;
      if (typeof project.leadAssignee === 'object' && project.leadAssignee._id) {
        project.leadAssigneeDetails = {
          _id: project.leadAssignee._id,
          name: project.leadAssignee.name,
          email: project.leadAssignee.email,
        };
      }
    }

    // Populate VA Incharge
    if (project.vaIncharge) {
      project.vaIncharge = await populateEmployee(project.vaIncharge) || project.vaIncharge;
    }

    // Populate Update Incharge
    if (project.updateIncharge) {
      project.updateIncharge = await populateEmployee(project.updateIncharge) || project.updateIncharge;
    }

    // Populate Assignees array
    if (project.assignees && Array.isArray(project.assignees)) {
      project.assignees = await Promise.all(
        project.assignees.map(async (assigneeId: any) => {
          return await populateEmployee(assigneeId) || assigneeId;
        })
      );
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
