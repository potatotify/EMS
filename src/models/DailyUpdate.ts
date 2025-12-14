import { Schema, model, Document, models } from 'mongoose';

export interface IDailyUpdate extends Document {
  employeeId: Schema.Types.ObjectId;
  date: Date;
  status: 'pending' | 'submitted' | 'reviewed' | 'approved';
  score: number;

  // Daily Updates
  attendedMorningSession: boolean;
  cameOnTime: boolean;
  workedOnProject: boolean;
  askedForNewProject: boolean;
  gotCodeCorrected: boolean;
  updatedClient: boolean;
  workedOnTrainingTask: boolean;
  updatedSeniorTeam: boolean;
  updatedDailyProgress: boolean;
  plannedNextDayTask: boolean;
  completedAllTasks: boolean;
  workedOnMultipleProjects: boolean;
  tasksForTheDay: string;

  // Project Management
  informedUnableToComplete: boolean;
  ensuredProjectReassigned: boolean;
  ensuredProjectOnTime: boolean;
  informedBeforeBunking: boolean;
  informedBeforeLate: boolean;
  informedLeavingMeeting: boolean;

  // Freelancer Management
  freelancerNeeded: boolean;
  ensuredFreelancerHired: boolean;

  // Communication
  addedToWhatsAppGroup: boolean;
  slackGroupCreated: boolean;

  // Project Management (continued)
  projectAssignedToSomeoneElse: boolean;
  supervisor: string;
  projectInPriority: boolean;
  followedUpWithClient: boolean;
  completedAllProjectTasks: boolean;
  setTaskDeadlines: boolean;
  recordedLoomVideos: boolean;
  organizedLoomVideos: boolean;
  metDeadlines: boolean;
  screenShared: boolean;

  // Additional Info
  hoursWorked: number;
  additionalNotes: string;

  // Admin Fields
  adminNotes: string;
  adminScore: number;
  adminApproved: boolean;
  lastModified: Date;

  // Dynamic Checklist
  checklist: {
    label: string;
    checked: boolean;
    type: 'global' | 'skill' | 'custom';
  }[];
}

const dailyUpdateSchema = new Schema<IDailyUpdate>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'reviewed', 'approved'],
    default: 'pending'
  },
  score: { type: Number, default: 0 },

  // Daily Updates
  attendedMorningSession: { type: Boolean, default: false },
  cameOnTime: { type: Boolean, default: false },
  workedOnProject: { type: Boolean, default: false },
  askedForNewProject: { type: Boolean, default: false },
  gotCodeCorrected: { type: Boolean, default: false },
  updatedClient: { type: Boolean, default: false },
  workedOnTrainingTask: { type: Boolean, default: false },
  updatedSeniorTeam: { type: Boolean, default: false },
  updatedDailyProgress: { type: Boolean, default: false },
  plannedNextDayTask: { type: Boolean, default: false },
  completedAllTasks: { type: Boolean, default: false },
  workedOnMultipleProjects: { type: Boolean, default: false },
  tasksForTheDay: { type: String, default: '' },

  // Project Management
  informedUnableToComplete: { type: Boolean, default: false },
  ensuredProjectReassigned: { type: Boolean, default: false },
  ensuredProjectOnTime: { type: Boolean, default: false },
  informedBeforeBunking: { type: Boolean, default: false },
  informedBeforeLate: { type: Boolean, default: false },
  informedLeavingMeeting: { type: Boolean, default: false },

  // Freelancer Management
  freelancerNeeded: { type: Boolean, default: false },
  ensuredFreelancerHired: { type: Boolean, default: false },

  // Communication
  addedToWhatsAppGroup: { type: Boolean, default: false },
  slackGroupCreated: { type: Boolean, default: false },

  // Project Management (continued)
  projectAssignedToSomeoneElse: { type: Boolean, default: false },
  supervisor: { type: String, default: '' },
  projectInPriority: { type: Boolean, default: true },
  followedUpWithClient: { type: Boolean, default: false },
  completedAllProjectTasks: { type: Boolean, default: false },
  setTaskDeadlines: { type: Boolean, default: false },
  recordedLoomVideos: { type: Boolean, default: false },
  organizedLoomVideos: { type: Boolean, default: false },
  metDeadlines: { type: Boolean, default: false },
  screenShared: { type: Boolean, default: false },

  // Additional Info
  hoursWorked: { type: Number, default: 0 },
  additionalNotes: { type: String, default: '' },

  // Admin Fields
  adminNotes: { type: String, default: '' },
  adminScore: { type: Number, default: 0 },
  adminApproved: { type: Boolean, default: false },
  lastModified: { type: Date, default: Date.now },

  // Dynamic Checklist
  checklist: [{
    label: { type: String, required: true },
    checked: { type: Boolean, default: false },
    type: { type: String, enum: ['global', 'skill', 'custom'], default: 'global' }
  }]
}, { timestamps: true });

dailyUpdateSchema.pre('save', function (next: any) {
  (this as any).lastModified = new Date();
  next();
});

// Delete the model from cache if it exists to ensure fresh schema
if (models.DailyUpdate) {
  delete models.DailyUpdate;
}

export default models.DailyUpdate || model<IDailyUpdate>('DailyUpdate', dailyUpdateSchema);
