import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import clientPromise from '@/lib/mongodb';
import { dbConnect } from '@/lib/mongodb';
import { DailyUpdate, User } from '@/models';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ employeeId: string }> }
) {
  try {
    const params = await context.params;
    const { employeeId } = params;

    console.log('Fetching employee details for ID:', employeeId);

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if admin
    const adminSession = await User.findOne({ email: session.user.email });
    if (!adminSession || adminSession.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find employee profile by _id
    let profile = await db.collection('employeeProfiles').findOne({
      _id: new ObjectId(employeeId)
    });

    if (!profile) {
      console.log('Employee profile not found with ID:', employeeId);
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    console.log('Found employee profile:', profile);

    // Now fetch daily updates and user email using Mongoose
    await dbConnect();
    
    // The userId from employeeProfile is the actual user ID in our system
    const dailyUpdates = await DailyUpdate.find({ employeeId: profile.userId })
      .sort({ date: -1 })
      .limit(30);

    // Fetch user to get email
    const user = await User.findById(profile.userId);
    const userEmail = user?.email || profile.email || '';

    console.log('Found daily updates:', dailyUpdates.length);
    console.log('User email:', userEmail);

    // Return profile and daily updates
    return NextResponse.json({
      profile: {
        _id: profile._id,
        fullName: profile.fullName || 'Employee',
        email: userEmail,
        designation: profile.designation || 'Employee',
        department: profile.department || 'Engineering'
      },
      attendanceRecords: [],
      dailyUpdates: dailyUpdates.map((update: any) => ({
        _id: update._id,
        date: update.date,
        tasksCompleted: update.tasksForTheDay ? [update.tasksForTheDay] : [],
        adminApproved: update.adminApproved,
        status: update.status
      }))
    });
  } catch (error) {
    console.error('Error in employee detail API:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
