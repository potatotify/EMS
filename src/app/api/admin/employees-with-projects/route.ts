import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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
      .project({ _id: 1, name: 1, email: 1, createdAt: 1 })
      .sort({ name: 1 })
      .toArray();

    // Fetch all projects
    const projects = await db.collection('projects')
      .find({})
      .project({ 
        _id: 1, 
        projectName: 1, 
        clientName: 1,
        description: 1,
        status: 1,
        priority: 1,
        deadline: 1,
        leadAssignee: 1,
        vaIncharge: 1,
        assignees: 1,
        createdAt: 1
      })
      .toArray();

    // Group projects by employee
    const employeesWithProjects = employees.map(employee => {
      const employeeId = employee._id.toString();
      
      const employeeProjects = projects
        .filter(p => {
          // Check if employee is leadAssignee (can be array or single)
          if (p.leadAssignee) {
            if (Array.isArray(p.leadAssignee)) {
              if (p.leadAssignee.some((lead: any) => lead.toString() === employeeId)) return true;
            } else {
              if (p.leadAssignee.toString() === employeeId) return true;
            }
          }
          // Check if employee is vaIncharge (can be array or single)
          if (p.vaIncharge) {
            if (Array.isArray(p.vaIncharge)) {
              if (p.vaIncharge.some((va: any) => va.toString() === employeeId)) return true;
            } else {
              if (p.vaIncharge.toString() === employeeId) return true;
            }
          }
          // Check if employee is in assignees array
          if (p.assignees && Array.isArray(p.assignees)) {
            return p.assignees.some((a: any) => a.toString() === employeeId);
          }
          return false;
        })
        .map(p => {
          let role = 'Team Member';
          // Check leadAssignee (can be array or single)
          if (p.leadAssignee) {
            if (Array.isArray(p.leadAssignee)) {
              if (p.leadAssignee.some((lead: any) => lead.toString() === employeeId)) {
                role = 'Lead Assignee';
              }
            } else {
              if (p.leadAssignee.toString() === employeeId) {
                role = 'Lead Assignee';
              }
            }
          }
          // Check vaIncharge (can be array or single) - only if not already Lead Assignee
          if (role === 'Team Member' && p.vaIncharge) {
            if (Array.isArray(p.vaIncharge)) {
              if (p.vaIncharge.some((va: any) => va.toString() === employeeId)) {
                role = 'VA Incharge';
              }
            } else {
              if (p.vaIncharge.toString() === employeeId) {
                role = 'VA Incharge';
              }
            }
          }

          return {
            _id: p._id.toString(),
            projectName: p.projectName,
            clientName: p.clientName || 'Unknown',
            description: p.description || '',
            status: p.status || 'pending',
            priority: p.priority || 'medium',
            deadline: p.deadline ? new Date(p.deadline).toISOString() : null,
            createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
            role: role,
          };
        });

      return {
        _id: employee._id.toString(),
        name: employee.name,
        email: employee.email,
        createdAt: employee.createdAt ? new Date(employee.createdAt).toISOString() : null,
        projects: employeeProjects,
        projectCount: employeeProjects.length,
      };
    });

    return NextResponse.json({ 
      success: true,
      employees: employeesWithProjects
    });
  } catch (error) {
    console.error('Error fetching employees with projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

