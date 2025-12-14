import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();

    if (!data.clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if client exists
    const existingClient = await db.collection('users').findOne({
      _id: new ObjectId(data.clientId),
      role: 'client'
    });

    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check if email is being changed and if it's already taken
    if (data.email && data.email.toLowerCase() !== existingClient.email) {
      const emailExists = await db.collection('users').findOne({
        email: data.email.toLowerCase(),
        _id: { $ne: new ObjectId(data.clientId) }
      });

      if (emailExists) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
    }

    // Build update object
    const updateData: any = {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      alternatePhone: data.alternatePhone || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      country: data.country || null,
      companyName: data.companyName || null,
      website: data.website || null,
      industry: data.industry || null,
      companySize: data.companySize || null,
      updatedAt: new Date(),
    };

    // Only update password if a new one is provided
    if (data.password && data.password.trim() !== '') {
      if (data.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // Update client
    await db.collection('users').updateOne(
      { _id: new ObjectId(data.clientId) },
      { $set: updateData }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Client updated successfully' 
    });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
