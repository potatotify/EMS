import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Fetch all clients
    const clients = await db.collection('users')
      .find({ role: 'client' })
      .project({ _id: 1, name: 1, email: 1 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({ 
      success: true,
      clients: clients.map(c => ({
        _id: c._id.toString(),
        name: c.name,
        email: c.email
      }))
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

