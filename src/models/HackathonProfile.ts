import { Schema, model, Document, models } from 'mongoose';

export interface IHackathonProfile extends Document {
  userId: Schema.Types.ObjectId;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  dateOfBirth: Date;
  skills: string[];
  githubProfile?: string;
  portfolioLink?: string;
  isEmployee: boolean; // True if user is an existing employee
  employeeId?: string; // If isEmployee is true, store employee ID
  createdAt: Date;
  updatedAt: Date;
}

const hackathonProfileSchema = new Schema<IHackathonProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  skills: [{ type: String }],
  githubProfile: { type: String },
  portfolioLink: { type: String },
  isEmployee: { type: Boolean, default: false },
  employeeId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default models.HackathonProfile || model<IHackathonProfile>('HackathonProfile', hackathonProfileSchema);

