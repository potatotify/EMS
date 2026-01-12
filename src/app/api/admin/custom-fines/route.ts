import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch all custom fines
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const customFines = await db.collection('customFines')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ customFines });
  } catch (error) {
    console.error('Error fetching custom fines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom fines' },
      { status: 500 }
    );
  }
}

// POST - Create a new custom fine
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();
    const {
      criteria,
      employeeIds,
      projectIds,
      timeHour,
      timeMinute,
      finePoints,
      fineCurrency,
      fineType,
      description,
      isActive
    } = data;

    // Validation
    if (!criteria) {
      return NextResponse.json({ error: 'Criteria is required' }, { status: 400 });
    }

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'At least one employee must be selected' }, { status: 400 });
    }

    if (criteria === 'lead_assignee_no_task_created') {
      if (timeHour === undefined || timeHour < 0 || timeHour > 23) {
        return NextResponse.json({ error: 'Invalid hour. Must be between 0 and 23.' }, { status: 400 });
      }

      if (timeMinute === undefined || timeMinute < 0 || timeMinute > 59) {
        return NextResponse.json({ error: 'Invalid minute. Must be between 0 and 59.' }, { status: 400 });
      }

      if (!fineType || !['daily', 'one-time'].includes(fineType)) {
        return NextResponse.json({ error: 'Fine type must be either "daily" or "one-time"' }, { status: 400 });
      }
    } else if (criteria === 'default_fine') {
      if (!description || !description.trim()) {
        return NextResponse.json({ error: 'Description is required for default fines' }, { status: 400 });
      }
      // Default fines are always one-time
    }

    if (finePoints === undefined || finePoints < 0) {
      return NextResponse.json({ error: 'Fine points must be a non-negative number' }, { status: 400 });
    }

    if (fineCurrency === undefined || fineCurrency < 0) {
      return NextResponse.json({ error: 'Fine currency must be a non-negative number' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const customFine: any = {
      criteria,
      employeeIds: employeeIds.map((id: string) => new ObjectId(id)),
      finePoints,
      fineCurrency,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: new Date(),
      createdBy: new ObjectId(session.user.id),
      updatedAt: new Date()
    };

    // Add fields based on criteria
    if (criteria === 'lead_assignee_no_task_created') {
      customFine.projectIds = projectIds && Array.isArray(projectIds) ? projectIds.map((id: string) => new ObjectId(id)) : [];
      customFine.timeHour = timeHour;
      customFine.timeMinute = timeMinute;
      customFine.fineType = fineType;
    } else if (criteria === 'default_fine') {
      customFine.description = description;
      customFine.fineType = 'one-time'; // Always one-time for default fines
    }

    const result = await db.collection('customFines').insertOne(customFine);

    return NextResponse.json({
      success: true,
      customFine: { ...customFine, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating custom fine:', error);
    return NextResponse.json(
      { error: 'Failed to create custom fine' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a custom fine
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fineId = searchParams.get('id');

    if (!fineId) {
      return NextResponse.json({ error: 'Fine ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const result = await db.collection('customFines').deleteOne({
      _id: new ObjectId(fineId)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Custom fine not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Custom fine deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom fine:', error);
    return NextResponse.json(
      { error: 'Failed to delete custom fine' },
      { status: 500 }
    );
  }
}

// PUT - Update a custom fine
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();
    const {
      fineId,
      criteria,
      employeeIds,
      projectIds,
      timeHour,
      timeMinute,
      finePoints,
      fineCurrency,
      fineType,
      description,
      isActive
    } = data;

    if (!fineId) {
      return NextResponse.json({ error: 'Fine ID is required' }, { status: 400 });
    }

    // Validation (same as POST)
    if (!criteria) {
      return NextResponse.json({ error: 'Criteria is required' }, { status: 400 });
    }

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'At least one employee must be selected' }, { status: 400 });
    }

    if (criteria === 'lead_assignee_no_task_created') {
      if (timeHour === undefined || timeHour < 0 || timeHour > 23) {
        return NextResponse.json({ error: 'Invalid hour. Must be between 0 and 23.' }, { status: 400 });
      }

      if (timeMinute === undefined || timeMinute < 0 || timeMinute > 59) {
        return NextResponse.json({ error: 'Invalid minute. Must be between 0 and 59.' }, { status: 400 });
      }

      if (!fineType || !['daily', 'one-time'].includes(fineType)) {
        return NextResponse.json({ error: 'Fine type must be either "daily" or "one-time"' }, { status: 400 });
      }
    } else if (criteria === 'default_fine') {
      if (!description || !description.trim()) {
        return NextResponse.json({ error: 'Description is required for default fines' }, { status: 400 });
      }
    }

    if (finePoints === undefined || finePoints < 0) {
      return NextResponse.json({ error: 'Fine points must be a non-negative number' }, { status: 400 });
    }

    if (fineCurrency === undefined || fineCurrency < 0) {
      return NextResponse.json({ error: 'Fine currency must be a non-negative number' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const updateData: any = {
      criteria,
      employeeIds: employeeIds.map((id: string) => new ObjectId(id)),
      finePoints,
      fineCurrency,
      isActive: isActive !== undefined ? isActive : true,
      updatedAt: new Date(),
      updatedBy: new ObjectId(session.user.id)
    };

    // Add fields based on criteria
    if (criteria === 'lead_assignee_no_task_created') {
      updateData.projectIds = projectIds && Array.isArray(projectIds) ? projectIds.map((id: string) => new ObjectId(id)) : [];
      updateData.timeHour = timeHour;
      updateData.timeMinute = timeMinute;
      updateData.fineType = fineType;
    } else if (criteria === 'default_fine') {
      updateData.description = description;
      updateData.fineType = 'one-time'; // Always one-time for default fines
    }

    const result = await db.collection('customFines').updateOne(
      { _id: new ObjectId(fineId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Custom fine not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Custom fine updated successfully' });
  } catch (error) {
    console.error('Error updating custom fine:', error);
    return NextResponse.json(
      { error: 'Failed to update custom fine' },
      { status: 500 }
    );
  }
}
