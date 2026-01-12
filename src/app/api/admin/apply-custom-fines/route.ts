import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Helper function to get criteria label
function getCriteriaLabel(criteria: string): string {
  switch (criteria) {
    case 'lead_assignee_no_task_created':
      return 'Lead Assignee - No Task Created';
    default:
      return criteria;
  }
}

/**
 * Check and apply custom fines based on criteria
 * This should be called daily after the configured deadline (via cron job or scheduled task)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret header (for Vercel Cron Jobs) or admin session
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;
    
    // Also check for Vercel cron header
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    const isVercelCron = vercelCronHeader === '1';
    
    if (!isCronRequest && !isVercelCron) {
      // If not a cron request, require admin session
      const session = await getServerSession(authOptions);
      if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const client = await clientPromise;
    const db = client.db('worknest');

    // Get all active custom fines
    const customFines = await db.collection('customFines').find({
      isActive: true
    }).toArray();

    console.log(`[Apply Custom Fines] Found ${customFines.length} active custom fines`);

    if (customFines.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active custom fines found',
        finesApplied: 0,
        debug: { customFinesCount: 0 }
      });
    }

    const now = new Date();
    // Use local time for today calculation to avoid timezone issues
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0); // Ensure it's exactly midnight (local time)
    
    console.log(`[Apply Custom Fines] Starting check at ${now.toISOString()} (Local: ${now.toLocaleString()}), Today: ${today.toISOString()}`);
    console.log(`[Apply Custom Fines] Current time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
    
    const finesApplied: Array<{
      fineId: string;
      employeeId: string;
      employeeName: string;
      projectId?: string;
      projectName?: string;
      finePoints: number;
      fineCurrency: number;
      criteria: string;
    }> = [];

    const finesSkipped: Array<{
      fineId: string;
      employeeId: string;
      employeeName: string;
      reason: string;
    }> = [];

    // Process each custom fine
    for (const customFine of customFines) {
      console.log(`[Apply Custom Fines] Processing fine ${customFine._id}:`, {
        criteria: customFine.criteria,
        timeHour: customFine.timeHour,
        timeMinute: customFine.timeMinute,
        employeeIds: customFine.employeeIds,
        fineType: customFine.fineType,
        isActive: customFine.isActive
      });

      // For lead_assignee_no_task_created criteria, check deadline
      // For default_fine criteria, apply immediately (no deadline check)
      if (customFine.criteria === 'lead_assignee_no_task_created') {
        // Validate that timeHour and timeMinute exist
        if (customFine.timeHour === undefined || customFine.timeMinute === undefined) {
          console.log(`[Apply Custom Fines] ⚠️ Skipping fine ${customFine._id}: Missing timeHour or timeMinute for lead assignee criteria`);
          finesSkipped.push({
            fineId: customFine._id.toString(),
            employeeId: 'N/A',
            employeeName: 'N/A',
            reason: 'Missing deadline time configuration'
          });
          continue;
        }

        // Create deadline using local time (same timezone as server)
        const deadline = new Date(today);
        deadline.setHours(customFine.timeHour, customFine.timeMinute, 0, 0);

        // Calculate time difference in milliseconds
        const timeDiff = now.getTime() - deadline.getTime();
        const timeDiffMinutes = Math.floor(timeDiff / (1000 * 60));
        const timeDiffSeconds = Math.floor(timeDiff / 1000);
        const timeDiffHours = Math.floor(timeDiffMinutes / 60);

        const currentTimeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const deadlineStr = `${customFine.timeHour}:${String(customFine.timeMinute).padStart(2, '0')}`;

        console.log(`[Apply Custom Fines] Fine ${customFine._id}:`);
        console.log(`  - Deadline: ${deadlineStr} (${deadline.toISOString()})`);
        console.log(`  - Current: ${currentTimeStr} (${now.toISOString()})`);
        console.log(`  - Time difference: ${timeDiffHours}h ${timeDiffMinutes % 60}m (${timeDiffSeconds}s)`);
        console.log(`  - Deadline passed: ${now.getTime() >= deadline.getTime()}`);

        // Only process if current time is after or equal to the deadline (even by 1 second)
        // Use getTime() comparison to avoid timezone issues
        if (now.getTime() < deadline.getTime()) {
          console.log(`[Apply Custom Fines] ⏳ Skipping fine ${customFine._id}: Deadline not reached yet`);
          console.log(`  Current time (${currentTimeStr}) is before deadline (${deadlineStr})`);
          finesSkipped.push({
            fineId: customFine._id.toString(),
            employeeId: 'N/A',
            employeeName: 'N/A',
            reason: `Deadline not reached yet (deadline: ${deadlineStr}, current: ${currentTimeStr})`
          });
          continue;
        }
        
        console.log(`[Apply Custom Fines] ✓ Deadline PASSED - Processing fine ${customFine._id}`);
        console.log(`  Deadline (${deadlineStr}) was ${timeDiffHours}h ${timeDiffMinutes % 60}m ago`);
      } else if (customFine.criteria === 'default_fine') {
        // Default fines are applied immediately (no deadline check)
        console.log(`[Apply Custom Fines] ✓ Processing default fine ${customFine._id} (no deadline check)`);
      } else {
        // Unknown criteria - skip
        console.log(`[Apply Custom Fines] ⚠️ Skipping fine ${customFine._id}: Unknown criteria ${customFine.criteria}`);
        finesSkipped.push({
          fineId: customFine._id.toString(),
          employeeId: 'N/A',
          employeeName: 'N/A',
          reason: `Unknown criteria: ${customFine.criteria}`
        });
        continue;
      }

      // Helper function to normalize ID for comparison (same as lead-assignees route)
      const normalizeId = (id: any): string => {
        if (!id) return '';
        if (id instanceof ObjectId) return id.toString();
        if (typeof id === 'string') return id;
        if (id && typeof id === 'object' && id._id) {
          return id._id instanceof ObjectId ? id._id.toString() : String(id._id);
        }
        return String(id);
      };

      // Process based on criteria
      if (customFine.criteria === 'lead_assignee_no_task_created') {
        // Get all employees for this fine - keep as ObjectIds but also track normalized strings
        const employeeIds = customFine.employeeIds.map((id: any) => {
          if (id instanceof ObjectId) return id;
          if (typeof id === 'string') return new ObjectId(id);
          return new ObjectId(String(id));
        });

        console.log(`[Apply Custom Fines] Fine ${customFine._id}: Processing ${employeeIds.length} employees`);
        console.log(`[Apply Custom Fines] Employee IDs (normalized):`, employeeIds.map(id => normalizeId(id)));

        // Get specific project IDs if specified
        let specifiedProjectIds: ObjectId[] = [];
        if (customFine.projectIds && customFine.projectIds.length > 0) {
          specifiedProjectIds = customFine.projectIds.map((id: any) => {
            if (id instanceof ObjectId) return id;
            if (typeof id === 'string') return new ObjectId(id);
            return new ObjectId(String(id));
          });
          console.log(`[Apply Custom Fines] Fine ${customFine._id}: Using ${specifiedProjectIds.length} specified projects`);
        }

        // Process each employee individually
        for (const employeeIdObj of employeeIds) {
          try {
            // Normalize employee ID to string for consistent comparison
            const employeeIdStr = normalizeId(employeeIdObj);
            const employeeId = new ObjectId(employeeIdStr);
            
            console.log(`[Apply Custom Fines] Checking employee ID: ${employeeIdStr}`);
            console.log(`[Apply Custom Fines] Custom fine employeeIds (raw):`, customFine.employeeIds.map((id: any) => ({
              raw: id,
              toString: id.toString(),
              normalized: normalizeId(id)
            })));
            
            // Get employee details
            const employee = await db.collection('users').findOne({
              _id: employeeId,
              role: 'employee'
            });

            if (!employee) {
              console.log(`[Apply Custom Fines] Employee ${employeeIdStr} not found or not an employee`);
              finesSkipped.push({
                fineId: customFine._id.toString(),
                employeeId: employeeIdStr,
                employeeName: 'Unknown',
                reason: 'Employee not found or not an employee'
              });
              continue;
            }

            console.log(`[Apply Custom Fines] Found employee: ${employee.name} (${employee.email})`);
            console.log(`[Apply Custom Fines] Employee user._id: ${normalizeId(employee._id)}`);
            
            // Verify: Check what lead-assignees API would return for this employee
            const allProjectsForVerification = await db.collection('projects').find({}).toArray();
            const employeeProjectsFromDB = allProjectsForVerification.filter((p: any) => {
              if (!p.leadAssignee) return false;
              if (Array.isArray(p.leadAssignee)) {
                return p.leadAssignee.some((lead: any) => {
                  const leadIdStr = normalizeId(lead);
                  return leadIdStr === employeeIdStr && leadIdStr !== '';
                });
              } else {
                const leadIdStr = normalizeId(p.leadAssignee);
                return leadIdStr === employeeIdStr && leadIdStr !== '';
              }
            });
            console.log(`[Apply Custom Fines] VERIFICATION: Employee ${employee.name} should be lead assignee for ${employeeProjectsFromDB.length} projects according to DB`);
            if (employeeProjectsFromDB.length > 0) {
              console.log(`[Apply Custom Fines] VERIFICATION: Projects:`, employeeProjectsFromDB.map((p: any) => `${p.projectName} (leadAssignee: ${normalizeId(Array.isArray(p.leadAssignee) ? p.leadAssignee[0] : p.leadAssignee)})`));
            }

            // Find projects where this employee is lead assignee
            let employeeProjects: any[] = [];
            
            if (specifiedProjectIds.length > 0) {
              // If specific projects were selected, check only those
              const allProjectsForEmployee = await db.collection('projects').find({
                _id: { $in: specifiedProjectIds }
              }).toArray();
              
              console.log(`[Apply Custom Fines] Checking ${allProjectsForEmployee.length} specified projects`);
              
              // Filter projects where this employee is lead assignee
              employeeProjects = allProjectsForEmployee.filter((project: any) => {
                if (!project.leadAssignee) {
                  console.log(`[Apply Custom Fines] Project ${project.projectName || project._id} has no leadAssignee`);
                  return false;
                }
                
                if (Array.isArray(project.leadAssignee)) {
                  const matches = project.leadAssignee.some((lead: any) => {
                    const leadIdStr = normalizeId(lead);
                    const isMatch = leadIdStr === employeeIdStr && leadIdStr !== '';
                    if (isMatch) {
                      console.log(`[Apply Custom Fines] ✓ Match found in array: ${project.projectName}, leadId=${leadIdStr}`);
                    }
                    return isMatch;
                  });
                  return matches;
                } else {
                  const leadIdStr = normalizeId(project.leadAssignee);
                  const isMatch = leadIdStr === employeeIdStr && leadIdStr !== '';
                  if (isMatch) {
                    console.log(`[Apply Custom Fines] ✓ Match found (single): ${project.projectName}, leadId=${leadIdStr}`);
                  } else {
                    console.log(`[Apply Custom Fines] ✗ No match: ${project.projectName}, leadId=${leadIdStr}, employeeId=${employeeIdStr}`);
                  }
                  return isMatch;
                }
              });
            } else {
              // If no specific projects, find ALL projects (not just in_progress) where this employee is lead assignee
              // This ensures we don't miss projects with different statuses
              const allActiveProjects = await db.collection('projects').find({
                // Don't filter by status - check all projects
                // Exclude only completed/cancelled projects
                status: { $nin: ['completed', 'cancelled'] }
              }).toArray();
              
              console.log(`[Apply Custom Fines] Found ${allActiveProjects.length} projects (excluding completed/cancelled)`);
              
              // Filter projects where this employee is lead assignee
              employeeProjects = allActiveProjects.filter((project: any) => {
                if (!project.leadAssignee) {
                  console.log(`[Apply Custom Fines] Project ${project.projectName || project._id} has no leadAssignee`);
                  return false;
                }
                
                if (Array.isArray(project.leadAssignee)) {
                  const matches = project.leadAssignee.some((lead: any) => {
                    const leadIdStr = normalizeId(lead);
                    return leadIdStr === employeeIdStr && leadIdStr !== '';
                  });
                  if (matches) {
                    console.log(`[Apply Custom Fines] ✓ Found match: ${project.projectName} - Employee is in leadAssignee array`);
                  }
                  return matches;
                } else {
                  const leadIdStr = normalizeId(project.leadAssignee);
                  const isMatch = leadIdStr === employeeIdStr && leadIdStr !== '';
                  if (isMatch) {
                    console.log(`[Apply Custom Fines] ✓ Found match: ${project.projectName} - Employee is the leadAssignee`);
                  } else {
                    console.log(`[Apply Custom Fines] ✗ No match for ${project.projectName}: leadId=${leadIdStr}, employeeId=${employeeIdStr}`);
                  }
                  return isMatch;
                }
              });
            }

            console.log(`[Apply Custom Fines] Employee ${employee.name} (ID: ${employeeIdStr}) is lead assignee for ${employeeProjects.length} projects:`, 
              employeeProjects.map((p: any) => `${p.projectName || 'Unknown'} (${p.status || 'no status'})`));

            if (employeeProjects.length === 0) {
              // Debug: Let's check what projects exist and their lead assignees
              const allProjectsDebug = await db.collection('projects').find({}).toArray();
              console.log(`[Apply Custom Fines] DEBUG: Total projects in DB: ${allProjectsDebug.length}`);
              const projectsWithLead = allProjectsDebug.filter((p: any) => p.leadAssignee);
              console.log(`[Apply Custom Fines] DEBUG: Projects with leadAssignee: ${projectsWithLead.length}`);
              
              // Check if employee ID matches any lead assignee (for debugging)
              let foundEMS = false;
              
              for (const proj of projectsWithLead) {
                let leadIds: string[] = [];
                if (Array.isArray(proj.leadAssignee)) {
                  leadIds = proj.leadAssignee.map((l: any) => normalizeId(l));
                } else {
                  leadIds = [normalizeId(proj.leadAssignee)];
                }
                
                const isMatch = leadIds.some(leadId => leadId === employeeIdStr && leadId !== '');
                console.log(`[Apply Custom Fines] DEBUG Project: "${proj.projectName}", Status: "${proj.status}", leadAssignee IDs: [${leadIds.join(', ')}], Employee ID: ${employeeIdStr}, Match: ${isMatch}`);
                
                if (proj.projectName && proj.projectName.toLowerCase().includes('ems')) {
                  foundEMS = true;
                  console.log(`[Apply Custom Fines] DEBUG: Found EMS project!`);
                  console.log(`  - Project ID: ${proj._id.toString()}`);
                  console.log(`  - Project Name: ${proj.projectName}`);
                  console.log(`  - Status: ${proj.status}`);
                  console.log(`  - leadAssignee (raw):`, JSON.stringify(proj.leadAssignee));
                  console.log(`  - leadAssignee IDs (normalized): [${leadIds.join(', ')}]`);
                  console.log(`  - Employee ID (from fine): ${employeeIdStr}`);
                  console.log(`  - Employee Name: ${employee.name}`);
                  console.log(`  - Employee Email: ${employee.email}`);
                  console.log(`  - Match: ${isMatch}`);
                }
              }
              
              if (foundEMS) {
                console.log(`[Apply Custom Fines] DEBUG: EMS project exists but employee ID ${employeeIdStr} doesn't match its leadAssignee`);
                console.log(`[Apply Custom Fines] DEBUG: This might indicate the wrong employee ID was stored in the custom fine.`);
              }
              
              console.log(`[Apply Custom Fines] Employee ${employee.name} is not a lead assignee for any projects`);
              finesSkipped.push({
                fineId: customFine._id.toString(),
                employeeId: employeeId.toString(),
                employeeName: employee.name || 'Unknown',
                reason: `Not a lead assignee for any projects. Checked ${allProjectsDebug.length} total projects. Employee ID: ${employeeIdStr}`
              });
              continue;
            }

            // Check each project
            for (const project of employeeProjects) {
              // Check if employee created any tasks today (from midnight to midnight)
              // The fine checks if ANY task was created during the entire day
              // If no tasks were created from 00:00:00 to 23:59:59 today, apply fine when deadline passes
              const todayEnd = new Date(today);
              todayEnd.setHours(23, 59, 59, 999); // End of today (midnight to midnight)
              
              // Query for tasks created by this employee for this project today (entire day)
              // Try multiple query patterns to ensure we catch all tasks
              const tasksCreated1 = await db.collection('tasks').find({
                projectId: project._id,
                createdBy: employeeId,
                createdAt: {
                  $gte: today,
                  $lte: todayEnd
                }
              }).toArray();
              
              const tasksCreated2 = await db.collection('tasks').find({
                projectId: project._id,
                createdBy: employeeId.toString(),
                createdAt: {
                  $gte: today,
                  $lte: todayEnd
                }
              }).toArray();
              
              // Combine and deduplicate
              const allTasks = [...tasksCreated1, ...tasksCreated2];
              const uniqueTasks = allTasks.filter((task, index, self) => 
                index === self.findIndex(t => t._id.toString() === task._id.toString())
              );
              
              const tasksCreated = uniqueTasks;

              console.log(`[Apply Custom Fines] Employee ${employee.name} (${employeeId.toString()}), Project ${project.projectName}: Found ${tasksCreated.length} tasks created today`);
              if (tasksCreated.length > 0) {
                console.log(`[Apply Custom Fines] Task details:`, tasksCreated.map((t: any) => ({
                  id: t._id.toString(),
                  title: t.title,
                  createdBy: t.createdBy?.toString(),
                  createdAt: t.createdAt
                })));
              }

              // For the fine to apply:
              // 1. No tasks created today (from midnight to midnight - entire day)
              // 2. Current time must be after the deadline (already checked above)
              // This means: if deadline is 15:40 and we check at 15:40+, and no tasks were created
              // from 00:00:00 to 23:59:59 today, apply the fine
              const hasCreatedTasks = tasksCreated.length > 0;

              // Check if employee has marked NA (Not Applicable) for today
              const naRecord = await db.collection('dailyTaskNA').findOne({
                employeeId: employeeId,
                projectId: project._id,
                date: {
                  $gte: today,
                  $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
              });

              if (naRecord) {
                finesSkipped.push({
                  fineId: customFine._id.toString(),
                  employeeId: employeeId.toString(),
                  employeeName: employee.name || 'Unknown',
                  reason: 'Marked as NA (Not Applicable) for today'
                });
                continue;
              }

              // Check if fine was already applied today (for daily fines)
              if (customFine.fineType === 'daily') {
                const existingFine = await db.collection('customFineRecords').findOne({
                  customFineId: customFine._id,
                  employeeId: employeeId,
                  projectId: project._id,
                  date: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                  }
                });

                if (existingFine) {
                  finesSkipped.push({
                    fineId: customFine._id.toString(),
                    employeeId: employeeId.toString(),
                    employeeName: employee.name || 'Unknown',
                    reason: 'Fine already applied today'
                  });
                  continue;
                }
              } else {
                // For one-time fines, check if it was ever applied
                const existingFine = await db.collection('customFineRecords').findOne({
                  customFineId: customFine._id,
                  employeeId: employeeId,
                  projectId: project._id
                });

                if (existingFine) {
                  finesSkipped.push({
                    fineId: customFine._id.toString(),
                    employeeId: employeeId.toString(),
                    employeeName: employee.name || 'Unknown',
                    reason: 'One-time fine already applied'
                  });
                  continue;
                }
              }

              if (!hasCreatedTasks) {
                console.log(`[Apply Custom Fines] Applying fine to employee ${employee.name} for project ${project.projectName}`);
                
                // Format date as YYYY-MM-DD for bonus summary
                const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                // Record the fine in customFineRecords (for tracking)
                await db.collection('customFineRecords').insertOne({
                  customFineId: customFine._id,
                  employeeId: employeeId,
                  projectId: project._id,
                  projectName: project.projectName || 'Unknown',
                  date: today,
                  finePoints: customFine.finePoints,
                  fineCurrency: customFine.fineCurrency,
                  criteria: customFine.criteria,
                  fineType: customFine.fineType,
                  appliedAt: new Date(),
                  reason: `Did not create any tasks today (from midnight to midnight). Deadline: ${String(customFine.timeHour).padStart(2, '0')}:${String(customFine.timeMinute).padStart(2, '0')}`
                });

                // Store/update in customBonusFine collection (for bonus summary display)
                // Create a clear, user-friendly description based on criteria
                let customFineDescription = '';
                if (customFine.criteria === 'lead_assignee_no_task_created') {
                  const deadlineTime = `${String(customFine.timeHour).padStart(2, '0')}:${String(customFine.timeMinute).padStart(2, '0')}`;
                  // Parse dateKey (YYYY-MM-DD) to format it nicely
                  const [year, month, day] = dateKey.split('-');
                  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                  const dateFormatted = dateObj.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  customFineDescription = `Failed to create tasks for "${project.projectName || 'Unknown'}" by ${deadlineTime} on ${dateFormatted}`;
                } else if (customFine.criteria === 'default_fine') {
                  customFineDescription = customFine.description || 'Default fine applied';
                } else {
                  customFineDescription = customFine.description || 'Custom fine applied';
                }
                
                // Get existing custom bonus/fine record for this date
                // Always use string format for employeeId to ensure consistency
                const employeeIdStr = employeeId.toString();
                
                // Try multiple query formats to find existing record
                let existingCustomBonusFine = await db.collection('customBonusFine').findOne({
                  employeeId: employeeIdStr,
                  date: dateKey
                });
                
                // If not found with string, try ObjectId format
                if (!existingCustomBonusFine) {
                  existingCustomBonusFine = await db.collection('customBonusFine').findOne({
                    employeeId: employeeId,
                    date: dateKey
                  });
                }
                
                console.log(`[Apply Custom Fines] Checking for existing customBonusFine: employeeId=${employeeIdStr}, date=${dateKey}, found=${!!existingCustomBonusFine}`);
                if (existingCustomBonusFine) {
                  console.log(`[Apply Custom Fines] Existing record employeeId format:`, {
                    storedAs: typeof existingCustomBonusFine.employeeId,
                    storedValue: existingCustomBonusFine.employeeId,
                    isObjectId: existingCustomBonusFine.employeeId instanceof ObjectId,
                    existingFineEntries: (existingCustomBonusFine.customFineEntries || []).length
                  });
                }

                const fineEntries = [];
                if (customFine.finePoints > 0) {
                  fineEntries.push({
                    type: 'points',
                    value: customFine.finePoints,
                    description: customFineDescription
                  });
                }
                if (customFine.fineCurrency > 0) {
                  fineEntries.push({
                    type: 'currency',
                    value: customFine.fineCurrency,
                    description: customFineDescription
                  });
                }

                if (existingCustomBonusFine) {
                  // Update existing record - append to customFineEntries
                  await db.collection('customBonusFine').updateOne(
                    { _id: existingCustomBonusFine._id },
                    {
                      $push: {
                        customFineEntries: { $each: fineEntries }
                      },
                      $set: {
                        updatedAt: new Date()
                      }
                    }
                  );
                  console.log(`[Apply Custom Fines] Updated existing customBonusFine record for ${employee.name} (${employeeId.toString()}) on ${dateKey} with ${fineEntries.length} fine entries`);
                } else {
                  // Create new record - ensure employeeId is stored as string
                  const employeeIdStr = employeeId.toString();
                  const insertResult = await db.collection('customBonusFine').insertOne({
                    employeeId: employeeIdStr,
                    date: dateKey,
                    customBonusEntries: [],
                    customFineEntries: fineEntries,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });
                  console.log(`[Apply Custom Fines] Created new customBonusFine record for ${employee.name} (${employeeIdStr}) on ${dateKey}:`, {
                    recordId: insertResult.insertedId.toString(),
                    employeeId: employeeIdStr,
                    date: dateKey,
                    fineEntries: fineEntries.length,
                    fineEntriesDetails: fineEntries
                  });
                }

                // Update or create bonus/fine record for current month
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const bonusFineRecord = await db.collection('bonusFineRecords').findOne({
                  employeeId: employeeId,
                  period: 'monthly',
                  month: currentMonth,
                  year: currentYear
                });

                if (bonusFineRecord) {
                  // Add to existing fine
                  await db.collection('bonusFineRecords').updateOne(
                    {
                      employeeId: employeeId,
                      period: 'monthly',
                      month: currentMonth,
                      year: currentYear
                    },
                    {
                      $inc: {
                        customFinesPoints: customFine.finePoints || 0,
                        customFinesCurrency: customFine.fineCurrency || 0
                      },
                      $set: {
                        updatedAt: new Date()
                      }
                    }
                  );
                } else {
                  // Create new record
                  await db.collection('bonusFineRecords').insertOne({
                    employeeId: employeeId,
                    period: 'monthly',
                    month: currentMonth,
                    year: currentYear,
                    customFinesPoints: customFine.finePoints || 0,
                    customFinesCurrency: customFine.fineCurrency || 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });
                }

                finesApplied.push({
                  fineId: customFine._id.toString(),
                  employeeId: employeeId.toString(),
                  employeeName: employee.name || 'Unknown',
                  projectId: project._id.toString(),
                  projectName: project.projectName || 'Unknown',
                  finePoints: customFine.finePoints,
                  fineCurrency: customFine.fineCurrency,
                  criteria: customFine.criteria
                });
              }
            }
            } catch (error) {
            console.error(`Error processing employee ${employeeId} for fine ${customFine._id}:`, error);
          }
        }
      } else if (customFine.criteria === 'default_fine') {
        // Process default fines - apply immediately to all selected employees
        const employeeIds = customFine.employeeIds.map((id: any) => {
          if (id instanceof ObjectId) return id;
          if (typeof id === 'string') return new ObjectId(id);
          return new ObjectId(String(id));
        });

        console.log(`[Apply Custom Fines] Processing default fine ${customFine._id} for ${employeeIds.length} employees`);

        for (const employeeIdObj of employeeIds) {
          try {
            const employeeIdStr = normalizeId(employeeIdObj);
            const employeeId = new ObjectId(employeeIdStr);

            // Get employee details
            const employee = await db.collection('users').findOne({
              _id: employeeId,
              role: 'employee'
            });

            if (!employee) {
              finesSkipped.push({
                fineId: customFine._id.toString(),
                employeeId: employeeIdStr,
                employeeName: 'Unknown',
                reason: 'Employee not found'
              });
              continue;
            }

            // Check if fine was already applied (for one-time fines)
            const existingFine = await db.collection('customFineRecords').findOne({
              customFineId: customFine._id,
              employeeId: employeeId
            });

            if (existingFine) {
              finesSkipped.push({
                fineId: customFine._id.toString(),
                employeeId: employeeIdStr,
                employeeName: employee.name || 'Unknown',
                reason: 'Fine already applied'
              });
              continue;
            }

            // Format date as YYYY-MM-DD for bonus summary
            const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            // Record the fine in customFineRecords
            await db.collection('customFineRecords').insertOne({
              customFineId: customFine._id,
              employeeId: employeeId,
              date: today,
              finePoints: customFine.finePoints,
              fineCurrency: customFine.fineCurrency,
              criteria: customFine.criteria,
              fineType: customFine.fineType || 'one-time',
              description: customFine.description || '',
              appliedAt: new Date(),
              reason: customFine.description || 'Default fine applied'
            });

            // Store/update in customBonusFine collection
            const customFineDescription = customFine.description || 'Default fine applied';
            const employeeIdStrForQuery = employeeId.toString();
            
            // Try multiple query formats to find existing record
            let existingCustomBonusFine = await db.collection('customBonusFine').findOne({
              employeeId: employeeIdStrForQuery,
              date: dateKey
            });
            
            if (!existingCustomBonusFine) {
              existingCustomBonusFine = await db.collection('customBonusFine').findOne({
                employeeId: employeeId,
                date: dateKey
              });
            }

            const fineEntries = [];
            if (customFine.finePoints > 0) {
              fineEntries.push({
                type: 'points',
                value: customFine.finePoints,
                description: customFineDescription
              });
            }
            if (customFine.fineCurrency > 0) {
              fineEntries.push({
                type: 'currency',
                value: customFine.fineCurrency,
                description: customFineDescription
              });
            }

            if (existingCustomBonusFine) {
              await db.collection('customBonusFine').updateOne(
                { _id: existingCustomBonusFine._id },
                {
                  $push: {
                    customFineEntries: { $each: fineEntries }
                  },
                  $set: {
                    updatedAt: new Date()
                  }
                }
              );
              console.log(`[Apply Custom Fines] Updated existing customBonusFine record for ${employee.name} (${employeeIdStrForQuery}) on ${dateKey} with ${fineEntries.length} fine entries`);
            } else {
              const insertResult = await db.collection('customBonusFine').insertOne({
                employeeId: employeeIdStrForQuery,
                date: dateKey,
                customBonusEntries: [],
                customFineEntries: fineEntries,
                createdAt: new Date(),
                updatedAt: new Date()
              });
              console.log(`[Apply Custom Fines] Created new customBonusFine record for ${employee.name} (${employeeIdStrForQuery}) on ${dateKey}:`, {
                recordId: insertResult.insertedId.toString(),
                employeeId: employeeIdStrForQuery,
                date: dateKey,
                fineEntries: fineEntries.length
              });
            }

            // Update monthly bonusFineRecords
            const month = now.getMonth();
            const year = now.getFullYear();
            await db.collection('bonusFineRecords').updateOne(
              {
                employeeId: employeeId,
                period: 'monthly',
                month,
                year
              },
              {
                $inc: {
                  customFinesPoints: customFine.finePoints,
                  customFinesCurrency: customFine.fineCurrency
                },
                $setOnInsert: {
                  employeeId: employeeId,
                  period: 'monthly',
                  month,
                  year,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              },
              { upsert: true }
            );

            finesApplied.push({
              fineId: customFine._id.toString(),
              employeeId: employeeIdStr,
              employeeName: employee.name || 'Unknown',
              finePoints: customFine.finePoints,
              fineCurrency: customFine.fineCurrency,
              criteria: customFine.criteria
            });
          } catch (error) {
            console.error(`Error processing employee ${employeeIdObj} for default fine ${customFine._id}:`, error);
            finesSkipped.push({
              fineId: customFine._id.toString(),
              employeeId: normalizeId(employeeIdObj),
              employeeName: 'Unknown',
              reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      }
    }

    const response = {
      success: true,
      message: 'Custom fines check completed',
      date: today.toISOString(),
      finesApplied: finesApplied.length,
      finesSkipped: finesSkipped.length,
      details: {
        applied: finesApplied,
        skipped: finesSkipped
      },
      debug: {
        customFinesFound: customFines.length,
        currentTime: now.toISOString(),
        today: today.toISOString()
      }
    };

    console.log(`[Apply Custom Fines] Completed: Applied ${finesApplied.length}, Skipped ${finesSkipped.length}`);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error applying custom fines:', error);
    return NextResponse.json(
      { error: 'Failed to apply custom fines', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to manually trigger the check (for testing)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Call the POST logic
    const result = await POST(request as any);
    return result;
  } catch (error) {
    console.error('Error in GET custom fines check:', error);
    return NextResponse.json(
      { error: 'Failed to check custom fines' },
      { status: 500 }
    );
  }
}
