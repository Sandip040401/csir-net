import mongoose from 'mongoose';

const sessionEntrySchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true,
    },
    topicCode: {
      type: String,
      default: '',
    },
    topicName: {
      type: String,
      default: '',
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    right: {
      type: Number,
      required: true,
      min: 0,
    },
    wrong: {
      type: Number,
      required: true,
      min: 0,
    },
    bTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    cTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    bRight: {
      type: Number,
      default: null,
      min: 0,
    },
    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },
    mistakeTags: {
      type: [String], // ['concept gap', 'silly mistake', 'time', 'guess']
      default: [],
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    slot: {
      type: String,
      enum: ['morning', 'night', 'other'],
      default: 'morning',
    },
    kind: {
      type: String,
      enum: ['practice', 'mock'],
      default: 'practice',
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
      index: true,
    },
    timeTakenMin: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    entries: [sessionEntrySchema],
  },
  { timestamps: true }
);

// Compound indexes for fast querying & upserting
sessionSchema.index({ userId: 1, date: 1, slot: 1, kind: 1, chapterId: 1 }, { unique: true });
sessionSchema.index({ userId: 1, date: 1 });
sessionSchema.index({ userId: 1, chapterId: 1 });
sessionSchema.index({ userId: 1, 'entries.topicId': 1 });

export const Session = mongoose.model('Session', sessionSchema);
