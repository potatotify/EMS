import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
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

    // Get all participants with submissions for this hackathon
    const participants = await db.collection('hackathonparticipants')
      .find({ 
        hackathonId: new ObjectId(hackathonId),
        status: { $in: ['submitted', 'winner', 'runner_up'] }
      })
      .toArray();

    // Populate user and hackathon profile details
    const submissionsWithDetails = await Promise.all(
      participants.map(async (participant: any) => {
        // Get user details
        const user = await db.collection('users').findOne({
          _id: participant.userId
        });

        // Get hackathon profile
        const hackathonProfile = await db.collection('hackathonprofiles').findOne({
          userId: participant.userId
        });

        // Check if user is an employee
        const employeeProfile = await db.collection('employeeProfiles').findOne({
          userId: participant.userId
        });

        return {
          _id: participant._id.toString(),
          userId: participant.userId.toString(),
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'Unknown',
          isEmployee: !!employeeProfile,
          employeeId: employeeProfile?.employeeId || null,
          submission: participant.submission || null,
          status: participant.status,
          score: participant.score || null,
          rank: participant.rank || null,
          submittedAt: participant.submission?.submittedAt || null,
          profile: hackathonProfile ? {
            fullName: hackathonProfile.fullName,
            skills: hackathonProfile.skills || [],
            githubProfile: hackathonProfile.githubProfile || null,
            portfolioLink: hackathonProfile.portfolioLink || null
          } : null
        };
      })
    );

    // Sort by submitted date (most recent first)
    submissionsWithDetails.sort((a, b) => {
      if (!a.submittedAt && !b.submittedAt) return 0;
      if (!a.submittedAt) return 1;
      if (!b.submittedAt) return -1;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });

    return NextResponse.json({ submissions: submissionsWithDetails });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

