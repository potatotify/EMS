import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET - Fetch bonus/fine records
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth()));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const client = await clientPromise;
    const db = client.db('worknest');

    const records = await db.collection('bonusFineRecords').find({
      period,
      month,
      year
    }).toArray();

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Error fetching bonus/fine records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}

// POST - Update or create bonus/fine record
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { employeeId, period, manualBonus, manualFine, adminNotes, approvedByCoreTeam } = await request.json();
    
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    // Validate that bonus is never negative
    if (manualBonus !== undefined && manualBonus !== null && manualBonus < 0) {
      return NextResponse.json({ error: 'Bonus cannot be negative' }, { status: 400 });
    }

    // Validate that fine is never negative
    if (manualFine !== undefined && manualFine !== null && manualFine < 0) {
      return NextResponse.json({ error: 'Fine cannot be negative' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const record = {
      employeeId: new ObjectId(employeeId),
      period: period || 'monthly',
      month,
      year,
      // Ensure values are non-negative
      manualBonus: manualBonus !== undefined && manualBonus !== null ? Math.max(0, manualBonus) : undefined,
      manualFine: manualFine !== undefined && manualFine !== null ? Math.max(0, manualFine) : undefined,
      adminNotes,
      approvedByCoreTeam: approvedByCoreTeam || false,
      updatedBy: new ObjectId(session.user.id),
      updatedAt: new Date()
    };

    await db.collection('bonusFineRecords').updateOne(
      {
        employeeId: new ObjectId(employeeId),
        period: period || 'monthly',
        month,
        year
      },
      { $set: record },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'Record updated successfully' });
  } catch (error) {
    console.error('Error updating bonus/fine record:', error);
    return NextResponse.json(
      { error: 'Failed to update record' },
      { status: 500 }
    );
  }
}

