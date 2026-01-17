import mongoose, { Document, Schema } from "mongoose";

export interface ITaskCompletion extends Document {
  taskId: mongoose.Types.ObjectId;
  taskTitle: string;
  taskKind: "one-time" | "daily" | "weekly" | "monthly" | "recurring" | "custom";
  projectId: mongoose.Types.ObjectId;
  projectName: string;
  section: string;
  
  // Assignment
  assignedTo?: mongoose.Types.ObjectId;
  assignedToName?: string;
  assignees?: mongoose.Types.ObjectId[];
  assigneeNames?: string[];
  assignedDate?: Date; // Original assigned date (for daily tasks that were reset)
  assignedTime?: string; // Original assigned time
  
  // Completion details
  completedBy?: mongoose.Types.ObjectId; // Can be null for unticked tasks
  completedByName?: string;
  tickedAt?: Date; // When employee ticked the task (can be null for unticked tasks)
  completedAt?: Date; // When task was marked complete (can be null for unticked tasks)
  notTicked?: boolean; // Flag to indicate task was not ticked (for daily tasks)
  
  // Due dates at time of completion
  dueDate?: Date;
  dueTime?: string;
  deadlineDate?: Date;
  deadlineTime?: string;
  
  // Points and Currency earned
  bonusPoints?: number;
  bonusCurrency?: number;
  penaltyPoints?: number;
  penaltyCurrency?: number;
  
  // What was actually awarded (after approval)
  actualPoints?: number; // Positive or negative
  actualCurrency?: number; // Positive or negative
  
  // Approval
  approvedBy?: mongoose.Types.ObjectId;
  approvedByName?: string;
  approvedAt?: Date;
  approvalStatus: "pending" | "approved" | "rejected" | "deadline_passed";
  
  // Custom field values (snapshot at completion)
  customFields?: Array<{
    name: string;
    type: "number" | "string" | "boolean" | "date";
    defaultValue?: any;
  }>;
  customFieldValues?: Record<string, any>;
  
  // Priority at time of completion
  priority: number;
  
  // Metadata
  createdAt: Date; // When this completion record was created
}

const TaskCompletionSchema = new Schema<ITaskCompletion>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Task",
      index: true,
    },
    taskTitle: {
      type: String,
      required: true,
    },
    taskKind: {
      type: String,
      enum: ["one-time", "daily", "weekly", "monthly", "recurring", "custom"],
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "projects",
      index: true,
    },
    projectName: {
      type: String,
      required: true,
    },
    section: {
      type: String,
      default: "No Section",
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignedToName: {
      type: String,
    },
    assignees: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      index: true,
    },
    assigneeNames: {
      type: [String],
    },
    assignedDate: {
      type: Date,
    },
    assignedTime: {
      type: String,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      // Allow null for unticked tasks
    },
    completedByName: {
      type: String,
    },
    tickedAt: {
      type: Date,
      index: true,
      // Allow null for unticked tasks
    },
    completedAt: {
      type: Date,
      // Allow null for unticked tasks
    },
    notTicked: {
      type: Boolean,
      default: false,
      // Flag to indicate task was not ticked (for daily tasks)
    },
    dueDate: {
      type: Date,
    },
    dueTime: {
      type: String,
    },
    deadlineDate: {
      type: Date,
    },
    deadlineTime: {
      type: String,
    },
    bonusPoints: {
      type: Number,
      default: 0,
    },
    bonusCurrency: {
      type: Number,
      default: 0,
    },
    penaltyPoints: {
      type: Number,
      default: 0,
    },
    penaltyCurrency: {
      type: Number,
      default: 0,
    },
    actualPoints: {
      type: Number,
    },
    actualCurrency: {
      type: Number,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedByName: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "deadline_passed"],
      default: "pending",
      index: true,
    },
    customFields: [
      {
        name: String,
        type: {
          type: String,
          enum: ["number", "string", "boolean", "date"],
        },
        defaultValue: Schema.Types.Mixed,
      },
    ],
    customFieldValues: {
      type: Schema.Types.Mixed,
    },
    priority: {
      type: Number,
      default: 2,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for efficient queries
TaskCompletionSchema.index({ taskId: 1, tickedAt: -1 });
TaskCompletionSchema.index({ completedBy: 1, tickedAt: -1 });
TaskCompletionSchema.index({ projectId: 1, tickedAt: -1 });
TaskCompletionSchema.index({ tickedAt: -1 }); // For date range queries
TaskCompletionSchema.index({ approvalStatus: 1, tickedAt: -1 });

const TaskCompletion = mongoose.models.TaskCompletion || mongoose.model<ITaskCompletion>("TaskCompletion", TaskCompletionSchema);

export default TaskCompletion;
