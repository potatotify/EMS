import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'client') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Create project
    const project = {
      clientId: new ObjectId(session.user.id),
      clientName: session.user.name,
      projectName: data.projectName,
      description: data.description,
      startDate: new Date(data.startDate),
      deadline: new Date(data.deadline),
      budget: data.budget,
      status: 'pending_assignment', // pending_assignment, in_progress, completed, on_hold
      priority: 'medium',
      tags: [],
      
      // These will be filled by admin
      leadAssignee: null,
      vaIncharge: null,
      freelancer: null,
      updateIncharge: null,
      codersRecommendation: null,
      leadership: null,
      githubLink: null,
      loomLink: null,
      whatsappGroupLink: null,
      
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
