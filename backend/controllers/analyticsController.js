import { Session } from '../models/Session.js';
import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';
import {
  wilsonScoreLowerBound,
  bayesianSmoothedAccuracy,
  computeRecencyWeight,
  classifyTopic,
  computePriorityScore,
  calculateEstimatedExamMarks,
} from '../config/analyticsEngine.js';

// Helper: build match filter from query parameters
const buildFilter = (userId, query) => {
  const filter = { userId };
  const { from, to, chapterId, kind } = query;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }

  if (chapterId) {
    filter.chapterId = chapterId;
  }
  if (kind && kind !== 'both') {
    filter.kind = kind;
  }
  return filter;
};

// GET /api/v1/analytics/overview
export const getOverviewKPIs = async (req, res, next) => {
  try {
    const user = req.user;
    const filter = buildFilter(user._id, req.query);
    const sessions = await Session.find(filter).populate('chapterId').lean();

    const todayStr = new Date().toISOString().split('T')[0];
    const examDateStr = user.examDate || '2026-12-19';

    // Days to exam countdown
    const msInDay = 1000 * 60 * 60 * 24;
    const daysToExam = Math.max(
      0,
      Math.ceil((new Date(examDateStr).getTime() - new Date(todayStr).getTime()) / msInDay)
    );

    // Calculate totals
    let totalQuestions = 0;
    let totalRight = 0;
    let totalWrong = 0;
    let totalSkipped = 0;
    let todayQuestions = 0;

    let partAAttempts = 0, partARight = 0, partAWrong = 0;
    let partBAttempts = 0, partBRight = 0, partBWrong = 0;
    let partCAttempts = 0, partCRight = 0, partCWrong = 0;

    // Track active dates for streak and trend
    const dailyVolumeMap = new Map();

    // Last 7 days vs previous 7 days accuracy comparison
    const nowTime = new Date(todayStr).getTime();
    let last7Right = 0, last7Attempts = 0;
    let prev7Right = 0, prev7Attempts = 0;

    sessions.forEach((s) => {
      const isPartA = s.chapterId?.isPartA;
      let sessionTotal = 0;

      s.entries.forEach((e) => {
        sessionTotal += e.total;
        totalQuestions += e.total;
        totalRight += e.right;
        totalWrong += e.wrong;
        totalSkipped += (e.skipped || 0);

        if (s.date === todayStr) {
          todayQuestions += e.total;
        }

        // Part breakdowns
        if (isPartA) {
          partAAttempts += e.total;
          partARight += e.right;
          partAWrong += e.wrong;
        } else {
          const bTot = e.bTotal || 0;
          const cTot = e.cTotal || 0;
          const bR = e.bRight !== null && e.bRight !== undefined ? e.bRight : Math.round(e.right * (bTot / Math.max(1, e.total)));
          const cR = Math.max(0, e.right - bR);

          partBAttempts += bTot;
          partBRight += bR;
          partBWrong += Math.max(0, bTot - bR);

          partCAttempts += cTot;
          partCRight += cR;
          partCWrong += Math.max(0, cTot - cR);
        }

        // 7-day windows
        const sTime = new Date(s.date).getTime();
        const diffDays = (nowTime - sTime) / msInDay;
        if (diffDays >= 0 && diffDays < 7) {
          last7Right += e.right;
          last7Attempts += e.total;
        } else if (diffDays >= 7 && diffDays < 14) {
          prev7Right += e.right;
          prev7Attempts += e.total;
        }
      });

      dailyVolumeMap.set(s.date, (dailyVolumeMap.get(s.date) || 0) + sessionTotal);
    });

    const overallAccuracy = totalQuestions > 0 ? Math.round((totalRight / totalQuestions) * 1000) / 10 : 0;
    const last7Accuracy = last7Attempts > 0 ? Math.round((last7Right / last7Attempts) * 1000) / 10 : 0;
    const prev7Accuracy = prev7Attempts > 0 ? Math.round((prev7Right / prev7Attempts) * 1000) / 10 : 0;
    const accuracyTrend = Math.round((last7Accuracy - prev7Accuracy) * 10) / 10;

    // Streak calculation (consecutive days ending yesterday or today)
    const sortedDates = Array.from(dailyVolumeMap.keys()).sort().reverse();
    let currentStreak = 0;
    if (sortedDates.length > 0) {
      let checkDate = new Date(todayStr);
      // If no entry today, check if yesterday had entry
      const hasToday = dailyVolumeMap.has(todayStr);
      if (!hasToday) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (dailyVolumeMap.has(dStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Average questions / day calculation
    const activeDaysCount = dailyVolumeMap.size;
    const avgQuestionsPerDay = activeDaysCount > 0 ? Math.round(totalQuestions / activeDaysCount) : 0;
    const dailyTarget = user.dailyTarget || 100;
    const expectedPaceTotal = totalQuestions + Math.round(avgQuestionsPerDay * daysToExam);

    // Syllabus Coverage
    const allTopics = await Topic.find({ hidden: { $ne: true } }).lean();
    const totalTopicsCount = allTopics.length;

    // Aggregate attempts per topic
    const topicAttemptsMap = new Map();
    sessions.forEach((s) => {
      s.entries.forEach((e) => {
        const tid = e.topicId?._id?.toString() || e.topicId?.toString();
        if (tid) {
          topicAttemptsMap.set(tid, (topicAttemptsMap.get(tid) || 0) + e.total);
        }
      });
    });

    let attemptedTopicsCount = 0;
    let topicsWith20Plus = 0;
    allTopics.forEach((t) => {
      const att = topicAttemptsMap.get(t._id.toString()) || 0;
      if (att > 0) attemptedTopicsCount++;
      if (att >= 20) topicsWith20Plus++;
    });

    const untouchedTopics = Math.max(0, totalTopicsCount - attemptedTopicsCount);
    const syllabusCoveragePct = totalTopicsCount > 0 ? Math.round((attemptedTopicsCount / totalTopicsCount) * 1000) / 10 : 0;
    const matureCoveragePct = totalTopicsCount > 0 ? Math.round((topicsWith20Plus / totalTopicsCount) * 1000) / 10 : 0;

    // Projected Marks Calculator
    const projectedMarks = calculateEstimatedExamMarks({
      partAStats: { attempts: partAAttempts, right: partARight, wrong: partAWrong },
      partBStats: { attempts: partBAttempts, right: partBRight, wrong: partBWrong },
      partCStats: { attempts: partCAttempts, right: partCRight, wrong: partCWrong },
      settings: user.settings,
    });

    return res.json({
      success: true,
      data: {
        countdown: {
          examDate: examDateStr,
          daysToExam,
        },
        volume: {
          totalQuestions,
          todayQuestions,
          dailyTarget,
          avgQuestionsPerDay,
          expectedPaceTotal,
          activeDaysCount,
          currentStreak,
        },
        accuracy: {
          overall: overallAccuracy,
          last7Days: last7Accuracy,
          prev7Days: prev7Accuracy,
          trend: accuracyTrend,
        },
        projectedMarks,
        coverage: {
          totalTopicsCount,
          attemptedTopicsCount,
          topicsWith20Plus,
          untouchedTopics,
          syllabusCoveragePct,
          matureCoveragePct,
        },
        partsBreakdown: {
          partA: { attempts: partAAttempts, right: partARight, wrong: partAWrong, accuracy: partAAttempts > 0 ? Math.round((partARight / partAAttempts) * 100) : 0 },
          partB: { attempts: partBAttempts, right: partBRight, wrong: partBWrong, accuracy: partBAttempts > 0 ? Math.round((partBRight / partBAttempts) * 100) : 0 },
          partC: { attempts: partCAttempts, right: partCRight, wrong: partCWrong, accuracy: partCAttempts > 0 ? Math.round((partCRight / partCAttempts) * 100) : 0 },
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/analytics/topics (Weakness engine)
export const getTopicAnalytics = async (req, res, next) => {
  try {
    const user = req.user;
    const filter = buildFilter(user._id, req.query);
    const sessions = await Session.find(filter).populate('chapterId').lean();
    const allTopics = await Topic.find({ hidden: { $ne: true } }).populate('chapterId').lean();

    const todayStr = new Date().toISOString().split('T')[0];
    const msInDay = 1000 * 60 * 60 * 24;

    // Map each topic's aggregates
    const topicStats = new Map();

    // Initialize all syllabus topics so untouched ones are visible
    allTopics.forEach((t) => {
      topicStats.set(t._id.toString(), {
        topicId: t._id,
        code: t.code,
        name: t.name,
        description: t.description || '',
        chapterNo: t.chapterNo,
        chapterName: t.chapterId?.name || `Chapter ${t.chapterNo}`,
        chapterWeight: t.chapterId?.weight || 3,
        isPartA: t.chapterId?.isPartA || false,
        attempts: 0,
        right: 0,
        wrong: 0,
        skipped: 0,
        bTotal: 0,
        cTotal: 0,
        recentWeightTotal: 0,
        recentWeightSum: 0,
        lastPracticedDate: null,
        daysSincePracticed: null,
        mistakeTags: {
          'concept gap': 0,
          'silly mistake': 0,
          'time': 0,
          'guess': 0,
        },
      });
    });

    sessions.forEach((s) => {
      const sDate = s.date;
      const recencyW = computeRecencyWeight(sDate, todayStr, 10);

      s.entries.forEach((e) => {
        const tid = e.topicId?._id?.toString() || e.topicId?.toString();
        let stat = topicStats.get(tid);

        if (!stat) {
          // In case of custom topic not in initial query
          stat = {
            topicId: tid,
            code: e.topicCode || 'T',
            name: e.topicName || 'Custom Topic',
            description: '',
            chapterNo: s.chapterId?.no ?? 1,
            chapterName: s.chapterId?.name || '',
            chapterWeight: s.chapterId?.weight || 3,
            isPartA: s.chapterId?.isPartA || false,
            attempts: 0,
            right: 0,
            wrong: 0,
            skipped: 0,
            bTotal: 0,
            cTotal: 0,
            recentWeightTotal: 0,
            recentWeightSum: 0,
            lastPracticedDate: null,
            daysSincePracticed: null,
            mistakeTags: { 'concept gap': 0, 'silly mistake': 0, 'time': 0, 'guess': 0 },
          };
          topicStats.set(tid, stat);
        }

        stat.attempts += e.total;
        stat.right += e.right;
        stat.wrong += e.wrong;
        stat.skipped += (e.skipped || 0);
        stat.bTotal += (e.bTotal || 0);
        stat.cTotal += (e.cTotal || 0);

        // Exponential decay accuracy weight
        stat.recentWeightSum += (e.right * recencyW);
        stat.recentWeightTotal += (e.total * recencyW);

        // Last practice date
        if (!stat.lastPracticedDate || sDate > stat.lastPracticedDate) {
          stat.lastPracticedDate = sDate;
        }

        // Mistake tags tally
        if (e.mistakeTags && Array.isArray(e.mistakeTags)) {
          e.mistakeTags.forEach((tag) => {
            if (stat.mistakeTags[tag] !== undefined) {
              stat.mistakeTags[tag]++;
            }
          });
        }
      });
    });

    // Compute derived metrics
    const results = Array.from(topicStats.values()).map((st) => {
      const accuracy = st.attempts > 0 ? Math.round((st.right / st.attempts) * 1000) / 10 : 0;
      const smoothedAccuracy = bayesianSmoothedAccuracy(st.right, st.attempts);
      const wilsonBound = wilsonScoreLowerBound(st.right, st.attempts);
      const recencyAccuracy = st.recentWeightTotal > 0 ? Math.round((st.recentWeightSum / st.recentWeightTotal) * 1000) / 10 : accuracy;

      let daysSincePracticed = null;
      if (st.lastPracticedDate) {
        daysSincePracticed = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(st.lastPracticedDate).getTime()) / msInDay));
      }
      st.daysSincePracticed = daysSincePracticed;

      const classification = classifyTopic(accuracy, st.attempts, user.settings);
      const priorityScore = computePriorityScore({
        smoothedAccuracy,
        daysSincePracticed,
        chapterWeight: st.chapterWeight,
        attempts: st.attempts,
      });

      return {
        ...st,
        accuracy,
        smoothedAccuracy,
        wilsonBound,
        recencyAccuracy,
        classification,
        priorityScore,
      };
    });

    // Top 10 topics to fix now (highest priority score)
    const sortedByPriority = [...results].sort((a, b) => b.priorityScore - a.priorityScore);
    const top10ToFix = sortedByPriority.slice(0, 10);

    return res.json({
      success: true,
      count: results.length,
      data: results,
      top10ToFix,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/analytics/chapters
export const getChapterAnalytics = async (req, res, next) => {
  try {
    const user = req.user;
    const filter = buildFilter(user._id, req.query);
    const chapters = await Chapter.find({ hidden: { $ne: true } }).sort({ order: 1, no: 1 }).lean();
    const sessions = await Session.find(filter).lean();

    const chapterStats = new Map();
    chapters.forEach((c) => {
      chapterStats.set(c._id.toString(), {
        chapterId: c._id,
        no: c.no,
        name: c.name,
        isPartA: c.isPartA,
        weight: c.weight,
        attempts: 0,
        right: 0,
        wrong: 0,
        bAttempts: 0,
        bRight: 0,
        cAttempts: 0,
        cRight: 0,
        practiceAttempts: 0,
        practiceRight: 0,
        mockAttempts: 0,
        mockRight: 0,
        topicsCoveredCount: new Set(),
      });
    });

    sessions.forEach((s) => {
      const cid = s.chapterId?.toString();
      const stat = chapterStats.get(cid);
      if (!stat) return;

      const isMock = s.kind === 'mock';

      s.entries.forEach((e) => {
        stat.attempts += e.total;
        stat.right += e.right;
        stat.wrong += e.wrong;
        if (e.topicId) {
          stat.topicsCoveredCount.add(e.topicId.toString());
        }

        if (isMock) {
          stat.mockAttempts += e.total;
          stat.mockRight += e.right;
        } else {
          stat.practiceAttempts += e.total;
          stat.practiceRight += e.right;
        }

        if (!stat.isPartA) {
          const bTot = e.bTotal || 0;
          const cTot = e.cTotal || 0;
          const bR = e.bRight !== null && e.bRight !== undefined ? e.bRight : Math.round(e.right * (bTot / Math.max(1, e.total)));
          const cR = Math.max(0, e.right - bR);

          stat.bAttempts += bTot;
          stat.bRight += bR;
          stat.cAttempts += cTot;
          stat.cRight += cR;
        }
      });
    });

    const data = Array.from(chapterStats.values()).map((cs) => {
      const accuracy = cs.attempts > 0 ? Math.round((cs.right / cs.attempts) * 1000) / 10 : 0;
      const bAccuracy = cs.bAttempts > 0 ? Math.round((cs.bRight / cs.bAttempts) * 1000) / 10 : 0;
      const cAccuracy = cs.cAttempts > 0 ? Math.round((cs.cRight / cs.cAttempts) * 1000) / 10 : 0;
      const practiceAccuracy = cs.practiceAttempts > 0 ? Math.round((cs.practiceRight / cs.practiceAttempts) * 1000) / 10 : 0;
      const mockAccuracy = cs.mockAttempts > 0 ? Math.round((cs.mockRight / cs.mockAttempts) * 1000) / 10 : 0;
      const mockGap = practiceAccuracy > 0 && mockAccuracy > 0 ? Math.round((practiceAccuracy - mockAccuracy) * 10) / 10 : 0;

      return {
        ...cs,
        accuracy,
        bAccuracy,
        cAccuracy,
        practiceAccuracy,
        mockAccuracy,
        mockGap,
        topicsCoveredCount: cs.topicsCoveredCount.size,
      };
    });

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/analytics/trends (daily volume and accuracy timeline)
export const getTrends = async (req, res, next) => {
  try {
    const user = req.user;
    const filter = buildFilter(user._id, req.query);
    const sessions = await Session.find(filter).sort({ date: 1 }).lean();

    const dateMap = new Map();

    sessions.forEach((s) => {
      const d = s.date;
      if (!dateMap.has(d)) {
        dateMap.set(d, {
          date: d,
          total: 0,
          right: 0,
          wrong: 0,
          mockTimeTotal: 0,
          mockCount: 0,
        });
      }
      const item = dateMap.get(d);
      s.entries.forEach((e) => {
        item.total += e.total;
        item.right += e.right;
        item.wrong += e.wrong;
      });
      if (s.kind === 'mock' && s.timeTakenMin) {
        item.mockTimeTotal += s.timeTakenMin;
        item.mockCount++;
      }
    });

    const data = Array.from(dateMap.values()).map((item) => ({
      date: item.date,
      total: item.total,
      right: item.right,
      wrong: item.wrong,
      accuracy: item.total > 0 ? Math.round((item.right / item.total) * 1000) / 10 : 0,
      avgMockTime: item.mockCount > 0 ? Math.round(item.mockTimeTotal / item.mockCount) : null,
      target: user.dailyTarget || 100,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
