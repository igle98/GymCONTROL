import { WEIGHT_INCREMENT } from './constants.js';

// Epley formula: 1RM = weight × (1 + reps / 30)
export function estimate1RM(weight, reps) {
  if (reps === 1) return weight;
  if (reps === 0 || weight === 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// Calculate total volume: sum of (weight × reps) for all sets
export function calculateVolume(sets) {
  return sets.reduce((total, set) => {
    if (set.type === 'warmup') return total;
    return total + set.weight * set.reps;
  }, 0);
}

// Suggest next weight based on last session performance
export function suggestWeight(lastSets, targetReps) {
  if (!lastSets || lastSets.length === 0) return null;

  const workingSets = lastSets.filter((s) => s.type !== 'warmup');
  if (workingSets.length === 0) return null;

  const lastWeight = workingSets[0].weight;
  const allCompleted = workingSets.every((s) => s.reps >= targetReps);

  if (allCompleted) {
    return roundToNearest(lastWeight + WEIGHT_INCREMENT, WEIGHT_INCREMENT);
  }
  return lastWeight;
}

// Calculate warmup sets based on working weight
export function calculateWarmup(workingWeight) {
  if (workingWeight <= 20) return [];

  const percentages = [0.5, 0.7, 0.85];
  return percentages
    .map((pct) => ({
      weight: roundToNearest(workingWeight * pct, 2.5),
      reps: pct <= 0.5 ? 10 : pct <= 0.7 ? 6 : 3,
      percentage: Math.round(pct * 100),
    }))
    .filter((set) => set.weight >= 20);
}

function roundToNearest(value, increment) {
  return Math.round(value / increment) * increment;
}
