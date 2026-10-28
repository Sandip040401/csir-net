import { Planner } from '../models/Planner.js';
import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';
import { Session } from '../models/Session.js';

// GET /api/v1/planner
export const getPlanner = async (req, res, next) => {
  try {
    const user = req.user;
    let planner = await Planner.findOne({ userId: user._id })
      .populate('days.chapterIds', 'no name weight isPartA')
      .populate('days.topicIds', 'code name chapterNo');

    if (!planner) {
      // Auto-generate if not yet generated
      return generatePlannerSchedule(req, res, next);
    }

    return res.json({ success: true, data: planner });
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/planner (Update days)
export const updatePlanner = async (req, res, next) => {
  try {
    const user = req.user;
    const { days, startDate, examDate } = req.body;

    let planner = await Planner.findOne({ userId: user._id });
    if (!planner) {
      planner = new Planner({ userId: user._id, days: [] });
    }

    if (days !== undefined) planner.days = days;
    if (startDate) planner.startDate = startDate;
    if (examDate) planner.examDate = examDate;

    await planner.save();

    planner = await Planner.findById(planner._id)
      .populate('days.chapterIds', 'no name weight isPartA')
      .populate('days.topicIds', 'code name chapterNo');

    return res.json({ success: true, data: planner });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/planner/generate
export const generatePlannerSchedule = async (req, res, next) => {
  try {
    const user = req.user;
    const { fromToday } = req.body || {};

    const todayStr = new Date().toISOString().split('T')[0];
    const defaultStart = fromToday ? todayStr : (user.plannerStartDate || '2026-11-15');
    const examDateStr = user.examDate || '2026-12-19';

    const [chapters, sessions] = await Promise.all([
      Chapter.find({ hidden: { $ne: true } }).sort({ weight: -1, order: 1 }),
      Session.find({ userId: user._id }).lean(),
    ]);

    // Calculate chapter weakness from sessions
    const chapterPerf = new Map();
    chapters.forEach((c) => {
      chapterPerf.set(c._id.toString(), {
        chapter: c,
        attempts: 0,
        right: 0,
      });
    });

    sessions.forEach((s) => {
      const cid = s.chapterId?.toString();
      const p = chapterPerf.get(cid);
      if (p) {
        s.entries.forEach((e) => {
          p.attempts += e.total;
          p.right += e.right;
        });
      }
    });

    // Score chapters: higher score = needs more study days
    // Score = weight * (1.2 - accuracy)
    const chapterList = chapters.map((c) => {
      const p = chapterPerf.get(c._id.toString());
      const acc = p && p.attempts > 0 ? p.right / p.attempts : 0.4; // Untested gets ~40% assumed
      const score = (c.weight || 3) * (1.2 - acc);
      return { chapter: c, score };
    });

    // Sort chapters by priority score descending
    chapterList.sort((a, b) => b.score - a.score);

    // Build day range array
    const start = new Date(defaultStart);
    const end = new Date(examDateStr);
    const msInDay = 1000 * 60 * 60 * 24;

    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msInDay));
    const revisionDaysCount = Math.min(5, Math.max(2, Math.floor(totalDays * 0.15)));
    const studyDaysCount = Math.max(1, totalDays - revisionDaysCount);

    const generatedDays = [];
    let curDate = new Date(start);

    // Distribute chapters across study days
    for (let i = 0; i < studyDaysCount; i++) {
      const dateStr = curDate.toISOString().split('T')[0];
      const chIndex = i % chapterList.length;
      const assignedChapter = chapterList[chIndex].chapter;

      // Also pair Part A every 3rd day
      const partAChapter = chapters.find((c) => c.isPartA);
      const chapterIds = [assignedChapter._id];
      if (i % 3 === 0 && partAChapter && !assignedChapter.isPartA) {
        chapterIds.push(partAChapter._id);
      }

      generatedDays.push({
        date: dateStr,
        chapterIds,
        topicIds: [],
        notes: `Focus on ${assignedChapter.name}${i % 3 === 0 ? ' + Part A (20 min)' : ''}`,
        targetQuestions: user.dailyTarget || 100,
        isRevision: false,
        completed: false,
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    // Final Revision window (~5 days)
    const topHighWeightChapters = chapters
      .filter((c) => (c.weight || 3) >= 4)
      .map((c) => c._id);

    for (let r = 0; r < revisionDaysCount; r++) {
      const dateStr = curDate.toISOString().split('T')[0];
      generatedDays.push({
        date: dateStr,
        chapterIds: topHighWeightChapters.slice(0, 3),
        topicIds: [],
        notes: `Full Revision & Formula Recall (Days -${revisionDaysCount - r} to Exam)`,
        targetQuestions: user.dailyTarget || 100,
        isRevision: true,
        completed: false,
      });
      curDate.setDate(curDate.getDate() + 1);
    }

    let planner = await Planner.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        startDate: defaultStart,
        examDate: examDateStr,
        days: generatedDays,
      },
      { upsert: true, new: true }
    )
      .populate('days.chapterIds', 'no name weight isPartA')
      .populate('days.topicIds', 'code name chapterNo');

    return res.json({ success: true, data: planner });
  } catch (err) {
    next(err);
  }
};
