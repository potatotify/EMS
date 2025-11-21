import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { hackathonId } = await request.json();

    if (!hackathonId) {
      return NextResponse.json({ error: 'Hackathon ID required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if hackathon exists
    const hackathon = await db.collection('hackathons').findOne({
      _id: new ObjectId(hackathonId)
    });

    if (!hackathon) {
      return NextResponse.json({ error: 'Hackathon not found' }, { status: 404 });
    }

    // Check registration deadline
    if (new Date(hackathon.registrationDeadline) < new Date()) {
      return NextResponse.json(
        { error: 'Registration deadline has passed' },
        { status: 400 }
      );
    }

    // Check if hackathon is active or upcoming
    if (hackathon.status === 'completed' || hackathon.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Hackathon is not accepting registrations' },
        { status: 400 }
      );
    }

    // Check max participants
    if (hackathon.maxParticipants) {
      const currentCount = await db.collection('hackathonparticipants')
        .countDocuments({ hackathonId: new ObjectId(hackathonId) });
      
      if (currentCount >= hackathon.maxParticipants) {
        return NextResponse.json(
          { error: 'Hackathon is full' },
          { status: 400 }
        );
      }
    }

    // Check if already registered
    const existingRegistration = await db.collection('hackathonparticipants').findOne({
      hackathonId: new ObjectId(hackathonId),
      userId: new ObjectId(session.user.id)
    });

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'Already registered for this hackathon' },
        { status: 400 }
      );
    }

    // Register user
    await db.collection('hackathonparticipants').insertOne({
      hackathonId: new ObjectId(hackathonId),
      userId: new ObjectId(session.user.id),
      status: 'registered',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully registered for hackathon'
    });
  } catch (error: any) {
    console.error('Error registering for hackathon:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Already registered for this hackathon' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

