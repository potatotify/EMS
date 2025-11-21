import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hackathonId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { hackathonId } = await params;
    const data = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if hackathon exists and is active
    const hackathon = await db.collection('hackathons').findOne({
      _id: new ObjectId(hackathonId)
    });

    if (!hackathon) {
      return NextResponse.json({ error: 'Hackathon not found' }, { status: 404 });
    }

    if (hackathon.status !== 'active') {
      return NextResponse.json(
        { error: 'Hackathon is not active' },
        { status: 400 }
      );
    }

    // Check if user is registered
    const registration = await db.collection('hackathonparticipants').findOne({
      hackathonId: new ObjectId(hackathonId),
      userId: new ObjectId(session.user.id)
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'You are not registered for this hackathon' },
        { status: 400 }
      );
    }

    if (registration.status !== 'registered') {
      return NextResponse.json(
        { error: 'You have already submitted or been disqualified' },
        { status: 400 }
      );
    }

    // Update submission
    await db.collection('hackathonparticipants').updateOne(
      {
        hackathonId: new ObjectId(hackathonId),
        userId: new ObjectId(session.user.id)
      },
      {
        $set: {
          submission: {
            projectName: data.projectName,
            description: data.description,
            githubLink: data.githubLink || null,
            demoLink: data.demoLink || null,
            videoLink: data.videoLink || null,
            submittedAt: new Date()
          },
          status: 'submitted',
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Project submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

