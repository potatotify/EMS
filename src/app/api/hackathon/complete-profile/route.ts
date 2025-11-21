import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Normalize skills from comma-separated string to array
    const rawSkills = Array.isArray(formData.skills)
      ? formData.skills.join(',')
      : (formData.skills || '');

    const skills: string[] = rawSkills
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    // Create hackathon profile
    const hackathonProfile = {
      userId: new ObjectId(session.user.id),
      fullName: formData.fullName,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      dateOfBirth: new Date(formData.dateOfBirth),
      skills,
      githubProfile: formData.githubProfile || '',
      portfolioLink: formData.portfolioLink || '',
      isEmployee: formData.isEmployee || false,
      employeeId: formData.employeeId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('hackathonprofiles').insertOne(hackathonProfile);

    // Update user's profileCompleted flag
    await db.collection('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          profileCompleted: true,
          name: formData.fullName
        }
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Hackathon profile completed successfully' 
    });
  } catch (error: any) {
    console.error('Error completing hackathon profile:', error);
    
    // Handle duplicate key error (user already has profile)
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Profile already exists' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to complete profile' },
      { status: 500 }
    );
  }
}

