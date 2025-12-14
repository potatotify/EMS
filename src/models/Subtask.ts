import mongoose, { Document, Schema } from "mongoose";

export type SubtaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
export type TaskKind = "one-time" | "daily" | "weekly" | "monthly" | "recurring" | "custom";

export interface ISubtask extends Document {
  taskId: mongoose.Types.ObjectId; // Parent task ID
  projectId: mongoose.Types.ObjectId; // Project ID for reference
  title: string;
  description?: string;
  
  // Assignment - Single employee assigned
  assignee?: mongoose.Types.ObjectId; // Assigned employee ID
  assigneeName?: string; // Assigned employee name
  
  // Task recurrence - inherited from parent task
  taskKind: TaskKind;
  
  // Recurring task settings (inherited from parent)
  recurringPattern?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
  
  // Custom recurrence settings (inherited from parent)
  customRecurrence?: {
    type: "daysOfWeek" | "daysOfMonth";
    daysOfWeek?: number[];
    daysOfMonth?: number[];
    recurring: boolean;
  };
  
  // Due dates
  dueDate?: Date;
  dueTime?: string; // HH:mm format
  
  // Priority (1-10, default 2)
  priority: number;
  
  // Status
  status: SubtaskStatus;
  ticked: boolean; // Whether subtask is ticked/completed by employee
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  tickedAt?: Date; // When employee ticks/completes the subtask
  
  // Ordering
  order: number;
  
  // Metadata
  createdBy: mongoose.Types.ObjectId; // Admin or lead assignee who created it
  createdAt: Date;
  updatedAt: Date;
}

const SubtaskSchema = new Schema<ISubtask>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Task",
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "projects",
      index: true,
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
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assigneeName: {
      type: String,
    },
    taskKind: {
      type: String,
      enum: ["one-time", "daily", "weekly", "monthly", "recurring", "custom"],
      default: "one-time",
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
    dueDate: {
      type: Date,
    },
    dueTime: {
      type: String,
      match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, // HH:mm format
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 2,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "overdue", "cancelled"],
      default: "pending",
      index: true,
    },
    ticked: {
      type: Boolean,
      default: false,
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
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
SubtaskSchema.index({ taskId: 1, order: 1 });
SubtaskSchema.index({ assignee: 1, status: 1 });
SubtaskSchema.index({ projectId: 1, status: 1 });

// Auto-update status based on dates
SubtaskSchema.pre("save", function (next) {
  if (this.isModified("dueDate") || this.isModified("status")) {
    const now = new Date();
    if (this.status !== "completed" && this.status !== "cancelled") {
      if (this.dueDate && new Date(this.dueDate) < now && this.status === "pending") {
        this.status = "overdue";
      }
    }
  }
  next();
});

// Delete cached model to ensure schema updates are applied
if (mongoose.models.Subtask) {
  delete mongoose.models.Subtask;
}

const Subtask = mongoose.model<ISubtask>("Subtask", SubtaskSchema);

export default Subtask;
