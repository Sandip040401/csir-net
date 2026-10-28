import { Session } from '../models/Session.js';
import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';
import { classifyTopic, bayesianSmoothedAccuracy } from '../config/analyticsEngine.js';

export const generateRecommendations = async (req, res, next) => {
  try {
    const user = req.user;
    const todayStr = new Date().toISOString().split('T')[0];
    const msInDay = 1000 * 60 * 60 * 24;

    const [chapters, allTopics, sessions] = await Promise.all([
      Chapter.find({ hidden: { $ne: true } }).lean(),
      Topic.find({ hidden: { $ne: true } }).populate('chapterId').lean(),
      Session.find({ userId: user._id }).lean(),
    ]);

    const examDateStr = user.examDate || '2026-12-19';
    const daysToExam = Math.max(0, Math.ceil((new Date(examDateStr).getTime() - new Date(todayStr).getTime()) / msInDay));

    const recommendations = [];

    // Aggregate topic stats
    const topicStats = new Map();
    allTopics.forEach((t) => {
      topicStats.set(t._id.toString(), {
        topic: t,
        attempts: 0,
        right: 0,
        wrong: 0,
        bTotal: 0,
        cTotal: 0,
        cRight: 0,
        lastPracticedDate: null,
        mistakeTags: { 'concept gap': 0, 'silly mistake': 0, 'time': 0, 'guess': 0 },
      });
    });

    let totalPracticeAtt = 0, totalPracticeRight = 0;
    let totalMockAtt = 0, totalMockRight = 0;
    let partAAttempts = 0, partARight = 0;
    let totalPartCAtt = 0, totalPartCRight = 0;

    sessions.forEach((s) => {
      const isMock = s.kind === 'mock';
      const isPartA = s.chapterId?.toString() === chapters.find((c) => c.isPartA)?._id?.toString();

      s.entries.forEach((e) => {
        const tid = e.topicId?.toString();
        const stat = topicStats.get(tid);

        if (stat) {
          stat.attempts += e.total;
          stat.right += e.right;
          stat.wrong += e.wrong;
          stat.bTotal += (e.bTotal || 0);
          stat.cTotal += (e.cTotal || 0);

          const bR = e.bRight !== null && e.bRight !== undefined ? e.bRight : Math.round(e.right * ((e.bTotal || 0) / Math.max(1, e.total)));
          const cR = Math.max(0, e.right - bR);
          stat.cRight += cR;

          if (!stat.lastPracticedDate || s.date > stat.lastPracticedDate) {
            stat.lastPracticedDate = s.date;
          }

          if (e.mistakeTags) {
            e.mistakeTags.forEach((tag) => {
              if (stat.mistakeTags[tag] !== undefined) stat.mistakeTags[tag]++;
            });
          }
        }

        if (isPartA) {
          partAAttempts += e.total;
          partARight += e.right;
        }

        if (isMock) {
          totalMockAtt += e.total;
          totalMockRight += e.right;
        } else {
          totalPracticeAtt += e.total;
          totalPracticeRight += e.right;
        }

        totalPartCAtt += (e.cTotal || 0);
      });
    });

    // RULE 1: Concept gaps (Low accuracy + high attempts >= 25)
    topicStats.forEach((st) => {
      if (st.attempts >= 25) {
        const acc = Math.round((st.right / st.attempts) * 100);
        if (acc < 50) {
          recommendations.push({
            id: `concept-gap-${st.topic._id}`,
            category: 'concept_gap',
            severity: 'critical', // 'critical', 'warning', 'info'
            title: `Concept Gap in ${st.topic.code} – ${st.topic.name}`,
            description: `Accuracy is currently ${acc}% across ${st.attempts} questions. Revisit theory and standard reference texts (e.g., Lehninger/Lodish/Gilbert), then solve a focused 30-question diagnostic set.`,
            action: `Review ${st.topic.name} theory`,
            topicId: st.topic._id,
            chapterNo: st.topic.chapterNo,
          });
        }
      }
    });

    // RULE 2: Under-sampled low accuracy topics (Low accuracy + attempts < 10)
    topicStats.forEach((st) => {
      if (st.attempts > 0 && st.attempts < 10) {
        const acc = Math.round((st.right / st.attempts) * 100);
        if (acc < 50) {
          recommendations.push({
            id: `low-sample-${st.topic._id}`,
            category: 'low_sample',
            severity: 'info',
            title: `Low Sample Size for ${st.topic.code} (${st.topic.name})`,
            description: `Current accuracy is ${acc}%, but only ${st.attempts} questions attempted. Solve 20+ more standard questions before assessing mastery.`,
            action: `Attempt 20 Qs in ${st.topic.code}`,
            topicId: st.topic._id,
            chapterNo: st.topic.chapterNo,
          });
        }
      }
    });

    // RULE 3: High wrong-rate in Part C (accuracy < 45% with >= 30 attempts)
    if (totalPartCAtt >= 30) {
      const partCAcc = Math.round((totalPartCRight / totalPartCAtt) * 100);
      if (partCAcc < 45) {
        const marksLost = Math.round((totalPartCAtt - totalPartCRight) * 1.0);
        recommendations.push({
          id: 'part-c-high-negatives',
          category: 'exam_strategy',
          severity: 'critical',
          title: `Excessive Negative Marking in Part C (${partCAcc}% Accuracy)`,
          description: `You have lost approximately ${marksLost} marks to negative deductions in Part C. Rule of thumb: Part C has 75 questions to choose only 25 from. Attempt only when you can reliably eliminate 2 options; guess only when P(correct) > 20%.`,
          action: 'Practice 2-option elimination strategy on Part C PYQs',
        });
      }
    }

    // RULE 4: Spaced revision queue (topic touched > 7 days ago and accuracy < 80%)
    topicStats.forEach((st) => {
      if (st.lastPracticedDate && st.attempts >= 10) {
        const daysSince = Math.floor((new Date(todayStr).getTime() - new Date(st.lastPracticedDate).getTime()) / msInDay);
        const acc = Math.round((st.right / st.attempts) * 100);
        if (daysSince >= 7 && acc < 80) {
          recommendations.push({
            id: `spaced-rev-${st.topic._id}`,
            category: 'spaced_revision',
            severity: 'warning',
            title: `Due for Spaced Revision: ${st.topic.code} (${st.topic.name})`,
            description: `Last practiced ${daysSince} days ago (Accuracy: ${acc}%). Memory retention drops significantly after 7 days without active recall.`,
            action: `Do a 15-question speed recall drill`,
            topicId: st.topic._id,
            chapterNo: st.topic.chapterNo,
          });
        }
      }
    });

    // RULE 5: High 'silly mistake' mistakeTags
    let totalSilly = 0, totalMistakes = 0;
    topicStats.forEach((st) => {
      totalSilly += st.mistakeTags['silly mistake'];
      totalMistakes += (st.mistakeTags['concept gap'] + st.mistakeTags['silly mistake'] + st.mistakeTags['time'] + st.mistakeTags['guess']);
    });
    if (totalMistakes >= 15 && (totalSilly / totalMistakes) > 0.3) {
      recommendations.push({
        id: 'silly-mistakes-pattern',
        category: 'execution',
        severity: 'warning',
        title: 'High Frequency of Silly Mistakes Detected',
        description: `${Math.round((totalSilly / totalMistakes) * 100)}% of your tagged errors are categorized as "silly mistakes". Re-read question stems carefully for keywords like "EXCEPT", "INCORRECT", "NOT TRUE", and circle option units before answering.`,
        action: 'Re-read negative stems twice before selecting options',
      });
    }

    // RULE 6: Mock vs Practice gap (mock accuracy < practice accuracy by > 10 points)
    if (totalPracticeAtt >= 40 && totalMockAtt >= 40) {
      const practiceAcc = Math.round((totalPracticeRight / totalPracticeAtt) * 100);
      const mockAcc = Math.round((totalMockRight / totalMockAtt) * 100);
      if (practiceAcc - mockAcc > 10) {
        recommendations.push({
          id: 'mock-practice-pressure-gap',
          category: 'pressure',
          severity: 'critical',
          title: `Exam-Pressure Gap (${practiceAcc}% Practice vs ${mockAcc}% Mock)`,
          description: `Your mock performance is ${practiceAcc - mockAcc} points lower than untimed practice. This indicates anxiety under the ticking clock or rush in question selection. Increase nightly mini-mock sessions to build time resilience.`,
          action: 'Conduct 45-minute timed chapter mocks',
        });
      }
    }

    // RULE 7: Low Part A accuracy / attention
    if (partAAttempts < 30 || (partAAttempts >= 20 && (partARight / partAAttempts) < 0.55)) {
      recommendations.push({
        id: 'part-a-low-attention',
        category: 'strategy',
        severity: 'info',
        title: 'Dedicate 20 Minutes Daily to Part A (General Aptitude)',
        description: 'Part A yields 30 direct marks with straightforward arithmetic, graphical analysis, and series questions. Solving just 8-10 high-confidence questions provides an easy 16-20 mark buffer toward JRF cutoff.',
        action: 'Practice 10 Part A questions daily',
      });
    }

    // RULE 8: Coverage low with exam approaching (< 30 days)
    const touchedTopicsCount = Array.from(topicStats.values()).filter((s) => s.attempts > 0).length;
    const coveragePct = allTopics.length > 0 ? (touchedTopicsCount / allTopics.length) * 100 : 0;
    if (daysToExam < 30 && coveragePct < 60) {
      recommendations.push({
        id: 'coverage-alert-exam-near',
        category: 'coverage',
        severity: 'critical',
        title: `Low Syllabus Coverage (${Math.round(coveragePct)}%) with ${daysToExam} Days Remaining`,
        description: 'Prioritize untouched high-weight chapters (Methods in Biology [Ch 14], Fundamental Processes [Ch 3], Cell Signaling [Ch 4], Inheritance [Ch 8]) before exploring niche areas.',
        action: 'Target untouched topics in high-weight chapters',
      });
    }

    // Sort: critical first, then warning, then info
    const severityWeight = { critical: 3, warning: 2, info: 1 };
    recommendations.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

    const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

    return res.json({
      success: true,
      hasAnthropicKey,
      count: recommendations.length,
      data: recommendations,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/analytics/ai-advice (Optional Claude advice integration)
export const getAIAdvice = async (req, res, next) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'ANTHROPIC_API_KEY is not configured on the server.',
      });
    }

    const { summary } = req.body;
    if (!summary) {
      return res.status(400).json({ success: false, error: 'Computed summary is required.' });
    }

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `You are an expert mentor for CSIR NET Life Sciences & Biotechnology (Dec 2026). Here is the candidate's aggregated preparation summary:
${JSON.stringify(summary, null, 2)}

Provide 3 concrete, crisp, high-impact tactical recommendations formatted in clear Markdown bullet points. Focus on mark maximization, negative marking containment, and high-yield chapter prioritization. Do not repeat raw numbers needlessly.`,
          },
        ],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(502).json({ success: false, error: result.error?.message || 'AI request failed' });
    }

    const adviceText = result.content?.[0]?.text || 'No advice returned.';
    return res.json({ success: true, advice: adviceText });
  } catch (err) {
    next(err);
  }
};
