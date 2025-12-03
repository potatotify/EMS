import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hackathonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { hackathonId } = await params;
    const { winnerId } = await request.json();

    if (!winnerId) {
      return NextResponse.json({ error: 'Winner ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Verify the participant exists and has submitted
    const participant = await db.collection('hackathonparticipants').findOne({
      hackathonId: new ObjectId(hackathonId),
      userId: new ObjectId(winnerId),
      submission: { $exists: true, $ne: null }
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found or has not submitted' },
        { status: 404 }
      );
    }

    // Update hackathon with winner
    const winnerDeclaredAt = new Date();
    await db.collection('hackathons').updateOne(
      { _id: new ObjectId(hackathonId) },
      {
        $set: {
          status: 'completed',
          winnerId: new ObjectId(winnerId),
          winnerDeclaredAt,
          updatedAt: winnerDeclaredAt
        }
      }
    );

    // Update participant status to winner
    await db.collection('hackathonparticipants').updateOne(
      {
        hackathonId: new ObjectId(hackathonId),
        userId: new ObjectId(winnerId)
      },
      {
        $set: {
          status: 'winner',
          updatedAt: winnerDeclaredAt
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Winner declared successfully'
    });
  } catch (error) {
    console.error('Error declaring winner:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

