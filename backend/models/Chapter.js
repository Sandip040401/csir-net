import mongoose from 'mongoose';

const chapterSchema = new mongoose.Schema(
  {
    no: {
      type: Number,
      required: true,
      unique: true, // 0 for Part A, 1-14 for standard chapters
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isPartA: {
      type: Boolean,
      default: false,
    },
    weight: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    order: {
      type: Number,
      default: 0,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

chapterSchema.index({ order: 1 });
chapterSchema.index({ no: 1 });

export const Chapter = mongoose.model('Chapter', chapterSchema);
