import { Schema, model, Document, models } from 'mongoose';

export interface IChecklistItem {
    text: string;
    bonus?: number; // Optional bonus points
    bonusCurrency?: number; // Optional bonus currency (₹)
    fine?: number; // Optional fine points
    fineCurrency?: number; // Optional fine currency (₹)
}

export interface IChecklistConfig extends Document {
    type: 'global' | 'skill' | 'custom';
    name?: string; // Optional name/description for the checklist
    // For skill-based: skills array - if employee has any of these skills, they see this checklist
    skills?: string[];
    // For custom: specific employee(s) - supports multiple employees
    employeeId?: Schema.Types.ObjectId; // For backward compatibility
    employeeIds?: Schema.Types.ObjectId[]; // For multiple employees
    checks: (string | IChecklistItem)[]; // Support both string (backward compatibility) and object format
    createdAt: Date;
    updatedAt: Date;
}

const checklistConfigSchema = new Schema<IChecklistConfig>(
    {
        type: {
            type: String,
            enum: ['global', 'skill', 'custom'],
            required: true
        },
        name: { type: String }, // e.g., "Web Development Checklist", "ML Checklist"
        skills: [{ type: String }], // For skill type - array of skills that trigger this checklist
        employeeId: { type: Schema.Types.ObjectId, ref: 'User' }, // For custom type - backward compatibility
        employeeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }], // For custom type - multiple employees
        checks: [{
            type: Schema.Types.Mixed, // Support both string and object formats
            required: true
        }]
    },
    { timestamps: true }
);

// Ensure unique configuration per type/employee (for custom)
// For skill-based, multiple can exist with different skill sets
// For global, only one should exist (but we'll allow multiple for flexibility)
checklistConfigSchema.index({ type: 1, employeeId: 1 }, { unique: true, sparse: true });

// Force delete the model from cache to ensure fresh schema with updated enum
// This is critical when changing enum values - Mongoose caches compiled models
const modelName = 'ChecklistConfig';
if (models[modelName]) {
    delete models[modelName];
}

// Export the model - this will create a new instance with the updated schema
// Note: In development, you may need to restart the server for enum changes to take effect
export default model<IChecklistConfig>(modelName, checklistConfigSchema);
