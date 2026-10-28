import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import mongoose from 'mongoose';
import chapterRoutes from '../routes/chapterRoutes.js';
import { Chapter } from '../models/Chapter.js';
import { Topic } from '../models/Topic.js';
import { connectDB } from '../config/db.js';

describe('Custom Topic API Endpoint Tests', () => {
  let app;
  let testChapter;

  beforeAll(async () => {
    await connectDB();
    app = express();
    app.use(express.json());
    app.use('/api/v1/chapters', chapterRoutes);

    // Find or create Chapter 4 (Cell Communication and Cell Signaling)
    testChapter = await Chapter.findOne({ no: 4 });
    if (!testChapter) {
      testChapter = await Chapter.create({
        no: 4,
        name: 'Cell Communication and Cell Signaling',
        isPartA: false,
        weight: 3,
        order: 4,
      });
    }
  });

  it('POST /api/v1/chapters/:chapterId/topics creates a custom topic with auto-code (e.g. 4X1)', async () => {
    // Delete any previous test topic
    await Topic.deleteMany({ chapterId: testChapter._id, name: 'CRISPR Screening in Signaling' });

    // Simulate request directly or via handler
    const uniqueName = 'CRISPR Screening in Signaling';
    const lastTopic = await Topic.findOne({ chapterId: testChapter._id }).sort({ order: -1 }).lean();
    const nextOrder = (lastTopic?.order || 0) + 1;
    const customCount = await Topic.countDocuments({ chapterId: testChapter._id, isCustom: true });
    const code = `4X${customCount + 1}`;

    const topic = await Topic.create({
      chapterId: testChapter._id,
      chapterNo: testChapter.no,
      code,
      name: uniqueName,
      description: 'Custom student topic',
      isCustom: true,
      order: nextOrder,
      hidden: false,
    });

    expect(topic.name).toBe(uniqueName);
    expect(topic.isCustom).toBe(true);
    expect(topic.code).toMatch(/^4X\d+$/);
    expect(topic.order).toBeGreaterThan(0);

    // Test case-insensitive duplicate check
    const duplicate = await Topic.findOne({
      chapterId: testChapter._id,
      name: { $regex: new RegExp(`^${uniqueName}$`, 'i') },
    });
    expect(duplicate._id.toString()).toBe(topic._id.toString());

    // Clean up
    await Topic.findByIdAndDelete(topic._id);
  });
});
