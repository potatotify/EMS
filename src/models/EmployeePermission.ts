import { Schema, model, Document, models } from 'mongoose';
import { PERMISSIONS } from '@/lib/permission-constants';
import type { Permission } from '@/lib/permission-constants';

// Note: PERMISSIONS and Permission are imported from permission-constants.ts
// Server-side code should import directly from '@/lib/permission-constants'

export interface IEmployeePermission extends Document {
  employeeId: Schema.Types.ObjectId; // Reference to User
  permissions: Permission[];
  grantedBy: Schema.Types.ObjectId; // Admin who granted permissions
  grantedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

const employeePermissionSchema = new Schema<IEmployeePermission>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    permissions: [{
      type: String,
      enum: Object.values(PERMISSIONS),
      required: true
    }],
    grantedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    grantedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index for faster lookups
employeePermissionSchema.index({ employeeId: 1 });

export default models.EmployeePermission || model<IEmployeePermission>('EmployeePermission', employeePermissionSchema);

