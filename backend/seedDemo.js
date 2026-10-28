import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Chapter } from './models/Chapter.js';
import { Topic } from './models/Topic.js';
import { Session } from './models/Session.js';

dotenv.config();

const mistakeTagOptions = ['concept gap', 'silly mistake', 'time', 'guess'];

export const seedDemoData = async () => {
  await connectDB();
  console.log('[Demo] Seeding 3 weeks of realistic practice & mock data...');

  const user = await User.findOne();
  if (!user) {
    console.error('[Demo] No user found. Run npm run seed first.');
    process.exit(1);
  }

  const chapters = await Chapter.find().lean();
  const topics = await Topic.find().lean();

  if (chapters.length === 0 || topics.length === 0) {
    console.error('[Demo] Syllabus data missing. Run npm run seed first.');
    process.exit(1);
  }

  // Clear existing demo sessions for this user
  await Session.deleteMany({ userId: user._id });

  // Generate 21 days of sessions (ending today)
  const today = new Date();
  const sessionsToInsert = [];

  for (let d = 21; d >= 0; d--) {
    const sessionDate = new Date(today);
    sessionDate.setDate(today.getDate() - d);
    const dateStr = sessionDate.toISOString().split('T')[0];

    // Morning Session: ~80-120 questions across 2 chapters
    // Rotate chapters
    const chIndex1 = (d * 2) % chapters.length;
    const ch1 = chapters[chIndex1];
    const ch1Topics = topics.filter((t) => t.chapterId.toString() === ch1._id.toString());

    if (ch1Topics.length > 0) {
      // Pick 3-5 topics
      const pickedTopics = ch1Topics.slice(0, Math.min(4, ch1Topics.length));
      const entries = pickedTopics.map((t, idx) => {
        const total = 20 + Math.floor(Math.random() * 15); // 20-35 questions
        // Simulate higher accuracy for some, lower for Ch 14 / Part C
        const baseAcc = ch1.no === 14 || ch1.no === 11 ? 0.45 : ch1.isPartA ? 0.7 : 0.65;
        const right = Math.min(total, Math.max(2, Math.round(total * (baseAcc + (Math.random() * 0.25 - 0.12)))));
        const wrong = total - right;

        let bTotal = 0, cTotal = 0, bRight = null;
        if (!ch1.isPartA) {
          bTotal = Math.round(total * 0.4);
          cTotal = total - bTotal;
          bRight = Math.round(right * 0.45);
        }

        const tags = [];
        if (wrong > 0) {
          if (Math.random() > 0.4) tags.push(mistakeTagOptions[Math.floor(Math.random() * mistakeTagOptions.length)]);
          if (wrong > 4 && Math.random() > 0.6) tags.push('silly mistake');
        }

        return {
          topicId: t._id,
          topicCode: t.code,
          topicName: t.name,
          total,
          right,
          wrong,
          bTotal,
          cTotal,
          bRight,
          skipped: 0,
          mistakeTags: tags,
        };
      });

      sessionsToInsert.push({
        userId: user._id,
        date: dateStr,
        slot: 'morning',
        kind: 'practice',
        chapterId: ch1._id,
        notes: `Morning deep practice on ${ch1.name}`,
        entries,
      });
    }

    // Night Session: Mock test (every 2nd day)
    if (d % 2 === 0) {
      const chIndex2 = (d * 3 + 1) % chapters.length;
      const ch2 = chapters[chIndex2];
      const ch2Topics = topics.filter((t) => t.chapterId.toString() === ch2._id.toString());

      if (ch2Topics.length > 0) {
        const picked = ch2Topics.slice(0, Math.min(3, ch2Topics.length));
        const entries = picked.map((t) => {
          const total = 15 + Math.floor(Math.random() * 10);
          // Mocks have ~8-12% lower accuracy (exam pressure)
          const baseAcc = 0.52;
          const right = Math.min(total, Math.max(1, Math.round(total * (baseAcc + (Math.random() * 0.2 - 0.1)))));
          const wrong = total - right;

          let bTotal = 0, cTotal = 0, bRight = null;
          if (!ch2.isPartA) {
            bTotal = Math.round(total * 0.35);
            cTotal = total - bTotal;
            bRight = Math.round(right * 0.4);
          }

          const tags = [];
          if (wrong > 0) {
            tags.push(Math.random() > 0.5 ? 'time' : 'concept gap');
          }

          return {
            topicId: t._id,
            topicCode: t.code,
            topicName: t.name,
            total,
            right,
            wrong,
            bTotal,
            cTotal,
            bRight,
            skipped: 0,
            mistakeTags: tags,
          };
        });

        sessionsToInsert.push({
          userId: user._id,
          date: dateStr,
          slot: 'night',
          kind: 'mock',
          chapterId: ch2._id,
          timeTakenMin: 45 + Math.floor(Math.random() * 25),
          notes: `Timed chapter mock test. Felt slight time pressure in Part C questions.`,
          entries,
        });
      }
    }
  }

  await Session.insertMany(sessionsToInsert);
  console.log(`[Demo] Successfully generated ${sessionsToInsert.length} realistic sessions across past 21 days!`);
};

export const clearDemoData = async () => {
  await connectDB();
  const user = await User.findOne();
  if (user) {
    await Session.deleteMany({ userId: user._id });
    console.log('[Demo] Cleared all sessions for user.');
  }
};

if (process.argv.includes('--clear')) {
  clearDemoData().then(() => process.exit(0));
} else if (process.argv[1]?.endsWith('seedDemo.js')) {
  seedDemoData().then(() => process.exit(0));
}
