import mongoose, { Document, Schema } from "mongoose";

export type TaskKind = "one-time" | "daily" | "weekly" | "monthly" | "recurring" | "custom";
export type TaskPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";

export interface ITask extends Document {
  projectId: mongoose.Types.ObjectId;
  projectName: string;
  section: string; // Section name (e.g., "No Section", "Backend", "Frontend")
  title: string;
  description?: string;
  taskKind: TaskKind;
  
  // Assignment
  assignedTo?: mongoose.Types.ObjectId; // Primary employee ID (for backward compatibility)
  assignedToName?: string; // Primary employee name or combined names
  assignees?: mongoose.Types.ObjectId[]; // All assigned employees
  assigneeNames?: string[]; // All assigned employee names
  assignedDate?: Date;
  assignedTime?: string; // HH:mm format
  
  // Due dates
  dueDate?: Date;
  dueTime?: string; // HH:mm format
  
  // Deadline
  deadlineDate?: Date;
  deadlineTime?: string; // HH:mm format
  
  // Priority (1-10, default 2)
  priority: TaskPriority;
  
  // Points and Currency
  bonusPoints?: number; // Reward points
  bonusCurrency?: number; // Reward currency (₹)
  penaltyPoints?: number; // Fine/penalty points
  penaltyCurrency?: number; // Fine/penalty currency (₹)
  
  // Status
  status: TaskStatus;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  tickedAt?: Date; // When employee ticks/completes the task
  notApplicable?: boolean; // If true, bonus/penalty points don't apply to this task
  
  // Approval
  approvedBy?: mongoose.Types.ObjectId; // Admin who approved
  approvedAt?: Date; // When task was approved
  approvalStatus?: "pending" | "approved" | "rejected"; // Approval status
  
  // Recurring task settings
  recurringPattern?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number; // Every N days/weeks/months
    endDate?: Date;
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday) for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
  
  // Custom recurrence settings (for taskKind: "custom")
  customRecurrence?: {
    type: "daysOfWeek" | "daysOfMonth"; // Days of week OR specific days of month
    daysOfWeek?: number[]; // Days of week [0=Sunday, 1=Monday, ..., 6=Saturday]
    daysOfMonth?: number[]; // Specific days of month [1, 15, 30]
    recurring: boolean; // If true, repeats weekly/monthly; if false, one-time
  };
  
  // Ordering within section
  order: number;
  
  // Custom fields
  customFields?: Array<{
    name: string; // Field name (e.g., "duration", "quality_score")
    type: "number" | "string" | "boolean" | "date"; // Field type
    defaultValue?: any; // Default/initial value for the field
  }>;
  
  // Custom field values (filled when task is completed)
  customFieldValues?: Record<string, any>; // Key-value pairs: fieldName -> value
  
  // Metadata
  createdBy: mongoose.Types.ObjectId; // Admin or employee who created it
  createdByEmployee?: boolean; // Flag to distinguish employee-created tasks
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "projects",
      index: true,
    },
    assignees: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      index: true,
    },
    assigneeNames: {
      type: [String],
    },
    projectName: {
      type: String,
      required: true,
    },
    section: {
      type: String,
      default: "No Section",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    taskKind: {
      type: String,
      enum: ["one-time", "daily", "weekly", "monthly", "recurring", "custom"],
      default: "one-time",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignedToName: {
      type: String,
    },
    assignedDate: {
      type: Date,
    },
    assignedTime: {
      type: String,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format
    },
    dueDate: {
      type: Date,
    },
    dueTime: {
      type: String,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
    },
    deadlineDate: {
      type: Date,
    },
    deadlineTime: {
      type: String,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
    },
    priority: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      default: 2,
    },
    bonusPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonusCurrency: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltyCurrency: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "overdue", "cancelled"],
      default: "pending",
      index: true,
    },
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    tickedAt: {
      type: Date,
    },
    notApplicable: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    recurringPattern: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
      },
      interval: {
        type: Number,
        min: 1,
      },
      endDate: {
        type: Date,
      },
      daysOfWeek: {
        type: [Number],
        validate: {
          validator: function(v: number[]) {
            return v.every((day) => day >= 0 && day <= 6);
          },
          message: "Days of week must be between 0-6",
        },
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
      },
    },
    customRecurrence: {
      type: new Schema({
        type: {
          type: String,
          enum: ["daysOfWeek", "daysOfMonth"],
        },
        daysOfWeek: {
          type: [Number],
          default: [],
          validate: {
            validator: function(v: number[]) {
              return v.every((day) => day >= 0 && day <= 6);
            },
            message: "Days of week must be between 0-6",
          },
        },
        daysOfMonth: {
          type: [Number],
          default: [],
          validate: {
            validator: function(v: number[]) {
              return v.every((day) => day >= 1 && day <= 31);
            },
            message: "Days of month must be between 1-31",
          },
        },
        recurring: {
          type: Boolean,
          default: false,
        },
      }, { _id: false }),
      required: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    customFields: {
      type: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
          },
          type: {
            type: String,
            enum: ["number", "string", "boolean", "date"],
            required: true,
          },
          defaultValue: {
            type: Schema.Types.Mixed,
            default: undefined,
          },
        },
      ],
      default: undefined,
    },
    customFieldValues: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    createdByEmployee: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
TaskSchema.index({ projectId: 1, section: 1, order: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ assignees: 1, status: 1 });
TaskSchema.index({ dueDate: 1, status: 1 });
TaskSchema.index({ deadlineDate: 1 });

// Auto-update status based on dates
TaskSchema.pre("save", function (next) {
  if (this.isModified("dueDate") || this.isModified("deadlineDate") || this.isModified("status")) {
    const now = new Date();
    if (this.status !== "completed" && this.status !== "cancelled") {
      if (this.deadlineDate && new Date(this.deadlineDate) < now) {
        this.status = "overdue";
      } else if (this.dueDate && new Date(this.dueDate) < now && this.status === "pending") {
        // Only auto-set to overdue if still pending
        if (!this.deadlineDate || new Date(this.deadlineDate) >= now) {
          this.status = "overdue";
        }
      }
    }
  }
  next();
});

const Task = mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);

export default Task;

