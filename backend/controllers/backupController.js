import { Session } from '../models/Session.js';
import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';

// GET /api/v1/export?format=json|csv
export const exportData = async (req, res, next) => {
  try {
    const user = req.user;
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const sessions = await Session.find({ userId: user._id })
      .populate('chapterId', 'no name isPartA')
      .populate('entries.topicId', 'code name')
      .sort({ date: 1, createdAt: 1 })
      .lean();

    if (format === 'csv') {
      const rows = [];
      rows.push([
        'Date',
        'Slot',
        'Kind',
        'ChapterNo',
        'ChapterName',
        'TopicCode',
        'TopicName',
        'Total',
        'Right',
        'Wrong',
        'Skipped',
        'PartBTotal',
        'PartCTotal',
        'PartBRight',
        'MistakeTags',
        'TimeTakenMin',
        'Notes',
      ]);

      sessions.forEach((s) => {
        const chNo = s.chapterId?.no ?? '';
        const chName = (s.chapterId?.name || '').replace(/"/g, '""');
        const notes = (s.notes || '').replace(/"/g, '""');

        s.entries.forEach((e) => {
          const tCode = e.topicCode || e.topicId?.code || '';
          const tName = (e.topicName || e.topicId?.name || '').replace(/"/g, '""');
          const tags = (e.mistakeTags || []).join('; ');

          rows.push([
            s.date,
            s.slot,
            s.kind,
            chNo,
            `"${chName}"`,
            tCode,
            `"${tName}"`,
            e.total,
            e.right,
            e.wrong,
            e.skipped || 0,
            e.bTotal || 0,
            e.cTotal || 0,
            e.bRight !== null && e.bRight !== undefined ? e.bRight : '',
            `"${tags}"`,
            s.timeTakenMin || '',
            `"${notes}"`,
          ]);
        });
      });

      const csvContent = rows.map((r) => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="net_tracker_backup_${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    }

    // JSON export
    const exportPayload = {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        name: user.name,
        examDate: user.examDate,
        dailyTarget: user.dailyTarget,
        settings: user.settings,
      },
      sessions,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="net_tracker_backup_${new Date().toISOString().split('T')[0]}.json"`);
    return res.json(exportPayload);
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/import
export const importData = async (req, res, next) => {
  try {
    const user = req.user;
    const { sessions, clearExisting } = req.body;

    if (!Array.isArray(sessions)) {
      return res.status(400).json({ success: false, error: 'Expected an array of sessions in payload.' });
    }

    if (clearExisting) {
      await Session.deleteMany({ userId: user._id });
    }

    let importedCount = 0;
    for (const item of sessions) {
      if (!item.date || !item.chapterId) continue;

      // Find or verify chapter
      let chapter = null;
      if (item.chapterId.no !== undefined) {
        chapter = await Chapter.findOne({ no: item.chapterId.no });
      } else {
        chapter = await Chapter.findById(item.chapterId);
      }

      if (!chapter) continue;

      // Resolve topic IDs
      const validEntries = [];
      for (const e of item.entries || []) {
        let topic = null;
        if (e.topicCode) {
          topic = await Topic.findOne({ chapterId: chapter._id, code: e.topicCode });
        } else if (e.topicId) {
          topic = await Topic.findById(e.topicId);
        }

        if (topic) {
          validEntries.push({
            topicId: topic._id,
            topicCode: topic.code,
            topicName: topic.name,
            total: e.total || 0,
            right: e.right || 0,
            wrong: e.wrong || 0,
            bTotal: e.bTotal || 0,
            cTotal: e.cTotal || 0,
            bRight: e.bRight ?? null,
            skipped: e.skipped || 0,
            mistakeTags: e.mistakeTags || [],
          });
        }
      }

      await Session.findOneAndUpdate(
        {
          userId: user._id,
          date: item.date,
          slot: item.slot || 'morning',
          kind: item.kind || 'practice',
          chapterId: chapter._id,
        },
        {
          userId: user._id,
          date: item.date,
          slot: item.slot || 'morning',
          kind: item.kind || 'practice',
          chapterId: chapter._id,
          timeTakenMin: item.timeTakenMin || null,
          notes: item.notes || '',
          entries: validEntries,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      importedCount++;
    }

    return res.json({ success: true, message: `Successfully imported ${importedCount} sessions.` });
  } catch (err) {
    next(err);
  }
};
