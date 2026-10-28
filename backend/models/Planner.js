import mongoose from 'mongoose';

const plannerDaySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    chapterIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
    ],
    topicIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
      },
    ],
    notes: {
      type: String,
      default: '',
    },
    targetQuestions: {
      type: Number,
      default: 100,
    },
    isRevision: {
      type: Boolean,
      default: false,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const plannerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    startDate: {
      type: String,
      default: '2026-11-15',
    },
    examDate: {
      type: String,
      default: '2026-12-19',
    },
    days: [plannerDaySchema],
  },
  { timestamps: true }
);

export const Planner = mongoose.model('Planner', plannerSchema);
