import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import { Chapter } from './models/Chapter.js';
import { Topic } from './models/Topic.js';
import { User } from './models/User.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const seedSyllabus = async () => {
  await connectDB();
  console.log('[Seed] Seeding syllabus data from syllabus_seed.json...');

  // Ensure default user exists
  const defaultEmail = (process.env.ADMIN_EMAIL || 'aspirant@csirnet.local').toLowerCase();
  let user = await User.findOne({ email: defaultEmail });
  if (!user) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'csir2026', 10);
    user = await User.create({
      email: defaultEmail,
      passwordHash,
      name: 'CSIR Aspirant',
      examDate: '2026-12-19',
      dailyTarget: 100,
    });
    console.log(`[Seed] Created default user: ${user.email}`);
  }

  // Read syllabus_seed.json
  const seedFilePath = path.join(__dirname, 'config', 'syllabus_seed.json');
  const rawData = fs.readFileSync(seedFilePath, 'utf8');
  const syllabusData = JSON.parse(rawData);

  let chapterCount = 0;
  let topicCount = 0;

  for (const chData of syllabusData.chapters) {
    // Upsert Chapter without overwriting student custom edits (like customized weight)
    let chapter = await Chapter.findOne({ no: chData.no });
    if (!chapter) {
      chapter = await Chapter.create({
        no: chData.no,
        name: chData.name,
        isPartA: Boolean(chData.isPartA),
        weight: chData.weight || 3,
        order: chData.order !== undefined ? chData.order : chData.no,
      });
      console.log(`[Seed] Created Chapter ${chData.no}: ${chData.name}`);
    } else {
      // Keep weight if student modified it, update name & order
      chapter.name = chData.name;
      chapter.isPartA = Boolean(chData.isPartA);
      chapter.order = chData.order !== undefined ? chData.order : chData.no;
      await chapter.save();
    }
    chapterCount++;

    // Seed Topics for this chapter (match on code)
    // Never overwrite isCustom topics or delete them!
    for (const tData of chData.topics) {
      let topic = await Topic.findOne({ chapterId: chapter._id, code: tData.code });
      if (!topic) {
        await Topic.create({
          chapterId: chapter._id,
          chapterNo: chapter.no,
          code: tData.code,
          name: tData.name,
          description: tData.description || '',
          order: tData.order || 0,
          isCustom: false,
        });
      } else {
        // Only update description / order if not custom; preserve user edits
        if (!topic.isCustom) {
          topic.name = tData.name;
          topic.description = tData.description || '';
          topic.order = tData.order || 0;
          await topic.save();
        }
      }
      topicCount++;
    }
  }

  console.log(`[Seed] Successfully seeded ${chapterCount} chapters and ${topicCount} topics.`);
};

if (process.argv[1]?.endsWith('seed.js') || process.argv[1]?.endsWith('seedSyllabus.js')) {
  seedSyllabus()
    .then(() => {
      console.log('[Seed] Finished. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Error]', err);
      process.exit(1);
    });
}
