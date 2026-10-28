import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema(
  {
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
      index: true,
    },
    chapterNo: {
      type: Number,
      required: true,
    },
    code: {
      type: String, // e.g. "1A", "0A" (for Part A), "CUSTOM-1"
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    isCustom: {
      type: Boolean,
      default: false,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

topicSchema.index({ chapterId: 1, code: 1 });
topicSchema.index({ chapterNo: 1 });

export const Topic = mongoose.model('Topic', topicSchema);
