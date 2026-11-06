import mongoose from 'mongoose';

/**
 * A person in the family graph.
 *
 * Note that we intentionally do NOT persist relation labels (sibling, uncle, cousin, etc.)
 * — those are computed on the fly from the {fatherId, motherId, spouseId} edges.
 * The `relation_ship` column from the source Excel is dropped during import for the
 * same reason: it was the spreadsheet author's perspective, not authoritative truth.
 */
const MemberSchema = new mongoose.Schema(
  {
    fid: { type: String, required: true, index: true },
    mid: { type: Number, required: true },

    name: { type: String, required: true, trim: true },

    fatherId: { type: Number, default: null },
    motherId: { type: Number, default: null },
    spouseId: { type: Number, default: null },

    isDeceased: { type: Boolean, default: false },

    mobile: { type: String, default: null, trim: true },
    location: { type: String, default: null, trim: true },
    dob: { type: Date, default: null },
    anniversary: { type: Date, default: null },

    photoUrl: { type: String, default: null, trim: true },
    status: { type: String, default: null },
    gender: { type: String, enum: ['M', 'F', null], default: null },

    email: { type: String, lowercase: true, trim: true, default: null, index: true },
    role: { type: String, enum: ['super_admin', 'admin', null], default: null },
  },
  { timestamps: true }
);

MemberSchema.index({ fid: 1, mid: 1 }, { unique: true });
MemberSchema.index({ fid: 1, fatherId: 1 });
MemberSchema.index({ fid: 1, motherId: 1 });
MemberSchema.index({ fid: 1, spouseId: 1 });

export default mongoose.model('Member', MemberSchema);