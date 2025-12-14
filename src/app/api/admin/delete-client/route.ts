import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if client has any projects
    const projectCount = await db.collection('projects').countDocuments({
      clientId: new ObjectId(clientId)
    });

    if (projectCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete client with ${projectCount} active project(s). Please delete or reassign projects first.` 
      }, { status: 400 });
    }

    // Delete client
    const result = await db.collection('users').deleteOne({
      _id: new ObjectId(clientId),
      role: 'client'
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Also delete from clientProfiles if exists (legacy)
    await db.collection('clientProfiles').deleteOne({
      userId: new ObjectId(clientId)
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Client deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
