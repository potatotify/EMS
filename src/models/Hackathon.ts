import { Schema, model, Document, models } from 'mongoose';

export interface IHackathon extends Document {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  maxParticipants?: number;
  prizePool?: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  rules: string[];
  tags: string[];
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const hackathonSchema = new Schema<IHackathon>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  registrationDeadline: { type: Date, required: true },
  maxParticipants: { type: Number },
  prizePool: { type: Number },
  status: { 
    type: String, 
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  rules: [{ type: String }],
  tags: [{ type: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default models.Hackathon || model<IHackathon>('Hackathon', hackathonSchema);

