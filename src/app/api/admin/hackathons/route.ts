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

    const hackathons = await db.collection('hackathons')
      .find()
      .sort({ startDate: -1 })
      .toArray();

    // Get participant counts
    const hackathonsWithDetails = await Promise.all(
      hackathons.map(async (hackathon: any) => {
        const participantCount = await db.collection('hackathonparticipants')
          .countDocuments({ hackathonId: hackathon._id });

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
          rules: hackathon.rules || [],
          tags: hackathon.tags || [],
          participantsCount: participantCount,
          winnerId: hackathon.winnerId?.toString(),
          winnerDeclaredAt: hackathon.winnerDeclaredAt
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    const hackathon = {
      name: data.name,
      description: data.description,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      registrationDeadline: new Date(data.registrationDeadline),
      maxParticipants: data.maxParticipants || null,
      prizePool: data.prizePool || null,
      status: data.status || 'upcoming',
      rules: data.rules || [],
      tags: data.tags || [],
      createdBy: new ObjectId(session.user.id),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('hackathons').insertOne(hackathon);

    return NextResponse.json({
      success: true,
      message: 'Hackathon created successfully',
      hackathonId: result.insertedId
    });
  } catch (error) {
    console.error('Error creating hackathon:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

