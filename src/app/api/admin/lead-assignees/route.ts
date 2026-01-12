import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch all lead assignees with their projects
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Fetch all employees
    const employees = await db.collection('users')
      .find({ role: 'employee', isApproved: true })
      .project({ _id: 1, name: 1, email: 1 })
      .sort({ name: 1 })
      .toArray();

    // Fetch all projects (not just in_progress, to include all projects with lead assignees)
    const projects = await db.collection('projects')
      .find({})
      .project({ 
        _id: 1, 
        projectName: 1, 
        clientName: 1,
        status: 1,
        leadAssignee: 1
      })
      .toArray();

    // Group lead assignees with their projects
    const leadAssigneesWithProjects: Array<{
      employeeId: string;
      employeeName: string;
      email: string;
      projects: Array<{
        projectId: string;
        projectName: string;
        clientName: string;
      }>;
    }> = [];

    // Helper function to normalize ID for comparison
    const normalizeId = (id: any): string => {
      if (!id) return '';
      if (id instanceof ObjectId) return id.toString();
      if (typeof id === 'string') return id;
      if (id && typeof id === 'object' && id._id) {
        return id._id instanceof ObjectId ? id._id.toString() : String(id._id);
      }
      return String(id);
    };

    employees.forEach(employee => {
      const employeeId = normalizeId(employee._id);
      const employeeProjects = projects
        .filter(p => {
          // Check if employee is leadAssignee (can be array or single ObjectId)
          if (!p.leadAssignee) return false;
          
          if (Array.isArray(p.leadAssignee)) {
            return p.leadAssignee.some((lead: any) => {
              const leadId = normalizeId(lead);
              return leadId === employeeId && leadId !== '';
            });
          } else {
            // Single lead assignee
            const leadId = normalizeId(p.leadAssignee);
            return leadId === employeeId && leadId !== '';
          }
        })
        .map(p => ({
          projectId: p._id.toString(),
          projectName: p.projectName || 'Unknown',
          clientName: p.clientName || 'Unknown'
        }));

      if (employeeProjects.length > 0) {
        leadAssigneesWithProjects.push({
          employeeId,
          employeeName: employee.name || 'Unknown',
          email: employee.email || '',
          projects: employeeProjects
        });
      }
    });

    return NextResponse.json({ leadAssignees: leadAssigneesWithProjects });
  } catch (error) {
    console.error('Error fetching lead assignees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead assignees' },
      { status: 500 }
    );
  }
}
