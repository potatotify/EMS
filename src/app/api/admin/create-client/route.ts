import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.email || !data.password || !data.name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({
      email: data.email.toLowerCase()
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create client user
    const clientUser = {
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: 'client',
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: session.user.id,
      profileCompleted: true,
      image: null,
      emailVerified: new Date(),
      
      // Client profile details
      companyName: data.companyName || null,
      contactPersonName: data.contactPersonName || null,
      phone: data.phone || null,
      alternatePhone: data.alternatePhone || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      website: data.website || null,
      industry: data.industry || null,
      companySize: data.companySize || null,
      
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('users').insertOne(clientUser);

    return NextResponse.json({ 
      success: true, 
      message: 'Client created successfully',
      clientId: result.insertedId 
    });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
