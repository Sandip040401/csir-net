import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';
import { z } from 'zod';

const chapterCreateSchema = z.object({
  no: z.number().int(),
  name: z.string().min(1),
  isPartA: z.boolean().optional(),
  weight: z.number().min(1).max(5).optional(),
});

const topicCreateSchema = z.object({
  chapterId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
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
    const topics = await Topic.find({ chapterId: id }).sort({ order: 1, code: 1 }).lean();
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
    // Delete chapter and its topics
    await Topic.deleteMany({ chapterId: id });
    await Chapter.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Chapter and associated topics removed.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/chapters/topics (Custom Topic)
export const createTopic = async (req, res, next) => {
  try {
    const data = topicCreateSchema.parse(req.body);
    const chapter = await Chapter.findById(data.chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, error: 'Associated chapter not found.' });
    }

    const topicCount = await Topic.countDocuments({ chapterId: chapter._id });
    const code = data.code || `${chapter.no}-C${topicCount + 1}`;

    const topic = await Topic.create({
      chapterId: chapter._id,
      chapterNo: chapter.no,
      code,
      name: data.name,
      description: data.description || '',
      isCustom: true,
      order: topicCount + 1,
    });

    return res.status(201).json({ success: true, data: topic });
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

    if (name !== undefined) topic.name = name;
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
export const deleteTopic = async (req, res, next) => {
  try {
    const { id } = req.params;
    const topic = await Topic.findById(id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found.' });
    }
    await Topic.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Topic deleted.' });
  } catch (err) {
    next(err);
  }
};
