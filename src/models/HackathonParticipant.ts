import { Schema, model, Document, models } from 'mongoose';

export interface IHackathonParticipant extends Document {
  hackathonId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  teamName?: string;
  submission?: {
    projectName: string;
    description: string;
    githubLink?: string;
    demoLink?: string;
    videoLink?: string;
    submittedAt: Date;
  };
  status: 'registered' | 'submitted' | 'disqualified' | 'winner' | 'runner_up';
  score?: number;
  rank?: number;
  createdAt: Date;
  updatedAt: Date;
}

const hackathonParticipantSchema = new Schema<IHackathonParticipant>({
  hackathonId: { type: Schema.Types.ObjectId, ref: 'Hackathon', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  teamName: { type: String },
  submission: {
    projectName: { type: String },
    description: { type: String },
    githubLink: { type: String },
    demoLink: { type: String },
    videoLink: { type: String },
    submittedAt: { type: Date }
  },
  status: {
    type: String,
    enum: ['registered', 'submitted', 'disqualified', 'winner', 'runner_up'],
    default: 'registered'
  },
  score: { type: Number },
  rank: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to prevent duplicate registrations
hackathonParticipantSchema.index({ hackathonId: 1, userId: 1 }, { unique: true });

export default models.HackathonParticipant || model<IHackathonParticipant>('HackathonParticipant', hackathonParticipantSchema);

