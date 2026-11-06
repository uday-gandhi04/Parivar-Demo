import mongoose from 'mongoose';

const BusinessSchema = new mongoose.Schema(
  {
    fid: { type: String, required: true, index: true },
    mid: { type: Number, required: true },
    bid: { type: String, required: true, trim: true },

    name: { type: String, default: null, trim: true },
    city: { type: String, default: null, trim: true },
    role: { type: String, default: null, trim: true },
    description: { type: String, default: null, trim: true },
    category: { type: String, default: null, trim: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BusinessSchema.index({ fid: 1, mid: 1 });
BusinessSchema.index({ fid: 1, mid: 1, bid: 1 }, { unique: true });

export default mongoose.model('Business', BusinessSchema);
