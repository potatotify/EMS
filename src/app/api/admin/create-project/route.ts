import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();

    if (!data.clientId || !data.projectName || !data.description || !data.startDate || !data.deadline || !data.budget) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get client details if clientId is not "none"
    let clientUser = null;
    let clientName = null;
    let clientObjectId = null;
    
    if (data.clientId !== 'none') {
      clientUser = await db.collection('users').findOne({
        _id: new ObjectId(data.clientId),
        role: 'client'
      });

      if (!clientUser) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      
      clientName = clientUser.name;
      clientObjectId = new ObjectId(data.clientId);
    }

    // Create project
    const project = {
      clientId: clientObjectId,
      clientName: clientName,
      projectName: data.projectName,
      description: data.description,
      startDate: new Date(data.startDate),
      deadline: new Date(data.deadline),
      budget: data.budget,
      status: 'pending_assignment',
      priority: 'medium',
      tags: [],
      
      // These will be filled by admin later
      leadAssignee: null,
      vaIncharge: null,
      freelancer: null,
      assignees: [], // New field for multiple assignees
      codersRecommendation: null,
      leadership: null,
      githubLink: null,
      loomLink: null,
      whatsappGroupLink: null,
      
      // Task sections
      sections: [], // Empty sections for tasks
      
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('projects').insertOne(project);

    return NextResponse.json({ 
      success: true, 
      message: 'Project created successfully',
      projectId: result.insertedId 
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

