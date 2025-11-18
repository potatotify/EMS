import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'client') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Create client profile
    const clientProfile = {
      userId: new ObjectId(session.user.id),
      companyName: formData.companyName,
      contactPersonName: formData.contactPersonName,
      phone: formData.phone,
      alternatePhone: formData.alternatePhone,
      email: formData.email,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      website: formData.website,
      industry: formData.industry,
      companySize: formData.companySize,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('clientProfiles').insertOne(clientProfile);

    // Update user's profileCompleted flag
    await db.collection('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          name: formData.contactPersonName,
          profileCompleted: true,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Profile completed successfully' 
    });
  } catch (error) {
    console.error('Error completing client profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
