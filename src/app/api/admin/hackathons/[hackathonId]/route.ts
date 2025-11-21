import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ hackathonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { hackathonId } = await params;
    const data = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    const updateData: any = {
      updatedAt: new Date()
    };

    if (data.name) updateData.name = data.name;
    if (data.description) updateData.description = data.description;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.registrationDeadline) updateData.registrationDeadline = new Date(data.registrationDeadline);
    if (data.maxParticipants !== undefined) updateData.maxParticipants = data.maxParticipants || null;
    if (data.prizePool !== undefined) updateData.prizePool = data.prizePool || null;
    if (data.status) updateData.status = data.status;
    if (data.rules) updateData.rules = data.rules;
    if (data.tags) updateData.tags = data.tags;

    const result = await db.collection('hackathons').updateOne(
      { _id: new ObjectId(hackathonId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Hackathon not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Hackathon updated successfully'
    });
  } catch (error) {
    console.error('Error updating hackathon:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ hackathonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { hackathonId } = await params;

    const client = await clientPromise;
    const db = client.db('worknest');

    // Delete hackathon and all related participants
    await Promise.all([
      db.collection('hackathons').deleteOne({ _id: new ObjectId(hackathonId) }),
      db.collection('hackathonparticipants').deleteMany({ hackathonId: new ObjectId(hackathonId) })
    ]);

    return NextResponse.json({
      success: true,
      message: 'Hackathon deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting hackathon:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

