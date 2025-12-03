import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { dbConnect } from '@/lib/mongodb';
import ChecklistConfig from '@/models/ChecklistConfig';
import User from '@/models/User';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch employee profile to get skills
        const client = await clientPromise;
        const db = client.db('worknest');
        const employeeProfile = await db.collection('employeeProfiles').findOne({
            userId: user._id
        });
        const employeeSkills = (employeeProfile?.skills || [])
            .filter((s: string) => s && typeof s === 'string')
            .map((s: string) => s.toLowerCase().trim())
            .filter((s: string) => s.length > 0);

        // Priority: Custom > Skill-Based > Global
        let selectedConfig = null;
        let configType: 'global' | 'skill' | 'custom' = 'global';

        // 1. Check for custom config (highest priority)
        // Check both employeeIds array and employeeId (backward compatibility)
        const customConfigs = await ChecklistConfig.find({ type: 'custom' });
        const customConfig = customConfigs.find((config: any) => {
            // Check if user is in employeeIds array
            if (config.employeeIds && Array.isArray(config.employeeIds)) {
                return config.employeeIds.some((id: any) => 
                    (id.toString ? id.toString() : String(id)) === user._id.toString()
                );
            }
            // Backward compatibility: check employeeId
            if (config.employeeId) {
                return (config.employeeId.toString ? config.employeeId.toString() : String(config.employeeId)) === user._id.toString();
            }
            return false;
        });
        
        if (customConfig) {
            selectedConfig = customConfig;
            configType = 'custom';
        } else {
            // 2. Check for skill-based config
            if (employeeSkills.length > 0) {
                // Find skill-based configs that match any of the employee's skills
                const skillConfigs = await ChecklistConfig.find({ type: 'skill' });
                
                for (const skillConfig of skillConfigs) {
                    if (skillConfig.skills && skillConfig.skills.length > 0) {
                        const configSkills = skillConfig.skills.map((s: string) => s.toLowerCase().trim());
                        // Check if any employee skill matches any config skill
                        const hasMatchingSkill = employeeSkills.some((empSkill: string) =>
                            configSkills.some((configSkill: string) => 
                                empSkill.includes(configSkill) || configSkill.includes(empSkill)
                            )
                        );
                        
                        if (hasMatchingSkill) {
                            selectedConfig = skillConfig;
                            configType = 'skill';
                            break; // Use first matching skill config
                        }
                    }
                }
            }

            // 3. Fall back to global config
            // Employees are automatically excluded from global if they have skill-based or custom checklists
            // Since we already checked for custom and skill-based above, if we reach here, show global
            if (!selectedConfig) {
                const globalConfig = await ChecklistConfig.findOne({ type: 'global' });
                if (globalConfig) {
                    selectedConfig = globalConfig;
                    configType = 'global';
                }
            }
        }

        // Build checklist items
        let checks: { label: string; type: 'global' | 'skill' | 'custom'; bonus?: number; fine?: number }[] = [];

        if (selectedConfig) {
            checks = selectedConfig.checks.map((c: any) => {
                // Handle both string (backward compatibility) and object formats
                if (typeof c === 'string') {
                    return { 
                        label: c, 
                        type: configType 
                    };
                } else if (c && typeof c === 'object') {
                    const item: any = {
                        label: c.text || c.label || '',
                        type: configType
                    };
                    // Include bonus/fine if they exist
                    if (c.bonus !== undefined && c.bonus !== null) {
                        item.bonus = Number(c.bonus);
                    }
                    if (c.fine !== undefined && c.fine !== null) {
                        item.fine = Number(c.fine);
                    }
                    return item;
                }
                return { label: String(c), type: configType };
            });
        }

        return NextResponse.json({ 
            checklist: checks,
            configType,
            configName: selectedConfig?.name || null
        });
    } catch (error) {
        console.error('Error fetching employee checklist config:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}
