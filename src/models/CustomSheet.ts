import { Schema, model, Document, models } from 'mongoose';

export interface ICustomSheet extends Document {
  name: string;
  description?: string;
  columns: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    options?: string[]; // For select type
    required?: boolean;
  }[];
  dataSource: {
    type: 'api' | 'static' | 'query';
    endpoint?: string; // For api type
    query?: string; // For query type
    data?: any[]; // For static type
  };
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customSheetSchema = new Schema<ICustomSheet>({
  name: { type: String, required: true },
  description: { type: String },
  columns: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['text', 'number', 'date', 'boolean', 'select'],
      required: true 
    },
    options: [{ type: String }],
    required: { type: Boolean, default: false }
  }],
  dataSource: {
    type: { 
      type: String, 
      enum: ['api', 'static', 'query'],
      required: true 
    },
    endpoint: { type: String },
    query: { type: String },
    data: [{ type: Schema.Types.Mixed }]
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Delete model from cache in development to avoid schema conflicts
if (models.CustomSheet) {
  delete models.CustomSheet;
}

export default model<ICustomSheet>('CustomSheet', customSheetSchema);



