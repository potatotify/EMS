import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';

// GET - Fetch fine control settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get fine control settings (or create default if doesn't exist)
    let settings = await db.collection('fineControlSettings').findOne({
      type: 'default'
    });

    if (!settings) {
      // Create default settings
      const defaultSettings = {
        type: 'default',
        dailyTasksDeadlineHour: 10,
        dailyTasksDeadlineMinute: 0,
        missingDailyTasksFine: 500,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('fineControlSettings').insertOne(defaultSettings);
      // Fetch the inserted document to get the _id
      settings = await db.collection('fineControlSettings').findOne({
        type: 'default'
      });
    }

    // Ensure settings exists (fallback to defaults if still null)
    const fineSettings = settings || {
      dailyTasksDeadlineHour: 10,
      dailyTasksDeadlineMinute: 0,
      missingDailyTasksFine: 500,
      updatedAt: new Date(),
      createdAt: new Date()
    };

    return NextResponse.json({ 
      settings: {
        dailyTasksDeadlineHour: fineSettings.dailyTasksDeadlineHour ?? 10,
        dailyTasksDeadlineMinute: fineSettings.dailyTasksDeadlineMinute ?? 0,
        missingDailyTasksFine: fineSettings.missingDailyTasksFine || 500,
        lastUpdated: fineSettings.updatedAt || fineSettings.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching fine control settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fine control settings' },
      { status: 500 }
    );
  }
}

// POST - Update fine control settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { dailyTasksDeadlineHour, dailyTasksDeadlineMinute, missingDailyTasksFine } = await request.json();

    if (missingDailyTasksFine === undefined || missingDailyTasksFine < 0) {
      return NextResponse.json(
        { error: 'Invalid fine amount. Must be a non-negative number.' },
        { status: 400 }
      );
    }

    if (dailyTasksDeadlineHour === undefined || dailyTasksDeadlineHour < 0 || dailyTasksDeadlineHour > 23) {
      return NextResponse.json(
        { error: 'Invalid hour. Must be between 0 and 23.' },
        { status: 400 }
      );
    }

    if (dailyTasksDeadlineMinute === undefined || dailyTasksDeadlineMinute < 0 || dailyTasksDeadlineMinute > 59) {
      return NextResponse.json(
        { error: 'Invalid minute. Must be between 0 and 59.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Update or create fine control settings
    await db.collection('fineControlSettings').updateOne(
      { type: 'default' },
      {
        $set: {
          dailyTasksDeadlineHour: dailyTasksDeadlineHour,
          dailyTasksDeadlineMinute: dailyTasksDeadlineMinute,
          missingDailyTasksFine: missingDailyTasksFine,
          updatedAt: new Date(),
          updatedBy: session.user.id
        },
        $setOnInsert: {
          type: 'default',
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true,
      message: 'Fine control settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating fine control settings:', error);
    return NextResponse.json(
      { error: 'Failed to update fine control settings' },
      { status: 500 }
    );
  }
}
