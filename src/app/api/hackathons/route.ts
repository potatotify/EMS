import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get all hackathons
    const hackathons = await db.collection('hackathons')
      .find()
      .sort({ startDate: -1 })
      .toArray();

    // Get user's registrations
    const registrations = await db.collection('hackathonparticipants')
      .find({ userId: new ObjectId(session.user.id) })
      .toArray();

    const registrationMap = new Map(
      registrations.map((r: any) => [r.hackathonId.toString(), r])
    );

    // Get participant counts for each hackathon
    const hackathonsWithDetails = await Promise.all(
      hackathons.map(async (hackathon: any) => {
        const participantCount = await db.collection('hackathonparticipants')
          .countDocuments({ hackathonId: hackathon._id });

        const registration = registrationMap.get(hackathon._id.toString());

        return {
          _id: hackathon._id.toString(),
          name: hackathon.name,
          description: hackathon.description,
          startDate: hackathon.startDate,
          endDate: hackathon.endDate,
          registrationDeadline: hackathon.registrationDeadline,
          maxParticipants: hackathon.maxParticipants,
          prizePool: hackathon.prizePool,
          status: hackathon.status,
          tags: hackathon.tags || [],
          participantsCount: participantCount,
          isRegistered: !!registration,
          participantStatus: registration?.status || null
        };
      })
    );

    return NextResponse.json({ hackathons: hackathonsWithDetails });
  } catch (error) {
    console.error('Error fetching hackathons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

