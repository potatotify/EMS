import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.json();

    const client = await clientPromise;
    const db = client.db('worknest');

    // Auto-generate employee ID with timestamp and random component
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const employeeId = `EMP${timestamp}${random}`;

    // Normalize skills from comma-separated string to array
    const rawSkills = Array.isArray(formData.skills)
      ? formData.skills.join(',')
      : (formData.skills || '');

    const skills: string[] = rawSkills
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    // Create employee profile
    const employeeProfile = {
      userId: new ObjectId(session.user.id),
      fullName: formData.fullName,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      dateOfBirth: new Date(formData.dateOfBirth),
      designation: formData.designation,
      department: formData.department,
      joiningDate: new Date(formData.joiningDate),
      employeeId: employeeId,
      skills,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('employeeProfiles').insertOne(employeeProfile);

    // Update user's profileCompleted flag and name
    await db.collection('users').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          name: formData.fullName,
          profileCompleted: true,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Profile completed successfully',
      employeeId 
    });
  } catch (error) {
    console.error('Error completing employee profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
