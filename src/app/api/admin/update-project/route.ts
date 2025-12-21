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

    const client = await clientPromise;
    const db = client.db('worknest');

    // Update project
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only update fields that are provided
    if (data.status) updateData.status = data.status;
    if (data.priority) updateData.priority = data.priority;
    if (data.clientProgress !== undefined) updateData.clientProgress = data.clientProgress;
    
    // Handle client update
    if (data.clientId !== undefined) {
      if (data.clientId === 'none' || data.clientId === '') {
        // Remove client assignment
        updateData.clientId = null;
        updateData.clientName = null;
      } else {
        // Update client assignment
        const clientUser = await db.collection('users').findOne({
          _id: new ObjectId(data.clientId),
          role: 'client'
        });
        
        if (clientUser) {
          updateData.clientId = new ObjectId(data.clientId);
          updateData.clientName = clientUser.name;
        }
      }
    }
    
    // Note: leadAssignee should be updated via /api/admin/assign-project endpoint
    if (data.vaIncharge !== undefined) updateData.vaIncharge = data.vaIncharge;
    if (data.freelancer !== undefined) updateData.freelancer = data.freelancer;
    if (data.updateIncharge !== undefined) updateData.updateIncharge = data.updateIncharge;
    if (data.codersRecommendation !== undefined) updateData.codersRecommendation = data.codersRecommendation;
    if (data.leadership !== undefined) updateData.leadership = data.leadership;
    if (data.githubLink !== undefined) updateData.githubLink = data.githubLink;
    if (data.loomLink !== undefined) updateData.loomLink = data.loomLink;
    if (data.whatsappGroupLink !== undefined) updateData.whatsappGroupLink = data.whatsappGroupLink;
    if (data.tags) updateData.tags = data.tags;

    const result = await db.collection('projects').updateOne(
      { _id: new ObjectId(data.projectId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Project updated successfully' 
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
