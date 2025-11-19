import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import clientPromise, { dbConnect } from '@/lib/mongodb';
import { DailyUpdate, User } from '@/models';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    console.log('POST /api/daily-updates called');
    
    await dbConnect();
    console.log('Database connected');
    
    const session = await getServerSession();
    console.log('Session:', session?.user?.email);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    console.log('User found:', user?._id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingUpdate = await DailyUpdate.findOne({
      employeeId: user._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    const data = await request.json();
    
    let dailyUpdate;
    
    if (existingUpdate) {
      // Update existing record
      console.log('Updating existing record');
      dailyUpdate = await DailyUpdate.findByIdAndUpdate(
        existingUpdate._id,
        {
          ...data,
          status: 'submitted',
          lastModified: new Date()
        },
        { new: true }
      );
    } else {
      // Create new record
      console.log('Creating new record');
      dailyUpdate = new DailyUpdate({
        employeeId: user._id,
        date: new Date(),
        status: 'submitted',
        ...data
      });
      await dailyUpdate.save();
    }

    console.log('Daily update saved:', dailyUpdate?._id);
    return NextResponse.json(dailyUpdate);
  } catch (error) {
    console.error('Error saving daily update:', error);
    return NextResponse.json(
      { error: 'Failed to save daily update', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    console.log('GET /api/daily-updates called');
    
    await dbConnect();
    console.log('Database connected');
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employeeId');
    
    console.log('Query params - date:', date, 'employeeId:', employeeId);
    
    const session = await getServerSession();
    console.log('Session:', session?.user?.email);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    console.log('User found:', user?._id, 'role:', user?.role);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Admins can view any employee's updates, others can only view their own
    const isAdmin = user.role === 'admin';
    
    const query: any = {};
    
    // If not admin, only show their own updates
    if (!isAdmin) {
      query.employeeId = user._id;
    } else if (employeeId) {
      // If admin and specific employee is requested, filter by that employee
      // Validate if it's a valid MongoDB ObjectId
      if (employeeId.match(/^[0-9a-fA-F]{24}$/)) {
        // First, check if this is an employeeProfile ID and get the actual user ID
        const client = await clientPromise;
        const db = client.db('worknest');
        const employeeProfile = await db.collection('employeeProfiles').findOne({
          _id: new ObjectId(employeeId)
        });
        
        if (employeeProfile && employeeProfile.userId) {
          // Use the userId from employeeProfile
          query.employeeId = employeeProfile.userId;
          console.log('Found employee profile, using userId:', employeeProfile.userId);
        } else {
          // If no profile found, try using the ID directly as userId
          query.employeeId = employeeId;
          console.log('No profile found, using ID directly as employeeId:', employeeId);
        }
      } else {
        // If not a valid ObjectId, return empty (strict employee ID search)
        console.log('Invalid employee ID format:', employeeId);
        return NextResponse.json([]); // Return empty array if not valid ObjectId
      }
    }
    // If admin and no specific employee, show all updates
    
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      query.date = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }

    console.log('Query:', JSON.stringify(query));
    
    const updates = await DailyUpdate.find(query)
      .sort({ date: -1 })
      .populate('employeeId', 'name email');
    
    console.log('Updates found:', updates.length);
      
    return NextResponse.json(updates);
  } catch (error) {
    console.error('Error fetching daily updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily updates', details: String(error) },
      { status: 500 }
    );
  }
}
