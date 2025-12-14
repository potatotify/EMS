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

    // Fetch all clients with their profile information
    const clients = await db.collection('users')
      .find({ role: 'client' })
      .project({ 
        _id: 1, 
        name: 1, 
        email: 1, 
        createdAt: 1,
        companyName: 1,
        contactPersonName: 1,
        phone: 1,
        alternatePhone: 1,
        address: 1,
        city: 1,
        state: 1,
        pincode: 1,
        website: 1,
        industry: 1,
        companySize: 1
      })
      .sort({ name: 1 })
      .toArray();

    // Fetch all client profiles from separate collection (legacy)
    const clientProfiles = await db.collection('clientProfiles')
      .find({})
      .toArray();

    // Create a map of userId to profile for quick lookup
    const profileMap = new Map();
    clientProfiles.forEach(profile => {
      profileMap.set(profile.userId.toString(), profile);
    });

    // Fetch all projects with budget
    const projects = await db.collection('projects')
      .find({})
      .project({ 
        _id: 1, 
        projectName: 1, 
        clientId: 1, 
        description: 1,
        status: 1,
        priority: 1,
        deadline: 1,
        budget: 1,
        startDate: 1,
        createdAt: 1
      })
      .toArray();

    // Group projects by client and calculate total investment
    const clientsWithProjects = clients.map(client => {
      const clientIdStr = client._id.toString();
      const profile = profileMap.get(clientIdStr);
      
      const clientProjects = projects
        .filter(p => p.clientId && p.clientId.toString() === clientIdStr)
        .map(p => ({
          _id: p._id.toString(),
          projectName: p.projectName,
          description: p.description || '',
          status: p.status || 'pending',
          priority: p.priority || 'medium',
          deadline: p.deadline ? new Date(p.deadline).toISOString() : null,
          startDate: p.startDate ? new Date(p.startDate).toISOString() : null,
          budget: p.budget || 0,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        }));

      // Calculate total investment
      const totalInvestment = clientProjects.reduce((sum, p) => {
        const budget = typeof p.budget === 'string' ? parseFloat(p.budget.replace(/[^0-9.-]+/g, '')) || 0 : (p.budget || 0);
        return sum + budget;
      }, 0);

      return {
        _id: client._id.toString(),
        name: client.name,
        email: client.email,
        createdAt: client.createdAt ? new Date(client.createdAt).toISOString() : null,
        // Client profile information - prefer data from users collection (new system), fallback to clientProfiles (legacy)
        companyName: client.companyName || profile?.companyName || '',
        contactPersonName: client.contactPersonName || profile?.contactPersonName || client.name,
        phone: client.phone || profile?.phone || '',
        alternatePhone: client.alternatePhone || profile?.alternatePhone || '',
        address: client.address || profile?.address || '',
        city: client.city || profile?.city || '',
        state: client.state || profile?.state || '',
        pincode: client.pincode || profile?.pincode || '',
        website: client.website || profile?.website || '',
        industry: client.industry || profile?.industry || '',
        companySize: client.companySize || profile?.companySize || '',
        projects: clientProjects,
        projectCount: clientProjects.length,
        totalInvestment: totalInvestment,
      };
    });

    return NextResponse.json({ 
      success: true,
      clients: clientsWithProjects
    });
  } catch (error) {
    console.error('Error fetching clients with projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

