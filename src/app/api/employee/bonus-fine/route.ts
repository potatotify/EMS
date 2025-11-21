import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to calculate bonus/fine for a single employee (same as in all/route.ts)
async function calculateEmployeeBonusFine(employeeId: string, period: string, db: any) {
  // Get employee profile
  const employeeProfile = await db.collection('employeeProfiles').findOne({
    _id: new ObjectId(employeeId)
  });

  if (!employeeProfile) {
    return null;
  }

  const userId = employeeProfile.userId;
  const user = await db.collection('users').findOne({
    _id: new ObjectId(userId)
  });

  // Calculate period dates
  const now = new Date();
  let startDate = new Date();
  
  if (period === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'weekly') {
    const day = now.getDay();
    const diff = now.getDate() - day;
    startDate = new Date(now.setDate(diff));
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  startDate.setHours(0, 0, 0, 0);

  // Get all projects where employee is lead assignee, VA Incharge, or Update Incharge
  const projects = await db.collection('projects').find({
    $or: [
      { leadAssignee: new ObjectId(userId) },
      { vaIncharge: new ObjectId(userId) },
      { updateIncharge: new ObjectId(userId) }
    ]
  }).toArray();

  const completedProjects = projects.filter((p: any) => p.status === 'completed');
  const approvedClientProjects = projects.filter((p: any) => 
    p.status === 'completed' && p.clientProgress === 100
  );
  const approvedClientProjectsCount = approvedClientProjects.length;

  // Check if employee is a project lead (lead assignee of any project)
  const leadProjects = await db.collection('projects').find({
    leadAssignee: new ObjectId(userId)
  }).toArray();
  const isProjectLead = leadProjects.length > 0;
  
  // Check if employee completed any projects as Lead Assignee (for 2x bonus on completed projects only)
  const completedProjectsAsLead = leadProjects.filter((p: any) => p.status === 'completed');
  const hasCompletedProjectsAsLead = completedProjectsAsLead.length > 0;

  // Calculate attendance
  const attendanceRecords = await db.collection('attendance').find({
    userId: new ObjectId(userId),
    date: { $gte: startDate }
  }).toArray();

  // Calculate total attendance hours (use actual hours if available, else default to 8)
  const attendanceHours = attendanceRecords.reduce((sum: number, record: any) => {
    return sum + (record.hoursWorked || 8);
  }, 0);
  
  // Calculate days in the period (from start date to now)
  const daysInPeriod = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Absent days = days in period - days with attendance
  const absentDays = Math.max(0, daysInPeriod - attendanceRecords.length);

  // Get daily updates - Mongoose creates 'dailyupdates' collection (lowercase, pluralized)
  const dailyUpdates = await db.collection('dailyupdates').find({
    employeeId: new ObjectId(userId),
    date: { $gte: startDate },
    adminApproved: true
  }).toArray();

  const dailyUpdatesCount = dailyUpdates.length;
  
  // Check for daily Loom and GForm updates - calculate percentage of days with both
  const loomGFormCount = dailyUpdates.filter((update: any) => 
    update.recordedLoomVideos === true && update.updatedDailyProgress === true
  ).length;
  
  // If 80% or more of updates have both Loom and GForm, consider it consistent
  const hasDailyLoomAndGForm = dailyUpdatesCount > 0 && (loomGFormCount / dailyUpdatesCount) >= 0.8;

  // Calculate missing daily updates - allow 3 days grace period before counting fines
  const missingDailyUpdates = Math.max(0, daysInPeriod - dailyUpdatesCount);

  // Check training period
  const joiningDate = employeeProfile.createdAt || employeeProfile.joiningDate || new Date();
  const monthsWorked = Math.floor((now.getTime() - new Date(joiningDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
  const isInTraining = monthsWorked < 3;

  const productsCount = completedProjects.length;

  // Initialize calculation
  const calculation: any = {
    employeeId: employeeProfile._id.toString(),
    employeeName: employeeProfile.fullName || user?.name || 'Unknown',
    email: user?.email || '',
    productsCount,
    attendanceHours,
    absentDays,
    dailyUpdatesCount,
    missingDailyUpdates,
    missingTeamMeetings: 0,
    missingInternalMeetings: 0,
    missingClientMeetings: 0,
    completedProjects: completedProjects.length,
    approvedClientProjects: approvedClientProjectsCount,
    isProjectLead,
    isInTraining,
    monthsWorked,
    hasDailyLoomAndGForm,
    baseBonus: 0,
    productsBonus: 0,
    attendanceBonus140: 0,
    attendanceBonus160: 0,
    attendanceBonus200: 0,
    dailyLoomGFormBonus: 0,
    loyaltyBonus: 0,
    completedProjectsBonus: 0,
    hackathonBonus: 0,
    fresherBonus: 0,
    totalBonus: 0,
    missingDailyUpdatesFine: 0,
    missingTeamMeetingsFine: 0,
    missingInternalMeetingsFine: 0,
    missingClientMeetingsFine: 0,
    absenceFines: 0,
    totalFine: 0,
    netAmount: 0,
    noPaymentConditions: [],
    noFineConditions: []
  };

  // Calculate Bonuses
  // Base is separate (not a bonus, so not multiplied for Project Leads)
  calculation.baseBonus = 5000;
  
  // Actual bonuses (these will be multiplied for Project Leads)
  if (productsCount > 3) calculation.productsBonus = 1000;
  if (attendanceHours > 200) calculation.attendanceBonus200 = 2000;
  else if (attendanceHours > 160) calculation.attendanceBonus160 = 1000;
  else if (attendanceHours > 140) calculation.attendanceBonus140 = 500;
  if (hasDailyLoomAndGForm && dailyUpdatesCount > 0) calculation.dailyLoomGFormBonus = 1000;
  if (monthsWorked >= 6) calculation.loyaltyBonus = 2000;
  if (completedProjects.length > 0) calculation.completedProjectsBonus = 2000;

  // Apply 2x multiplier ONLY to completedProjectsBonus if employee completed projects as Lead Assignee
  // All other bonuses remain at 1x
  if (hasCompletedProjectsAsLead) {
    calculation.completedProjectsBonus = calculation.completedProjectsBonus * 2;
  }

  // Calculate total of actual bonuses (excluding base)
  calculation.totalBonus = 
    calculation.productsBonus +
    calculation.attendanceBonus140 +
    calculation.attendanceBonus160 +
    calculation.attendanceBonus200 +
    calculation.dailyLoomGFormBonus +
    calculation.loyaltyBonus +
    calculation.completedProjectsBonus +
    calculation.hackathonBonus +
    calculation.fresherBonus;

  // ============================================
  // CALCULATE FINES - SIMPLIFIED LOGIC
  // ============================================
  
  // Step 1: Calculate individual fines
  // 3.1. Missing Daily Updates (>3 days): 200 per day after 3-day grace
  calculation.missingDailyUpdatesFine = missingDailyUpdates > 3 ? (missingDailyUpdates - 3) * 200 : 0;
  
  // 3.2. Missing Team Meeting (>3 days): 300 per occurrence after 3 days
  calculation.missingTeamMeetingsFine = calculation.missingTeamMeetings > 3 ? (calculation.missingTeamMeetings - 3) * 300 : 0;
  
  // 3.3. Missing Internal Meeting (>3 days): 200 per occurrence after 3 days
  calculation.missingInternalMeetingsFine = calculation.missingInternalMeetings > 3 ? (calculation.missingInternalMeetings - 3) * 200 : 0;
  
  // 3.4. Missing Client meetings (>1): 300 per occurrence after 1 day
  calculation.missingClientMeetingsFine = calculation.missingClientMeetings > 1 ? (calculation.missingClientMeetings - 1) * 300 : 0;
  
  // Step 2: Calculate absence fine based on absent days
  // 4. Daily Fines Based on Absence (tiered system)
  if (absentDays >= 14) {
    calculation.absenceFines = -500; // 14+ days: -500 deduction from total fine
  } else if (absentDays >= 7) {
    calculation.absenceFines = 1000; // 7-13 days: 1000
  } else if (absentDays >= 5) {
    calculation.absenceFines = 1500; // 5-6 days: 1500
  } else if (absentDays >= 3) {
    calculation.absenceFines = 2000; // 3-4 days: 2000
  } else if (absentDays >= 2) {
    calculation.absenceFines = 2500; // 2 days: 2500
  } else if (absentDays >= 1) {
    calculation.absenceFines = 3000; // 1 day: 3000
  } else {
    calculation.absenceFines = 0; // 0 days: no fine
  }
  
  // Step 3: Sum all fines
  const sumOfAllFines = 
    calculation.missingDailyUpdatesFine +
    calculation.missingTeamMeetingsFine +
    calculation.missingInternalMeetingsFine +
    calculation.missingClientMeetingsFine +
    calculation.absenceFines;
  
  // Step 4: Check No Fine Conditions (8.1-8.2) - if met, no fines at all
  if (productsCount > 3) calculation.noFineConditions.push('Developed more than 3 products');
  if (approvedClientProjectsCount > 3) calculation.noFineConditions.push('Approved client projects > 3');
  
  if (calculation.noFineConditions.length > 0) {
    calculation.totalFine = 0;
  } else {
    calculation.totalFine = sumOfAllFines;
  }
  
  // Step 5: Training period - no fines
  if (isInTraining) {
    calculation.totalFine = 0;
  }
  
  // Step 6: Apply Project Lead 2x multiplier to fines (only if totalFine > 0)
  if (isProjectLead && calculation.totalFine > 0) {
    calculation.totalFine = calculation.totalFine * 2;
  }
  
  // Step 7: Ensure totalFine is never negative (minimum is 0)
  if (calculation.totalFine < 0) {
    calculation.totalFine = 0;
  }
  
  // Step 8: Check No Payment Conditions (2.1-2.4)
  if (attendanceHours < 100) calculation.noPaymentConditions.push('Attendance < 100 hours');
  if (absentDays > 4) calculation.noPaymentConditions.push('Absent > 4 days');
  if (productsCount === 0) calculation.noPaymentConditions.push('0 products');
  
  // Step 9: Ensure bonuses are never negative
  if (calculation.totalBonus < 0) {
    calculation.totalBonus = 0;
  }

  // Calculate net amount (base + bonuses - fines)
  calculation.netAmount = calculation.baseBonus + calculation.totalBonus - calculation.totalFine;

  // Check for existing manual overrides
  const existingRecord = await db.collection('bonusFineRecords').findOne({
    employeeId: new ObjectId(employeeId),
    period: period || 'monthly',
    month: now.getMonth(),
    year: now.getFullYear()
  });

  if (existingRecord) {
    // Only apply manual overrides if they are valid (non-negative for bonus, can be any for fine)
    if (existingRecord.manualBonus !== undefined && existingRecord.manualBonus !== null) {
      calculation.manualBonus = Math.max(0, existingRecord.manualBonus); // Ensure bonus is never negative
      calculation.totalBonus = calculation.manualBonus;
    }
    if (existingRecord.manualFine !== undefined && existingRecord.manualFine !== null) {
      calculation.manualFine = existingRecord.manualFine;
      calculation.totalFine = Math.max(0, existingRecord.manualFine); // Ensure fine is never negative
    }
    if (existingRecord.adminNotes) calculation.adminNotes = existingRecord.adminNotes;
    if (existingRecord.approvedByCoreTeam !== undefined) {
      calculation.approvedByCoreTeam = existingRecord.approvedByCoreTeam;
    }
    calculation.netAmount = calculation.baseBonus + calculation.totalBonus - calculation.totalFine;
  }

  if (calculation.noPaymentConditions.length > 0 && !calculation.approvedByCoreTeam) {
    calculation.netAmount = 0;
  }

  return calculation;
}

// GET - Fetch current employee's bonus/fine calculation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get employee profile for current user
    const employeeProfile = await db.collection('employeeProfiles').findOne({
      userId: new ObjectId(session.user.id)
    });

    if (!employeeProfile) {
      return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
    }

    const calculation = await calculateEmployeeBonusFine(
      employeeProfile._id.toString(),
      period,
      db
    );

    if (!calculation) {
      return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 });
    }

    return NextResponse.json({ calculation });
  } catch (error) {
    console.error('Error calculating employee bonus/fine:', error);
    return NextResponse.json(
      { error: 'Failed to calculate bonus/fine' },
      { status: 500 }
    );
  }
}

