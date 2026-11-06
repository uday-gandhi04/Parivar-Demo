import mongoose from 'mongoose';

const EducationSchema = new mongoose.Schema(
  {
    fid: { type: String, required: true, index: true },
    mid: { type: Number, required: true },
    eid: { type: String, required: true, trim: true },

    degreeOrCourse: { type: String, default: null, trim: true },
    year: { type: String, default: null, trim: true },
    institution: { type: String, default: null, trim: true },
    field: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

EducationSchema.index({ fid: 1, mid: 1 });
EducationSchema.index({ fid: 1, mid: 1, eid: 1 }, { unique: true });

export default mongoose.model('Education', EducationSchema);
