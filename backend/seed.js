import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { Chapter } from './models/Chapter.js';
import { Topic } from './models/Topic.js';
import { User } from './models/User.js';
import { SYLLABUS_DATA } from './config/syllabusData.js';

dotenv.config();

export const seedDatabase = async () => {
  await connectDB();
  console.log('[Seed] Starting idempotent syllabus & user seed...');

  // 1. Seed or Update Default User
  const defaultEmail = (process.env.ADMIN_EMAIL || 'aspirant@csirnet.local').toLowerCase();
  const defaultPassword = process.env.ADMIN_PASSWORD || 'csir2026';
  const existingUser = await User.findOne({ email: defaultEmail });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const user = await User.create({
      email: defaultEmail,
      passwordHash,
      name: 'CSIR Aspirant',
      examDate: '2026-12-19',
      dailyTarget: 100,
    });
    console.log(`[Seed] Created default user: ${user.email} (Password: ${defaultPassword})`);
  } else {
    console.log(`[Seed] Default user already exists: ${existingUser.email}`);
  }

  // 2. Seed or Update Chapters and Topics (Idempotent)
  for (const item of SYLLABUS_DATA) {
    let chapter = await Chapter.findOne({ no: item.no });
    if (!chapter) {
      chapter = await Chapter.create({
        no: item.no,
        name: item.name,
        isPartA: item.isPartA,
        weight: item.weight,
        order: item.order,
      });
      console.log(`[Seed] Created Chapter ${item.no}: ${item.name}`);
    } else {
      // Keep weight if user customized it, update name/order if default
      chapter.name = item.name;
      chapter.isPartA = item.isPartA;
      chapter.order = item.order;
      await chapter.save();
    }

    // Seed topics for this chapter
    let topicOrder = 1;
    for (const t of item.topics) {
      let topic = await Topic.findOne({ chapterId: chapter._id, code: t.code });
      if (!topic) {
        await Topic.create({
          chapterId: chapter._id,
          chapterNo: chapter.no,
          code: t.code,
          name: t.name,
          description: t.description || '',
          order: topicOrder++,
          isCustom: false,
        });
      } else {
        topic.name = t.name;
        topic.description = t.description || '';
        topic.chapterNo = chapter.no;
        await topic.save();
      }
    }
  }

  console.log('[Seed] Syllabus seed completed successfully.');
};

// Allow standalone script execution
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Finished. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}
