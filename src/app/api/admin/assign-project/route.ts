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

    // Convert assignees array to ObjectIds
    const assignees = Array.isArray(data.assignees) 
      ? data.assignees.map((id: string) => new ObjectId(id))
      : [];
    
    // Convert leadAssignees array to ObjectIds
    const leadAssignees = Array.isArray(data.leadAssignees)
      ? data.leadAssignees.map((id: string) => new ObjectId(id))
      : [];

    // Update project with assignments
    const result = await db.collection('projects').updateOne(
      { _id: new ObjectId(data.projectId) },
      {
        $set: {
          leadAssignee: leadAssignees, // Store as array
          vaIncharge: data.vaIncharge ? new ObjectId(data.vaIncharge) : null,
          freelancer: data.freelancer || null,
          assignees: assignees, // New assignees field (array of ObjectIds)
          codersRecommendation: data.codersRecommendation || null,
          leadership: data.leadership || null,
          githubLink: data.githubLink || null,
          loomLink: data.loomLink || null,
          whatsappGroupLink: data.whatsappGroupLink || null,
          tags: data.tags || [],
          priority: data.priority || 'medium',
          // New: project-level incentive configuration
          bonusPoints: typeof data.bonusPoints === 'number' ? data.bonusPoints : 50,
          penaltyPoints: typeof data.penaltyPoints === 'number' ? data.penaltyPoints : 0,
          status: 'in_progress',
          assignedAt: new Date(),
          assignedBy: new ObjectId(session.user.id),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Project assigned successfully' 
    });
  } catch (error) {
    console.error('Error assigning project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
