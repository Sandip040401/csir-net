import { describe, it, expect } from '@jest/globals';
import {
  wilsonScoreLowerBound,
  bayesianSmoothedAccuracy,
  classifyTopic,
  computePriorityScore,
  calculateEstimatedExamMarks,
} from '../config/analyticsEngine.js';

describe('Analytics Engine Unit Tests', () => {
  it('calculates Wilson score lower bound conservatively for small sample sizes', () => {
    // 3 right out of 3 attempts (100% naive) vs 60 right out of 60
    const smallSampleScore = wilsonScoreLowerBound(3, 3);
    const largeSampleScore = wilsonScoreLowerBound(60, 60);

    expect(smallSampleScore).toBeLessThan(largeSampleScore);
    expect(smallSampleScore).toBeGreaterThan(0);
    expect(smallSampleScore).toBeLessThan(100);
  });

  it('calculates Bayesian smoothed accuracy towards 50% prior', () => {
    // 1 right out of 1 attempt naive = 100%, smoothed should be close to ~57%
    const smoothed = bayesianSmoothedAccuracy(1, 1, 0.5, 6);
    expect(smoothed).toBeLessThan(80);
    expect(smoothed).toBeGreaterThan(50);
  });

  it('classifies topic accurately into Weak, Needs work, Good, Strong', () => {
    expect(classifyTopic(40, 20)).toBe('Weak');
    expect(classifyTopic(55, 20)).toBe('Needs work');
    expect(classifyTopic(75, 20)).toBe('Good');
    expect(classifyTopic(85, 20)).toBe('Strong');
    expect(classifyTopic(100, 3)).toBe('Low sample');
    expect(classifyTopic(0, 0)).toBe('Untested');
  });

  it('computes priority score correctly giving higher urgency to high error and high chapter weight', () => {
    const highUrgency = computePriorityScore({
      smoothedAccuracy: 35,
      daysSincePracticed: 10,
      chapterWeight: 5,
      attempts: 25,
    });

    const lowUrgency = computePriorityScore({
      smoothedAccuracy: 85,
      daysSincePracticed: 1,
      chapterWeight: 2,
      attempts: 50,
    });

    expect(highUrgency).toBeGreaterThan(lowUrgency);
  });

  it('projects exam marks using negative marking scheme', () => {
    // Part C: 25 attempted, 20 right (+80), 5 wrong (-5) => net 75
    const result = calculateEstimatedExamMarks({
      partAStats: { attempts: 15, right: 12, wrong: 3 }, // 12*2 - 3*0.5 = 24 - 1.5 = 22.5
      partBStats: { attempts: 35, right: 28, wrong: 7 }, // 28*2 - 7*0.5 = 56 - 3.5 = 52.5
      partCStats: { attempts: 25, right: 20, wrong: 5 }, // 20*4 - 5*1.0 = 80 - 5.0 = 75
    });

    expect(result.partA.expectedScore).toBe(22.5);
    expect(result.partB.expectedScore).toBe(52.5);
    expect(result.partC.expectedScore).toBe(75.0);
    expect(result.projectedTotal).toBe(150.0);
    expect(result.totalLostToNegatives).toBe(10.0);
  });
});
