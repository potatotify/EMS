import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import ChecklistConfig from '@/models/ChecklistConfig';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { isAdminOrHasPermission } from '@/lib/permission-helpers';
import { PERMISSIONS } from '@/lib/permission-constants';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if admin or has MANAGE_CHECKLISTS permission
        const hasAccess = await isAdminOrHasPermission(PERMISSIONS.MANAGE_CHECKLISTS);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        await dbConnect();

        // Fetch configs without populate first to avoid errors
        let configs = await ChecklistConfig.find({})
            .sort({ type: 1, createdAt: -1 })
            .lean();
        
        // Manually populate employeeId and employeeIds if they exist
        const client = await clientPromise;
        const db = client.db('worknest');
        const usersCollection = db.collection('users');
        
        const populatedConfigs = await Promise.all(configs.map(async (config: any) => {
            // Populate employeeId if it exists
            if (config.employeeId) {
                try {
                    // Handle different types: ObjectId, string, or FlattenMaps<ObjectId>
                    let userId: ObjectId;
                    if (config.employeeId instanceof ObjectId) {
                        userId = config.employeeId;
                    } else if (typeof config.employeeId === 'string') {
                        userId = new ObjectId(config.employeeId);
                    } else {
                        userId = new ObjectId(String(config.employeeId));
                    }
                    const user = await usersCollection.findOne(
                        { _id: userId },
                        { projection: { name: 1, email: 1 } }
                    );
                    if (user) {
                        config.employeeId = {
                            _id: user._id,
                            name: user.name,
                            email: user.email
                        };
                    }
                } catch (err) {
                    console.warn('Error populating employeeId:', err);
                }
            }
            
            // Populate employeeIds if they exist
            if (config.employeeIds && Array.isArray(config.employeeIds) && config.employeeIds.length > 0) {
                try {
                    // First, extract ObjectIds from the employeeIds (they might be ObjectIds or already populated objects)
                    const userIds: ObjectId[] = [];
                    const originalIds: any[] = [];
                    
                    config.employeeIds.forEach((id: any) => {
                        let objectId: ObjectId;
                        if (id instanceof ObjectId) {
                            objectId = id;
                        } else if (typeof id === 'object' && id._id) {
                            // Already populated object - extract the _id
                            objectId = id._id instanceof ObjectId ? id._id : new ObjectId(id._id);
                            originalIds.push(id); // Keep the populated object
                        } else if (typeof id === 'string') {
                            objectId = new ObjectId(id);
                        } else {
                            objectId = new ObjectId(String(id));
                        }
                        userIds.push(objectId);
                    });
                    
                    // Fetch users
                    const users = await usersCollection.find(
                        { _id: { $in: userIds } },
                        { projection: { name: 1, email: 1 } }
                    ).toArray();
                    
                    // Map back to populated objects, preserving order
                    config.employeeIds = userIds.map((userId: ObjectId) => {
                        // Check if we already have a populated object
                        const existingPopulated = originalIds.find((orig: any) => {
                            const origId = orig._id instanceof ObjectId ? orig._id : new ObjectId(orig._id);
                            return origId.equals(userId);
                        });
                        if (existingPopulated) {
                            return existingPopulated;
                        }
                        
                        // Otherwise, find the user from the fetched users
                        const user = users.find((u: any) => u._id.equals(userId));
                        if (user) {
                            return {
                                _id: user._id,
                                name: user.name,
                                email: user.email
                            };
                        }
                        
                        // If user not found, return just the ID as string
                        return {
                            _id: userId,
                            name: 'Unknown',
                            email: ''
                        };
                    });
                } catch (err) {
                    console.warn('Error populating employeeIds:', err);
                    // On error, convert ObjectIds to strings to preserve them
                    config.employeeIds = config.employeeIds.map((id: any) => {
                        if (id instanceof ObjectId) {
                            return { _id: id.toString(), name: 'Unknown', email: '' };
                        } else if (typeof id === 'object' && id._id) {
                            return id; // Already in correct format
                        } else {
                            return { _id: String(id), name: 'Unknown', email: '' };
                        }
                    });
                }
            } else if (!config.employeeIds) {
                config.employeeIds = [];
            }
            
            // Normalize checks for backward compatibility: convert strings to objects
            if (config.checks && Array.isArray(config.checks)) {
                config.checks = config.checks.map((check: any) => {
                    if (typeof check === 'string') {
                        return { text: check };
                    } else if (check && typeof check === 'object') {
                        return {
                            text: check.text || check.label || '',
                            bonus: check.bonus !== undefined && check.bonus !== null ? Number(check.bonus) : undefined,
                            fine: check.fine !== undefined && check.fine !== null ? Number(check.fine) : undefined,
                            bonusCurrency: check.bonusCurrency !== undefined && check.bonusCurrency !== null ? Number(check.bonusCurrency) : undefined,
                            fineCurrency: check.fineCurrency !== undefined && check.fineCurrency !== null ? Number(check.fineCurrency) : undefined
                        };
                    }
                    return { text: String(check) };
                });
            }
            
            return config;
        }));
        
        return NextResponse.json({ configs: populatedConfigs });
    } catch (error) {
        console.error('Error fetching checklist configs:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if admin or has MANAGE_CHECKLISTS permission
        const hasAccess = await isAdminOrHasPermission(PERMISSIONS.MANAGE_CHECKLISTS);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        await dbConnect();
        const body = await req.json();
        const { 
            type, 
            name,
            skills, // For skill type
            employeeId, // For custom type - backward compatibility
            employeeIds, // For custom type - multiple employees
            checks,
            _id // For updating existing
        } = body;

        if (!type || !checks || !Array.isArray(checks)) {
            return NextResponse.json({ error: 'Missing required fields: type and checks array' }, { status: 400 });
        }

        // Validate based on type
        if (type === 'custom' && (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0)) {
            // Check backward compatibility with employeeId
            if (!employeeId) {
                return NextResponse.json({ error: 'employeeIds array required for custom type' }, { status: 400 });
            }
        }

        // Normalize checks: handle both string and object formats
        const normalizedChecks = checks
            .map((c: any) => {
                if (typeof c === 'string') {
                    return c.trim() ? { text: c.trim() } : null;
                } else if (c && typeof c === 'object') {
                    const text = c.text || c.label || '';
                    if (!text.trim()) return null;
                    const item: any = { text: text.trim() };
                    // Only include bonus/fine if they are valid numbers
                    if (c.bonus !== undefined && c.bonus !== null && !isNaN(Number(c.bonus))) {
                        item.bonus = Number(c.bonus);
                    }
                    if (c.fine !== undefined && c.fine !== null && !isNaN(Number(c.fine))) {
                        item.fine = Number(c.fine);
                    }
                    // Only include bonusCurrency/fineCurrency if they are valid numbers
                    if (c.bonusCurrency !== undefined && c.bonusCurrency !== null && !isNaN(Number(c.bonusCurrency))) {
                        item.bonusCurrency = Number(c.bonusCurrency);
                    }
                    if (c.fineCurrency !== undefined && c.fineCurrency !== null && !isNaN(Number(c.fineCurrency))) {
                        item.fineCurrency = Number(c.fineCurrency);
                    }
                    return item;
                }
                return null;
            })
            .filter((c: any) => c !== null);

        if (normalizedChecks.length === 0) {
            return NextResponse.json({ error: 'At least one valid checklist item is required' }, { status: 400 });
        }

        // Prepare update data
        const updateData: any = {
            type,
            name: name || undefined,
            checks: normalizedChecks
        };

        if (type === 'global') {
            updateData.skills = undefined;
            updateData.employeeId = undefined;
            updateData.employeeIds = undefined;
        } else if (type === 'skill') {
            // Filter out empty skills and validate
            const filteredSkills = (skills || []).filter((s: string) => s && typeof s === 'string' && s.trim().length > 0);
            if (filteredSkills.length === 0) {
                return NextResponse.json({ error: 'At least one valid skill is required for skill type' }, { status: 400 });
            }
            updateData.skills = filteredSkills;
            updateData.employeeId = undefined;
            updateData.employeeIds = undefined;
        } else if (type === 'custom') {
            // Support both employeeIds (new) and employeeId (backward compatibility)
            if (employeeIds && Array.isArray(employeeIds)) {
                // Always set employeeIds, even if empty array (to clear old values)
                if (employeeIds.length > 0) {
                    updateData.employeeIds = employeeIds.map((id: string) => 
                        typeof id === 'string' ? new ObjectId(id) : id
                    );
                } else {
                    updateData.employeeIds = [];
                }
                updateData.employeeId = undefined; // Clear old single employeeId
            } else if (employeeId) {
                // Backward compatibility: convert single employeeId to array
                updateData.employeeIds = [typeof employeeId === 'string' ? new ObjectId(employeeId) : employeeId];
                updateData.employeeId = undefined;
            } else {
                // If neither employeeIds nor employeeId is provided, set empty array
                updateData.employeeIds = [];
                updateData.employeeId = undefined;
            }
            updateData.skills = undefined;
        }

        let config;
        if (_id) {
            // Update existing
            config = await ChecklistConfig.findByIdAndUpdate(
                _id,
                updateData,
                { new: true }
            );
        } else {
            // Create new
            config = await ChecklistConfig.create(updateData);
        }

        return NextResponse.json({ config });
    } catch (error) {
        console.error('Error saving checklist config:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        await ChecklistConfig.findByIdAndDelete(id);
        return NextResponse.json({ message: 'Configuration deleted' });
    } catch (error) {
        console.error('Error deleting checklist config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
