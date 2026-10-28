import { z } from 'zod';
import { Session } from '../models/Session.js';
import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';

const sessionEntryZod = z.object({
  topicId: z.string(),
  topicCode: z.string().optional(),
  topicName: z.string().optional(),
  total: z.number().int().min(0),
  right: z.number().int().min(0),
  wrong: z.number().int().min(0),
  bTotal: z.number().int().min(0).default(0),
  cTotal: z.number().int().min(0).default(0),
  bRight: z.number().int().min(0).nullable().optional(),
  skipped: z.number().int().min(0).default(0),
  mistakeTags: z.array(z.string()).default([]),
});

const upsertSessionZod = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  slot: z.enum(['morning', 'night', 'other']),
  kind: z.enum(['practice', 'mock']),
  chapterId: z.string(),
  timeTakenMin: z.number().nullable().optional(),
  notes: z.string().optional().default(''),
  entries: z.array(sessionEntryZod),
});

// GET /api/v1/sessions?from&to&chapterId&kind
export const getSessions = async (req, res, next) => {
  try {
    const { from, to, chapterId, kind } = req.query;
    const filter = { userId: req.user._id };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    if (chapterId) filter.chapterId = chapterId;
    if (kind) filter.kind = kind;

    const sessions = await Session.find(filter)
      .populate('chapterId', 'no name isPartA weight')
      .populate('entries.topicId', 'code name description')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/sessions/by-date/:date
export const getSessionsByDate = async (req, res, next) => {
  try {
    const { date } = req.params;
    const sessions = await Session.find({ userId: req.user._id, date })
      .populate('chapterId', 'no name isPartA weight')
      .populate('entries.topicId', 'code name description')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/sessions (Upsert session)
export const upsertSession = async (req, res, next) => {
  try {
    const data = upsertSessionZod.parse(req.body);

    const chapter = await Chapter.findById(data.chapterId);
    if (!chapter) {
      return res.status(404).json({ success: false, error: 'Chapter not found' });
    }

    // If entries are empty, delete the existing session if any exists
    if (!data.entries || data.entries.length === 0) {
      await Session.findOneAndDelete({
        userId: req.user._id,
        date: data.date,
        slot: data.slot,
        kind: data.kind,
        chapterId: data.chapterId,
      });
      return res.json({ success: true, message: 'Session deleted because entries were empty', data: null });
    }

    // Populate topic details for entries if missing
    const enrichedEntries = await Promise.all(
      data.entries.map(async (entry) => {
        let topicCode = entry.topicCode;
        let topicName = entry.topicName;
        if (!topicCode || !topicName) {
          const t = await Topic.findById(entry.topicId).lean();
          if (t) {
            topicCode = t.code;
            topicName = t.name;
          }
        }

        // Invariant 2: if Part A, bTotal = cTotal = 0
        let bTotal = entry.bTotal || 0;
        let cTotal = entry.cTotal || 0;
        if (chapter.isPartA) {
          bTotal = 0;
          cTotal = 0;
        } else {
          // If not Part A and both 0, default to Part B + Part C split = total
          if (bTotal + cTotal !== total && (bTotal === 0 && cTotal === 0)) {
            bTotal = total; // Default assume Part B style if unspecified
          }
        }

        return {
          ...entry,
          topicCode,
          topicName,
          bTotal,
          cTotal,
        };
      })
    );

    // Upsert session matching (userId, date, slot, kind, chapterId)
    const session = await Session.findOneAndUpdate(
      {
        userId: req.user._id,
        date: data.date,
        slot: data.slot,
        kind: data.kind,
        chapterId: data.chapterId,
      },
      {
        userId: req.user._id,
        date: data.date,
        slot: data.slot,
        kind: data.kind,
        chapterId: data.chapterId,
        timeTakenMin: data.timeTakenMin || null,
        notes: data.notes || '',
        entries: enrichedEntries,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate('chapterId', 'no name isPartA weight')
      .populate('entries.topicId', 'code name description');

    return res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/sessions/:id
export const deleteSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findOneAndDelete({ _id: id, userId: req.user._id });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    return res.json({ success: true, message: 'Session deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/sessions/recent-topics/:chapterId
export const getRecentTopicsForChapter = async (req, res, next) => {
  try {
    const { chapterId } = req.params;
    const lastSession = await Session.findOne({
      userId: req.user._id,
      chapterId,
    })
      .sort({ date: -1, createdAt: -1 })
      .populate('entries.topicId', 'code name description')
      .lean();

    if (!lastSession) {
      return res.json({ success: true, data: [] });
    }

    const topics = lastSession.entries.map((e) => ({
      topicId: e.topicId?._id || e.topicId,
      code: e.topicCode || e.topicId?.code,
      name: e.topicName || e.topicId?.name,
      description: e.topicId?.description || '',
    }));

    return res.json({ success: true, data: topics });
  } catch (err) {
    next(err);
  }
};
