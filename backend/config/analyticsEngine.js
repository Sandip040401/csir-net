/**
 * CSIR NET Analytics Engine
 * Implements Bayesian smoothing / Wilson lower bound, recency decay weighting,
 * exam projection calculations, topic classification, and priority scoring.
 */

/**
 * Wilson lower bound on Bernoulli parameter
 * Gives a conservative, robust estimate of accuracy even for small sample sizes.
 * @param {number} positive - Number of correct questions
 * @param {number} total - Total attempted questions
 * @param {number} confidence - z-score (e.g. 1.44 for ~85% CI, 1.96 for 95%)
 */
export const wilsonScoreLowerBound = (positive, total, confidence = 1.44) => {
  if (total === 0) return 0;
  const p = positive / total;
  const z = confidence;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const centreAdjusted = p + z2 / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  const lower = (centreAdjusted - spread) / denominator;
  return Math.max(0, Math.min(100, Math.round(lower * 1000) / 10)); // return %
};

/**
 * Bayesian Smoothed Accuracy (Laplace-m estimator)
 * Shrinks small sample accuracy towards an empirical prior (e.g. 50% baseline)
 */
export const bayesianSmoothedAccuracy = (positive, total, priorMean = 0.5, priorWeight = 6) => {
  if (total === 0) return 0;
  const smoothed = (positive + priorMean * priorWeight) / (total + priorWeight);
  return Math.round(smoothed * 1000) / 10;
};

/**
 * Recency Weight Calculation using exponential decay
 * Half-life: 10 days
 * @param {string} entryDate - 'YYYY-MM-DD'
 * @param {string} currentDate - 'YYYY-MM-DD'
 * @param {number} halfLifeDays - default 10
 */
export const computeRecencyWeight = (entryDate, currentDate, halfLifeDays = 10) => {
  const d1 = new Date(entryDate).getTime();
  const d2 = new Date(currentDate).getTime();
  const diffDays = Math.max(0, (d2 - d1) / (1000 * 60 * 60 * 24));
  const decayRate = Math.LN2 / halfLifeDays;
  return Math.exp(-decayRate * diffDays);
};

/**
 * Topic Classification based on user-configured thresholds
 */
export const classifyTopic = (accuracy, attempts, thresholds = {}) => {
  const weakThresh = thresholds.weakThreshold ?? 50;
  const needsWorkThresh = thresholds.needsWorkThreshold ?? 65;
  const goodThresh = thresholds.goodThreshold ?? 80;

  if (attempts === 0) return 'Untested';
  if (attempts < 10) return 'Low sample';
  if (accuracy < weakThresh) return 'Weak';
  if (accuracy < needsWorkThresh) return 'Needs work';
  if (accuracy < goodThresh) return 'Good';
  return 'Strong';
};

/**
 * Compute Topic Priority Score
 * Priority = weight * (1 - smoothedAccuracy/100) * stalenessFactor * chapterWeight
 * High priority score = should be studied immediately
 */
export const computePriorityScore = ({
  smoothedAccuracy,
  daysSincePracticed,
  chapterWeight = 3,
  attempts = 0,
}) => {
  // If untested or zero attempts, treat smoothed accuracy as low
  const errorRate = Math.max(0.1, 1 - smoothedAccuracy / 100);

  // Staleness factor: gradually increases if untouched for over 4 days
  let stalenessFactor = 1.0;
  if (daysSincePracticed === null || daysSincePracticed === undefined) {
    stalenessFactor = 2.0; // Untested topic gets boost
  } else if (daysSincePracticed > 14) {
    stalenessFactor = 1.8;
  } else if (daysSincePracticed > 7) {
    stalenessFactor = 1.4;
  } else if (daysSincePracticed > 3) {
    stalenessFactor = 1.1;
  }

  // Weight penalty if under-practiced
  const sampleMultiplier = attempts < 10 ? 1.3 : 1.0;

  const score = errorRate * stalenessFactor * chapterWeight * sampleMultiplier * 10;
  return Math.round(score * 10) / 10;
};

/**
 * Projected Exam Marks Scheme Calculator
 * Standard CSIR NET marking rules:
 * Part A: 20 Qs, max 15 attempt, +2 / -0.5
 * Part B: 50 Qs, max 35 attempt, +2 / -0.5
 * Part C: 75 Qs, max 25 attempt, +4 / -1.0
 * Total: 200 marks
 */
export const calculateEstimatedExamMarks = ({
  partAStats = { attempts: 0, right: 0, wrong: 0 },
  partBStats = { attempts: 0, right: 0, wrong: 0 },
  partCStats = { attempts: 0, right: 0, wrong: 0 },
  settings = {},
}) => {
  const sA = settings.partA || { maxAttempt: 15, marksPerCorrect: 2.0, negativeMark: 0.5 };
  const sB = settings.partB || { maxAttempt: 35, marksPerCorrect: 2.0, negativeMark: 0.5 };
  const sC = settings.partC || { maxAttempt: 25, marksPerCorrect: 4.0, negativeMark: 1.0 };

  const calcPart = (stats, config) => {
    if (stats.attempts === 0) return { expectedScore: 0, maxScore: config.maxAttempt * config.marksPerCorrect, marksLost: 0, wrongRate: 0, accuracy: 0 };
    const acc = stats.right / stats.attempts;
    const wrongRate = stats.wrong / stats.attempts;

    // Simulate standard candidate max attempt ceiling
    const simulatedAttempt = Math.min(stats.attempts, config.maxAttempt);
    const simulatedRight = simulatedAttempt * acc;
    const simulatedWrong = simulatedAttempt * wrongRate;

    const gain = simulatedRight * config.marksPerCorrect;
    const loss = simulatedWrong * config.negativeMark;
    const net = Math.max(0, gain - loss);

    return {
      expectedScore: Math.round(net * 10) / 10,
      maxScore: config.maxAttempt * config.marksPerCorrect,
      marksLost: Math.round(loss * 10) / 10,
      wrongRate: Math.round(wrongRate * 1000) / 10,
      accuracy: Math.round(acc * 1000) / 10,
    };
  };

  const partARes = calcPart(partAStats, sA);
  const partBRes = calcPart(partBStats, sB);
  const partCRes = calcPart(partCStats, sC);

  const totalScore = Math.min(200, Math.round((partARes.expectedScore + partBRes.expectedScore + partCRes.expectedScore) * 10) / 10);
  const totalLost = Math.round((partARes.marksLost + partBRes.marksLost + partCRes.marksLost) * 10) / 10;

  return {
    projectedTotal: totalScore,
    totalLostToNegatives: totalLost,
    partA: partARes,
    partB: partBRes,
    partC: partCRes,
  };
};
