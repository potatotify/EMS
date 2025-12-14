import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISubtaskCompletion extends Document {
  subtaskId: Types.ObjectId;
  taskId: Types.ObjectId;
  subtaskTitle: string;
  parentTaskTitle: string;
  taskKind: string;
  projectId: Types.ObjectId;
  projectName: string;
  section: string;
  assignees?: Types.ObjectId[];
  assigneeNames?: string[];
  completedBy?: Types.ObjectId;
  completedByName?: string;
  tickedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
}

const SubtaskCompletionSchema = new Schema<ISubtaskCompletion>(
  {
    subtaskId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Subtask",
    },
    taskId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Task",
    },
    subtaskTitle: {
      type: String,
      required: true,
    },
    parentTaskTitle: {
      type: String,
      required: true,
    },
    taskKind: {
      type: String,
      required: true,
      enum: ["one-time", "daily", "weekly", "monthly", "recurring", "custom"],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
    },
    projectName: {
      type: String,
    },
    section: {
      type: String,
      default: "No Section",
    },
    assignees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    assigneeNames: [String],
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    completedByName: String,
    tickedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
SubtaskCompletionSchema.index({ subtaskId: 1, tickedAt: -1 });
SubtaskCompletionSchema.index({ taskId: 1, tickedAt: -1 });
SubtaskCompletionSchema.index({ completedBy: 1, tickedAt: -1 });
SubtaskCompletionSchema.index({ projectId: 1, tickedAt: -1 });
SubtaskCompletionSchema.index({ tickedAt: -1 });

const SubtaskCompletion = mongoose.models.SubtaskCompletion || mongoose.model<ISubtaskCompletion>("SubtaskCompletion", SubtaskCompletionSchema);

export default SubtaskCompletion;
