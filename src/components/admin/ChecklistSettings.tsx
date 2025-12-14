"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Save, Loader2, X, Users, Code, DollarSign } from "lucide-react";

interface ChecklistItem {
    text: string;
    bonus?: number;
    bonusCurrency?: number;
    fine?: number;
    fineCurrency?: number;
}

interface ChecklistConfig {
    _id?: string;
    type: 'global' | 'skill' | 'custom';
    name?: string;
    skills?: string[];
    employeeId?: { _id: string; name: string; email: string } | string; // For backward compatibility
    employeeIds?: string[]; // For multiple employees in custom checklist
    checks: (string | ChecklistItem)[]; // Support both string (backward compatibility) and object format
}

interface Employee {
    _id: string;
    fullName?: string;
    name?: string;
    email?: string;
    userId?: string;
}

export default function ChecklistSettings() {
    const [configs, setConfigs] = useState<ChecklistConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [showSkillsInput, setShowSkillsInput] = useState<number | null>(null);
    const [showEmployeeSelect, setShowEmployeeSelect] = useState<number | null>(null);
    const employeeSelectRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchConfigs();
        fetchEmployees();
    }, []);

    // Close modals when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (employeeSelectRef.current && !employeeSelectRef.current.contains(event.target as Node)) {
                setShowEmployeeSelect(null);
            }
        };

        if (showEmployeeSelect !== null) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showEmployeeSelect]);

    const fetchConfigs = async () => {
        try {
            const response = await fetch("/api/admin/checklist-config");
            if (!response.ok) {
                console.error("Failed to fetch configs:", response.statusText);
                setLoading(false);
                return;
            }
            const data = await response.json();
            console.log("Fetched configs data:", data); // Debug log
            if (data.configs && Array.isArray(data.configs)) {
                // Normalize employeeIds (for custom type) and checks (for backward compatibility)
                const normalizedConfigs = data.configs.map((config: any) => {
                    // Handle employeeIds - could be populated objects or IDs
                    let employeeIds: string[] = [];
                    if (config.employeeIds && Array.isArray(config.employeeIds)) {
                        // Handle populated objects (with _id, name, email) or plain ObjectIds/strings
                        employeeIds = config.employeeIds.map((emp: any) => {
                            if (typeof emp === 'object' && emp !== null) {
                                // If it's a populated object with _id
                                if (emp._id) {
                                    // Handle ObjectId or string _id
                                    return emp._id.toString ? emp._id.toString() : String(emp._id);
                                }
                                // If it's an ObjectId directly
                                if (emp.toString && typeof emp.toString === 'function') {
                                    return emp.toString();
                                }
                            }
                            // If it's a string or other type
                            return emp?.toString ? emp.toString() : String(emp);
                        }).filter((id: string) => id && id.length > 0); // Filter out any invalid IDs
                    } else if (config.employeeId) {
                        // Backward compatibility: convert single employeeId to array
                        const empId = config.employeeId._id || config.employeeId;
                        employeeIds = [empId].map((id: any) => 
                            id?.toString ? id.toString() : String(id)
                        ).filter((id: string) => id && id.length > 0);
                    }
                    
                    // Normalize checks: convert strings to objects for backward compatibility
                    const normalizedChecks = (config.checks || []).map((check: any): ChecklistItem => {
                        if (typeof check === 'string') {
                            return { text: check };
                        } else if (check && typeof check === 'object') {
                            return {
                                text: check.text || check.label || '',
                                bonus: check.bonus !== undefined && check.bonus !== null ? Number(check.bonus) : undefined,
                                bonusCurrency: check.bonusCurrency !== undefined && check.bonusCurrency !== null ? Number(check.bonusCurrency) : undefined,
                                fine: check.fine !== undefined && check.fine !== null ? Number(check.fine) : undefined,
                                fineCurrency: check.fineCurrency !== undefined && check.fineCurrency !== null ? Number(check.fineCurrency) : undefined
                            };
                        }
                        return { text: String(check) };
                    });
                    
                    return {
                        ...config,
                        employeeIds: employeeIds || [], // Ensure it's always an array
                        employeeId: config.employeeId?._id || config.employeeId || undefined, // Keep for backward compatibility
                        skills: config.skills || [],
                        checks: normalizedChecks
                    };
                });
                setConfigs(normalizedConfigs);
            } else {
                console.warn("No configs found or invalid response structure:", data);
                setConfigs([]);
            }
        } catch (error) {
            console.error("Error fetching configs:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await fetch("/api/admin/employees");
            const data = await response.json();
            if (data.employees) {
                setEmployees(data.employees.map((emp: any) => ({
                    _id: emp._id || emp.userId,
                    name: emp.fullName || emp.name || 'Unknown',
                    email: emp.email || ''
                })));
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const handleAddConfig = (type: 'global' | 'skill' | 'custom') => {
        setConfigs([
            ...configs,
            {
                type,
                name: '',
                checks: [{ text: "" }],
                skills: type === 'skill' ? [] : undefined,
                employeeIds: type === 'custom' ? [] : undefined,
                employeeId: type === 'custom' ? undefined : undefined // For backward compatibility
            }
        ]);
    };

    const handleUpdateConfig = (index: number, field: keyof ChecklistConfig, value: any) => {
        const newConfigs = [...configs];
        newConfigs[index] = { ...newConfigs[index], [field]: value };
        setConfigs(newConfigs);
    };

    const handleCheckChange = (configIndex: number, checkIndex: number, field: 'text' | 'bonus' | 'bonusCurrency' | 'fine' | 'fineCurrency', value: string | number | undefined) => {
        const newConfigs = [...configs];
        const check = newConfigs[configIndex].checks[checkIndex];
        const checkItem: ChecklistItem = typeof check === 'string' 
            ? { text: check } 
            : { ...check };
        
        if (field === 'text') {
            checkItem.text = value as string;
        } else if (field === 'bonus') {
            checkItem.bonus = value !== undefined && value !== '' && value !== null 
                ? (typeof value === 'number' ? value : Number(value)) 
                : undefined;
        } else if (field === 'bonusCurrency') {
            checkItem.bonusCurrency = value !== undefined && value !== '' && value !== null 
                ? (typeof value === 'number' ? value : Number(value)) 
                : undefined;
        } else if (field === 'fine') {
            checkItem.fine = value !== undefined && value !== '' && value !== null 
                ? (typeof value === 'number' ? value : Number(value)) 
                : undefined;
        } else if (field === 'fineCurrency') {
            checkItem.fineCurrency = value !== undefined && value !== '' && value !== null 
                ? (typeof value === 'number' ? value : Number(value)) 
                : undefined;
        }
        
        newConfigs[configIndex].checks[checkIndex] = checkItem;
        setConfigs(newConfigs);
    };

    const handleAddCheck = (configIndex: number) => {
        const newConfigs = [...configs];
        newConfigs[configIndex].checks.push({ text: "" });
        setConfigs(newConfigs);
    };

    const handleRemoveCheck = (configIndex: number, checkIndex: number) => {
        const newConfigs = [...configs];
        newConfigs[configIndex].checks.splice(checkIndex, 1);
        setConfigs(newConfigs);
    };

    const handleToggleEmployee = (configIndex: number, employeeId: string) => {
        const newConfigs = [...configs];
        const employeeIds = newConfigs[configIndex].employeeIds || [];
        const index = employeeIds.indexOf(employeeId);
        if (index > -1) {
            employeeIds.splice(index, 1);
        } else {
            employeeIds.push(employeeId);
        }
        newConfigs[configIndex].employeeIds = employeeIds;
        setConfigs(newConfigs);
    };

    const handleAddSkill = (configIndex: number, skill: string) => {
        if (!skill.trim()) return;
        const newConfigs = [...configs];
        const skills = newConfigs[configIndex].skills || [];
        const normalizedSkill = skill.trim().toLowerCase();
        if (!skills.includes(normalizedSkill)) {
            skills.push(normalizedSkill);
            newConfigs[configIndex].skills = skills;
            setConfigs(newConfigs);
        }
    };

    const handleRemoveSkill = (configIndex: number, skill: string) => {
        const newConfigs = [...configs];
        const skills = newConfigs[configIndex].skills || [];
        newConfigs[configIndex].skills = skills.filter((s: string) => s !== skill);
        setConfigs(newConfigs);
    };

    const handleSave = async (config: ChecklistConfig, index: number) => {
        // Validation - normalize all checks to ChecklistItem format first
        const normalizedChecksList: ChecklistItem[] = config.checks.map(c => {
            if (typeof c === 'string') {
                return { text: c, type: 'global' };
            }
            return c;
        });
        
        const validChecks = normalizedChecksList.filter(c => c.text && c.text.trim().length > 0);
        
        if (!config.checks || config.checks.length === 0 || validChecks.length === 0) {
            alert("Please add at least one checklist item");
            return;
        }

        if (config.type === 'custom' && (!config.employeeIds || config.employeeIds.length === 0)) {
            alert("Please select at least one employee for custom checklist");
            return;
        }

        if (config.type === 'skill') {
            const validSkills = (config.skills || []).filter((s: string) => s && s.trim().length > 0);
            if (validSkills.length === 0) {
                alert("Please add at least one skill for skill-based checklist");
                return;
            }
        }

        setSaving(true);
        try {
            // Normalize checks to ensure they're in object format
            const normalizedChecks = validChecks.map(check => {
                // Remove undefined values to keep payload clean
                const cleaned: any = { text: check.text.trim() };
                if (check.bonus !== undefined && check.bonus !== null) cleaned.bonus = Number(check.bonus);
                if (check.bonusCurrency !== undefined && check.bonusCurrency !== null) cleaned.bonusCurrency = Number(check.bonusCurrency);
                if (check.fine !== undefined && check.fine !== null) cleaned.fine = Number(check.fine);
                if (check.fineCurrency !== undefined && check.fineCurrency !== null) cleaned.fineCurrency = Number(check.fineCurrency);
                return cleaned;
            });

            const payload: any = {
                _id: config._id,
                type: config.type,
                name: config.name || undefined,
                checks: normalizedChecks
            };

            if (config.type === 'skill') {
                // Filter out empty skills
                payload.skills = (config.skills || []).filter((s: string) => s && s.trim().length > 0);
            } else if (config.type === 'custom') {
                payload.employeeIds = config.employeeIds || [];
            }

            const response = await fetch("/api/admin/checklist-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                alert("Configuration saved successfully!");
                fetchConfigs();
            } else {
                const errorMsg = data.details 
                    ? `${data.error}: ${data.details}` 
                    : (data.error || 'Unknown error');
                alert(`Failed to save: ${errorMsg}`);
                console.error("Save error details:", data);
            }
        } catch (error) {
            console.error("Error saving config:", error);
            alert(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this configuration?")) return;
        try {
            const response = await fetch(`/api/admin/checklist-config?id=${id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                fetchConfigs();
            }
        } catch (error) {
            console.error("Error deleting config:", error);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-900">Daily Update Checklist Settings</h2>
                    <p className="text-neutral-600">Configure global, skill-based, and custom checklists for employees</p>
                    <p className="text-sm text-neutral-500 mt-1">
                        Priority: Custom &gt; Skill-Based &gt; Global
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleAddConfig('global')}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Global
                    </button>
                    <button
                        onClick={() => handleAddConfig('skill')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Code className="w-4 h-4" /> Skill-Based
                    </button>
                    <button
                        onClick={() => handleAddConfig('custom')}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                        <Users className="w-4 h-4" /> Custom
                    </button>
                </div>
            </div>

            <div className="grid gap-6">
                {configs.map((config, index) => (
                    <motion.div
                        key={config._id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                        config.type === 'global' ? 'bg-emerald-100 text-emerald-800' :
                                        config.type === 'skill' ? 'bg-blue-100 text-blue-800' :
                                        'bg-purple-100 text-purple-800'
                                    }`}>
                                        {config.type}
                                    </span>
                                    <input
                                        type="text"
                                        value={config.name || ''}
                                        onChange={(e) => handleUpdateConfig(index, 'name', e.target.value)}
                                        placeholder="Checklist name (e.g., Web Development, ML, etc.)"
                                        className="flex-1 border border-neutral-300 rounded-md px-3 py-1 text-sm"
                                    />
                                </div>

                                {config.type === 'global' && (
                                    <div className="space-y-2">
                                        <span className="text-xs text-neutral-500">
                                            All employees will see this checklist unless they have a skill-based or custom checklist assigned
                                        </span>
                                    </div>
                                )}

                                {config.type === 'skill' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {config.skills?.map((skill, skillIndex) => (
                                                <span
                                                    key={skillIndex}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                                                >
                                                    {skill}
                                                    <button
                                                        onClick={() => handleRemoveSkill(index, skill)}
                                                        className="hover:text-blue-600"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                            {showSkillsInput !== index && (
                                                <button
                                                    onClick={() => setShowSkillsInput(index)}
                                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 border border-blue-300 rounded-md hover:bg-blue-50"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Skill
                                                </button>
                                            )}
                                        </div>
                                        {showSkillsInput === index && (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Enter skill (e.g., react, ml, python)"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddSkill(index, e.currentTarget.value);
                                                            e.currentTarget.value = '';
                                                            setShowSkillsInput(null);
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        if (e.target.value.trim()) {
                                                            handleAddSkill(index, e.target.value);
                                                            e.target.value = '';
                                                        }
                                                        setShowSkillsInput(null);
                                                    }}
                                                    autoFocus
                                                    className="flex-1 border border-neutral-300 rounded-md px-3 py-1 text-sm"
                                                />
                                            </div>
                                        )}
                                        <span className="text-xs text-neutral-500">
                                            Employees with matching skills will see this checklist (e.g., "react" matches employees with "react" skill)
                                        </span>
                                    </div>
                                )}

                                {config.type === 'custom' && (
                                    <div className="space-y-2">
                                        <div className="relative" ref={showEmployeeSelect === index ? employeeSelectRef : null}>
                                            <button
                                                type="button"
                                                onClick={() => setShowEmployeeSelect(showEmployeeSelect === index ? null : index)}
                                                className="text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-1 px-3 py-1 border border-neutral-300 rounded-md hover:bg-neutral-50"
                                            >
                                                <Users className="w-4 h-4" />
                                                Select Employees ({config.employeeIds?.length || 0})
                                            </button>
                                            {showEmployeeSelect === index && (
                                                <div className="absolute z-10 mt-2 left-0 bg-white border border-neutral-200 rounded-lg shadow-lg p-4 max-h-64 overflow-y-auto min-w-[300px]">
                                                    <div className="space-y-2">
                                                        {employees.length === 0 ? (
                                                            <p className="text-sm text-neutral-500">No employees found</p>
                                                        ) : (
                                                            employees.map(emp => {
                                                                const isSelected = config.employeeIds?.includes(emp._id);
                                                                return (
                                                                    <label key={emp._id} className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => handleToggleEmployee(index, emp._id)}
                                                                            className="rounded"
                                                                        />
                                                                        <span className="text-sm">{emp.name} {emp.email ? `(${emp.email})` : ''}</span>
                                                                    </label>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {config.employeeIds && config.employeeIds.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {config.employeeIds.map((empId: string) => {
                                                    const emp = employees.find(e => e._id === empId);
                                                    return emp ? (
                                                        <span
                                                            key={empId}
                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-sm"
                                                        >
                                                            {emp.name}
                                                            <button
                                                                onClick={() => handleToggleEmployee(index, empId)}
                                                                className="hover:text-purple-600"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                        <span className="text-xs text-neutral-500">
                                            Selected employees will see this custom checklist instead of global or skill-based checklists
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 ml-4">
                                <button
                                    onClick={() => handleSave(config, index)}
                                    disabled={saving}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Save"
                                >
                                    <Save className="w-5 h-5" />
                                </button>
                                {config._id && (
                                    <button
                                        onClick={() => handleDelete(config._id!)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 mt-4">
                            <label className="block text-sm font-medium text-neutral-700">Checklist Items</label>
                            {config.checks.map((check, checkIndex) => {
                                const checkItem: ChecklistItem = typeof check === 'string' 
                                    ? { text: check } 
                                    : check;
                                return (
                                    <div key={checkIndex} className="space-y-2 p-4 border border-neutral-200 rounded-lg bg-neutral-50">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={checkItem.text}
                                                onChange={(e) => handleCheckChange(index, checkIndex, 'text', e.target.value)}
                                                placeholder="Enter check description (e.g., Attended morning session)"
                                                className="flex-1 border border-neutral-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                            />
                                            <button
                                                onClick={() => handleRemoveCheck(index, checkIndex)}
                                                className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                                <label className="text-xs text-neutral-600 whitespace-nowrap">Bonus Points:</label>
                                                <input
                                                    type="number"
                                                    value={checkItem.bonus !== undefined ? checkItem.bonus : ''}
                                                    onChange={(e) => handleCheckChange(index, checkIndex, 'bonus', e.target.value === '' ? undefined : e.target.value)}
                                                    placeholder="Optional"
                                                    min="0"
                                                    step="1"
                                                    className="flex-1 border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-emerald-600" />
                                                <label className="text-xs text-neutral-600 whitespace-nowrap">Bonus Currency (₹):</label>
                                                <input
                                                    type="number"
                                                    value={checkItem.bonusCurrency !== undefined ? checkItem.bonusCurrency : ''}
                                                    onChange={(e) => handleCheckChange(index, checkIndex, 'bonusCurrency', e.target.value === '' ? undefined : e.target.value)}
                                                    placeholder="Optional"
                                                    min="0"
                                                    step="1"
                                                    className="flex-1 border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-red-600" />
                                                <label className="text-xs text-neutral-600 whitespace-nowrap">Penalty Points:</label>
                                                <input
                                                    type="number"
                                                    value={checkItem.fine !== undefined ? checkItem.fine : ''}
                                                    onChange={(e) => handleCheckChange(index, checkIndex, 'fine', e.target.value === '' ? undefined : e.target.value)}
                                                    placeholder="Optional"
                                                    min="0"
                                                    step="1"
                                                    className="flex-1 border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-red-600" />
                                                <label className="text-xs text-neutral-600 whitespace-nowrap">Penalty Currency (₹):</label>
                                                <input
                                                    type="number"
                                                    value={checkItem.fineCurrency !== undefined ? checkItem.fineCurrency : ''}
                                                    onChange={(e) => handleCheckChange(index, checkIndex, 'fineCurrency', e.target.value === '' ? undefined : e.target.value)}
                                                    placeholder="Optional"
                                                    min="0"
                                                    step="1"
                                                    className="flex-1 border border-neutral-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <button
                                onClick={() => handleAddCheck(index)}
                                className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> Add Check
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {configs.length === 0 && (
                <div className="text-center py-12 text-neutral-500">
                    <p>No checklist configurations yet. Create one to get started!</p>
                </div>
            )}
        </div>
    );
}
