import mongoose from 'mongoose';

const FamilySchema = new mongoose.Schema(
  {
    fid: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    superAdminId: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('Family', FamilySchema);
