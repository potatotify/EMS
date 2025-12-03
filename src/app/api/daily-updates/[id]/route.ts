import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import { DailyUpdate, User } from '@/models';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const update = await DailyUpdate.findById(id)
      .populate('employeeId', 'name email');
      
    if (!update) {
      return NextResponse.json(
        { error: 'Daily update not found' },
        { status: 404 }
      );
    }

    // Only allow admin or the employee who created the update to view it
    if (user.role !== 'admin' && update.employeeId.toString() !== user._id.toString()) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json(update);
  } catch (error) {
    console.error('Error fetching daily update:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily update' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only allow admin to update the status/score
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const data = await request.json();
    
    // Allow updating all fields including checklist and checkboxes
    const updateData: any = {
      status: data.status || 'reviewed',
      adminNotes: data.adminNotes || '',
      adminScore: data.adminScore || 0,
      adminApproved: data.adminApproved || false,
      lastModified: new Date()
    };

    // Optional: update dynamic checklist if provided
    if (Array.isArray(data.checklist)) {
      updateData.checklist = data.checklist;
    }

    // Allow admin to override any checkbox fields
    const checkboxFields = [
      'attendedMorningSession', 'cameOnTime', 'workedOnProject', 'askedForNewProject',
      'gotCodeCorrected', 'updatedClient', 'workedOnTrainingTask', 'updatedSeniorTeam',
      'updatedDailyProgress', 'plannedNextDayTask', 'completedAllTasks', 'workedOnMultipleProjects',
      'informedUnableToComplete', 'ensuredProjectReassigned', 'ensuredProjectOnTime',
      'informedBeforeBunking', 'informedBeforeLate', 'informedLeavingMeeting',
      'freelancerNeeded', 'ensuredFreelancerHired', 'addedToWhatsAppGroup', 'slackGroupCreated',
      'projectAssignedToSomeoneElse', 'projectInPriority', 'followedUpWithClient',
      'completedAllProjectTasks', 'setTaskDeadlines', 'recordedLoomVideos',
      'organizedLoomVideos', 'metDeadlines', 'screenShared'
    ];

    checkboxFields.forEach(field => {
      if (data.hasOwnProperty(field)) {
        updateData[field] = data[field];
      }
    });

    // Allow updating text fields
    if (data.tasksForTheDay !== undefined) updateData.tasksForTheDay = data.tasksForTheDay;
    if (data.supervisor !== undefined) updateData.supervisor = data.supervisor;
    if (data.hoursWorked !== undefined) updateData.hoursWorked = data.hoursWorked;
    if (data.additionalNotes !== undefined) updateData.additionalNotes = data.additionalNotes;

    const updatedUpdate = await DailyUpdate.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('employeeId', 'name email');

    if (!updatedUpdate) {
      return NextResponse.json(
        { error: 'Daily update not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedUpdate);
  } catch (error) {
    console.error('Error updating daily update:', error);
    return NextResponse.json(
      { error: 'Failed to update daily update' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Only allow admin to delete updates
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const update = await DailyUpdate.findByIdAndDelete(id);

    if (!update) {
      return NextResponse.json(
        { error: 'Daily update not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Daily update deleted successfully' });
  } catch (error) {
    console.error('Error deleting daily update:', error);
    return NextResponse.json(
      { error: 'Failed to delete daily update' },
      { status: 500 }
    );
  }
}
