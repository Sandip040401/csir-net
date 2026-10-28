import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: 'Aspirant',
    },
    examDate: {
      type: String,
      default: '2026-12-19', // Default CSIR NET exam start window
    },
    dailyTarget: {
      type: Number,
      default: 100,
    },
    settings: {
      // Classification thresholds (% accuracy)
      weakThreshold: { type: Number, default: 50 },
      needsWorkThreshold: { type: Number, default: 65 },
      goodThreshold: { type: Number, default: 80 },
      // Exam marking scheme
      partA: {
        totalQuestions: { type: Number, default: 20 },
        maxAttempt: { type: Number, default: 15 },
        marksPerCorrect: { type: Number, default: 2.0 },
        negativeMark: { type: Number, default: 0.5 },
      },
      partB: {
        totalQuestions: { type: Number, default: 50 },
        maxAttempt: { type: Number, default: 35 },
        marksPerCorrect: { type: Number, default: 2.0 },
        negativeMark: { type: Number, default: 0.5 },
      },
      partC: {
        totalQuestions: { type: Number, default: 75 },
        maxAttempt: { type: Number, default: 25 },
        marksPerCorrect: { type: Number, default: 4.0 },
        negativeMark: { type: Number, default: 1.0 },
      },
      theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
