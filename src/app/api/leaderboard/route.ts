import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { dbConnect } from '@/lib/mongodb';
import { DailyUpdate, User } from '@/models';

export async function GET(request: Request) {
  try {
    await dbConnect();
    
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();

    if (period === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day;
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
    }

    // Fetch all updates for the period (only approved ones)
    const updates = await DailyUpdate.find({
      date: { $gte: startDate },
      adminApproved: true
    }).populate('employeeId', 'name email');
    
    console.log('Leaderboard - Period:', period, 'Start Date:', startDate, 'Updates found:', updates.length);

    // Calculate scores for each employee
    const employeeScores: any = {};

    updates.forEach((update: any) => {
      const employeeId = update.employeeId._id.toString();
      
      if (!employeeScores[employeeId]) {
        employeeScores[employeeId] = {
          employeeId,
          employeeName: update.employeeId.name,
          email: update.employeeId.email,
          totalScore: 0,
          updatesCount: 0,
          scores: []
        };
      }

      // Calculate score based on checkboxes
      let score = 0;
      const fields = [
        'attendedMorningSession',
        'cameOnTime',
        'workedOnProject',
        'askedForNewProject',
        'gotCodeCorrected',
        'updatedClient',
        'workedOnTrainingTask',
        'updatedSeniorTeam',
        'updatedDailyProgress',
        'plannedNextDayTask',
        'completedAllTasks',
        'workedOnMultipleProjects'
      ];

      fields.forEach(field => {
        if (update[field]) score += 1;
      });

      // Add admin score if available
      if (update.adminScore) {
        score = (score / 12) * 100; // Convert to percentage
        score = (score + update.adminScore) / 2; // Average with admin score
      } else {
        score = (score / 12) * 100; // Convert to percentage
      }

      employeeScores[employeeId].scores.push(score);
      employeeScores[employeeId].totalScore += score;
      employeeScores[employeeId].updatesCount += 1;
    });

    // Calculate average scores and create leaderboard
    const leaderboard = Object.values(employeeScores)
      .map((emp: any) => ({
        ...emp,
        averageScore: emp.updatesCount > 0 ? emp.totalScore / emp.updatesCount : 0
      }))
      .sort((a: any, b: any) => b.averageScore - a.averageScore)
      .map((emp: any, index: number) => ({
        ...emp,
        rank: index + 1
      }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
