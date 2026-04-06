import { WEIGHT_INCREMENT } from './constants.js';

// Analyze last session data and suggest weight for next session
export function getWeightSuggestion(previousSets, targetReps = null) {
  if (!previousSets || previousSets.length === 0) {
    return { weight: null, message: 'Sin datos anteriores' };
  }

  const workingSets = previousSets.filter((s) => s.type !== 'warmup');
  if (workingSets.length === 0) {
    return { weight: null, message: 'Sin series de trabajo anteriores' };
  }

  const lastWeight = workingSets[0].weight;
  const maxReps = Math.max(...workingSets.map((s) => s.reps));
  const minReps = Math.min(...workingSets.map((s) => s.reps));
  const effectiveTarget = targetReps || workingSets[0].reps;

  // All sets completed at or above target reps → suggest increase
  if (minReps >= effectiveTarget) {
    const newWeight = roundToNearest(lastWeight + WEIGHT_INCREMENT, WEIGHT_INCREMENT);
    return {
      weight: newWeight,
      message: `Completaste todas las series. Sube a ${newWeight}kg`,
      trend: 'up',
    };
  }

  // Some sets failed but first set was good → maintain weight
  if (workingSets[0].reps >= effectiveTarget) {
    return {
      weight: lastWeight,
      message: `Mantén ${lastWeight}kg hasta completar todas las series`,
      trend: 'hold',
    };
  }

  // First set already failed → might be too heavy
  const lowerWeight = roundToNearest(lastWeight - WEIGHT_INCREMENT, WEIGHT_INCREMENT);
  return {
    weight: lastWeight,
    message: `Última vez: ${minReps}-${maxReps} reps con ${lastWeight}kg`,
    trend: 'hold',
  };
}

function roundToNearest(value, increment) {
  return Math.round(value / increment) * increment;
}
