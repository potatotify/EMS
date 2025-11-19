import { Schema, model, Document, models } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'employee' | 'manager';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['admin', 'employee', 'manager'],
      default: 'employee'
    }
  },
  { timestamps: true }
);

export default models.User || model<IUser>('User', userSchema);
