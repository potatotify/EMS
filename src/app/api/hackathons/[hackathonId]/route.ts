import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hackathonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { hackathonId } = await params;

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get hackathon
    const hackathon = await db.collection('hackathons').findOne({
      _id: new ObjectId(hackathonId)
    });

    if (!hackathon) {
      return NextResponse.json({ error: 'Hackathon not found' }, { status: 404 });
    }

    // Get participant count
    const participantCount = await db.collection('hackathonparticipants')
      .countDocuments({ hackathonId: new ObjectId(hackathonId) });

    // Check if user is registered
    const registration = await db.collection('hackathonparticipants').findOne({
      hackathonId: new ObjectId(hackathonId),
      userId: new ObjectId(session.user.id)
    });

    return NextResponse.json({
      hackathon: {
        _id: hackathon._id.toString(),
        name: hackathon.name,
        description: hackathon.description,
        startDate: hackathon.startDate,
        endDate: hackathon.endDate,
        registrationDeadline: hackathon.registrationDeadline,
        maxParticipants: hackathon.maxParticipants,
        prizePool: hackathon.prizePool,
        status: hackathon.status,
        rules: hackathon.rules || [],
        tags: hackathon.tags || [],
        participantsCount: participantCount,
        isRegistered: !!registration,
        participantStatus: registration?.status || null,
        submission: registration?.submission || null
      }
    });
  } catch (error) {
    console.error('Error fetching hackathon:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

