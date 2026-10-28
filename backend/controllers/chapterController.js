import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';
import { Session } from '../models/Session.js';
import { z } from 'zod';

const chapterCreateSchema = z.object({
  no: z.number().int(),
  name: z.string().min(1),
  isPartA: z.boolean().optional(),
  weight: z.number().min(1).max(5).optional(),
});

// GET /api/v1/chapters
export const getChapters = async (req, res, next) => {
  try {
    const chapters = await Chapter.find().sort({ order: 1, no: 1 }).lean();
    return res.json({ success: true, count: chapters.length, data: chapters });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/chapters/:id/topics
export const getChapterTopics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const topics = await Topic.find({ chapterId: id, hidden: { $ne: true } })
      .sort({ order: 1, code: 1 })
      .lean();
    return res.json({ success: true, count: topics.length, data: topics });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/chapters/all-topics
export const getAllTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find().sort({ chapterNo: 1, order: 1, code: 1 }).lean();
    return res.json({ success: true, count: topics.length, data: topics });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/chapters/:chapterId/topics
// Inline add custom topic endpoint with duplicate check, auto-code (e.g. 4X1), and order calculation
export const addCustomTopicToChapter = async (req, res, next) => {
  try {
    const { chapterId } = req.params;
    const rawName = req.body?.name;

    if (!rawName || typeof rawName !== 'string') {
      return res.status(400).json({ success: false, error: 'Topic name is required.' });
    }

    const trimmedName = rawName.trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: 'Topic name cannot be empty.' });
    }
    if (trimmedName.length > 100) {
      return res.status(400).json({ success: false, error: 'Topic name cannot exceed 100 characters.' });
    }

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found.' });
    }

    // Case-insensitive duplicate check within the chapter
    const existing = await Topic.findOne({
      chapterId: chapter._id,
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });

    if (existing) {
      // If hidden, unhide it so the student can use it immediately
      if (existing.hidden) {
        existing.hidden = false;
        await existing.save();
      }
      return res.json({ success: true, data: existing, isDuplicate: true });
    }

    // Auto-generate code like "4X1" or "AX1" for custom topics
    const prefix = chapter.isPartA ? 'A' : `${chapter.no}`;
    const customCount = await Topic.countDocuments({ chapterId: chapter._id, isCustom: true });
    const code = `${prefix}X${customCount + 1}`;

    // Calculate order: max(order) + 1
    const lastTopic = await Topic.findOne({ chapterId: chapter._id }).sort({ order: -1 }).lean();
    const nextOrder = (lastTopic?.order || 0) + 1;

    const newTopic = await Topic.create({
      chapterId: chapter._id,
      chapterNo: chapter.no,
      code,
      name: trimmedName,
      description: req.body?.description || 'Custom student topic',
      isCustom: true,
      order: nextOrder,
      hidden: false,
    });

    return res.status(201).json({ success: true, data: newTopic, isDuplicate: false });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/chapters (Custom Chapter)
export const createChapter = async (req, res, next) => {
  try {
    const data = chapterCreateSchema.parse(req.body);
    const existing = await Chapter.findOne({ no: data.no });
    if (existing) {
      return res.status(400).json({ success: false, error: `Chapter with number ${data.no} already exists.` });
    }
    const chapter = await Chapter.create({
      ...data,
      order: data.no,
    });
    return res.status(201).json({ success: true, data: chapter });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/chapters/:id
export const updateChapter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, weight, hidden, order } = req.body;
    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }
    if (name !== undefined) chapter.name = name;
    if (weight !== undefined) chapter.weight = weight;
    if (hidden !== undefined) chapter.hidden = hidden;
    if (order !== undefined) chapter.order = order;

    await chapter.save();
    return res.json({ success: true, data: chapter });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/chapters/:id
export const deleteChapter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }
    await Topic.deleteMany({ chapterId: id });
    await Chapter.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Chapter and associated topics removed.' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/chapters/topics/:id
export const updateTopic = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, hidden, order, code } = req.body;
    const topic = await Topic.findById(id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found.' });
    }

    if (name !== undefined) topic.name = name.trim();
    if (description !== undefined) topic.description = description;
    if (hidden !== undefined) topic.hidden = hidden;
    if (order !== undefined) topic.order = order;
    if (code !== undefined) topic.code = code;

    await topic.save();
    return res.json({ success: true, data: topic });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/chapters/topics/:id
// If topic has logged session data, soft-delete (hidden=true) to preserve history
export const deleteTopic = async (req, res, next) => {
  try {
    const { id } = req.params;
    const topic = await Topic.findById(id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found.' });
    }

    // Built-in topics cannot be permanently deleted, only hidden
    if (!topic.isCustom) {
      topic.hidden = true;
      await topic.save();
      return res.json({ success: true, message: 'Built-in topic hidden.' });
    }

    // Check if custom topic has logged entries
    const sessionCount = await Session.countDocuments({ 'entries.topicId': topic._id });
    if (sessionCount > 0) {
      topic.hidden = true;
      await topic.save();
      return res.json({ success: true, message: 'Topic has logged history; safely hidden.', softDeleted: true });
    }

    // If zero sessions logged, delete permanently
    await Topic.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Topic permanently deleted.', softDeleted: false });
  } catch (err) {
    next(err);
  }
};
