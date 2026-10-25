import { UserProfile, WeightGoalConfig, PlanEvaluation, RoutineExercise } from '../types';

// Generic adult fallbacks, used only when the imported health data lacks a value
export const DEFAULT_WEIGHT_KG = 80;
export const DEFAULT_BASAL_KCAL = 1700;
export const DEFAULT_ACTIVE_KCAL = 400;

export function evaluateWeightGoalAndRecommendRoutine(
  profile: UserProfile,
  config: WeightGoalConfig
): PlanEvaluation {
  const currentWeight = config.currentWeightKg || profile.currentWeight || DEFAULT_WEIGHT_KG;
  const targetWeight = config.targetWeightKg;
  const weeks = Math.max(1, config.timeframeWeeks);
  const daysPerWeek = config.workoutDaysPerWeek;
  const focus = config.trainingFocus;

  // Real data baseline from user profile
  const baselineBasal = profile.avgBasalKcal30d || DEFAULT_BASAL_KCAL;
  const baselineActive = profile.avgActiveKcal30d || DEFAULT_ACTIVE_KCAL;
  const tdee = baselineBasal + baselineActive;

  const totalDeltaKg = currentWeight - targetWeight;
  const isLoss = totalDeltaKg > 0;
  const isGain = totalDeltaKg < 0;
  const absDeltaKg = Math.abs(totalDeltaKg);

  // 1 kg of body fat is roughly 7,700 kcal
  const totalDeficitKcal = Math.round(absDeltaKg * 7700);
  const weeklyChangeKg = Math.round((absDeltaKg / weeks) * 100) / 100;
  const rawDailyDeficitKcal = Math.round(totalDeficitKcal / (weeks * 7));

  // Determine safety and status
  let status: 'safe' | 'moderate' | 'aggressive' | 'extreme' = 'safe';
  let statusMessage = '';
  let recommendedWeeks = weeks;

  if (isLoss) {
    if (weeklyChangeKg <= 0.5) {
      status = 'safe';
      statusMessage = `Optimal & highly sustainable! Losing ${weeklyChangeKg} kg/week preserves lean muscle mass${profile.currentLeanMass !== null ? ` (${profile.currentLeanMass} kg)` : ''} and minimizes metabolic slowdown.`;
    } else if (weeklyChangeKg <= 1.0) {
      status = 'moderate';
      statusMessage = `Achievable with consistent discipline! Losing ${weeklyChangeKg} kg/week requires focused nutrition and strict adherence to the routine.`;
    } else if (weeklyChangeKg <= 1.5) {
      status = 'aggressive';
      const safeTime = Math.ceil(absDeltaKg / 0.75);
      statusMessage = `Aggressive goal (${weeklyChangeKg} kg/week). A high deficit may increase muscle loss and fatigue. A healthier timeframe would be ~${safeTime} weeks.`;
      recommendedWeeks = safeTime;
    } else {
      status = 'extreme';
      const safeTime = Math.ceil(absDeltaKg / 0.75);
      statusMessage = `Caution: Losing ${weeklyChangeKg} kg/week requires an extreme deficit (> ${rawDailyDeficitKcal} kcal/day), which is medically unadvisable without strict clinical supervision. We strongly recommend extending to ${safeTime} weeks.`;
      recommendedWeeks = safeTime;
    }
  } else if (isGain) {
    if (weeklyChangeKg <= 0.25) {
      status = 'safe';
      statusMessage = `Ideal lean muscle building rate (${weeklyChangeKg} kg/week) with minimal fat accumulation.`;
    } else {
      status = 'moderate';
      statusMessage = `Gaining ${weeklyChangeKg} kg/week. Ensure adequate protein intake to maximize hypertrophy over fat storage.`;
    }
  } else {
    status = 'safe';
    statusMessage = 'Weight maintenance mode. Focus on body recomposition, cardio endurance, and strength progression.';
  }

  // Deficit split: Diet vs Exercise
  // Recommended ~60% diet deficit and ~40% exercise deficit for sustainable fat loss
  const dietDeficitKcal = isLoss ? Math.round(rawDailyDeficitKcal * 0.6) : 0;
  const exerciseDeficitKcal = isLoss ? Math.round(rawDailyDeficitKcal * 0.4) : 0;
  const targetIntakeKcal = isLoss
    ? Math.max(1500, Math.round(tdee - rawDailyDeficitKcal))
    : Math.round(tdee + rawDailyDeficitKcal);

  // Generate Personalized 7-Day Routine
  const routine = generateWeeklyRoutine({
    daysPerWeek,
    focus,
    isLoss,
    isGain,
    weeklyChangeKg,
    status,
    exerciseDeficitKcal,
    weightKg: currentWeight,
  });

  // Generate projected trajectory for chart
  const projectedTrajectory = [];
  const today = new Date();
  for (let w = 0; w <= weeks; w++) {
    const d = new Date(today);
    d.setDate(d.getDate() + w * 7);
    const dateStr = d.toISOString().slice(0, 10);
    const projectedWeight = isLoss
      ? Math.max(targetWeight, Math.round((currentWeight - weeklyChangeKg * w) * 10) / 10)
      : Math.min(targetWeight, Math.round((currentWeight + weeklyChangeKg * w) * 10) / 10);

    projectedTrajectory.push({
      week: w,
      date: dateStr,
      projectedWeightKg: projectedWeight,
      maintenanceWeightKg: currentWeight,
    });
  }

  return {
    weeklyWeightChangeKg: weeklyChangeKg,
    totalDeficitKcal,
    dailyDeficitKcal: rawDailyDeficitKcal,
    dietDeficitKcal,
    exerciseDeficitKcal,
    tdeeKcal: tdee,
    targetIntakeKcal,
    status,
    statusMessage,
    recommendedWeeks,
    routine,
    projectedTrajectory,
  };
}

interface RoutineInput {
  daysPerWeek: number;
  focus: string;
  isLoss: boolean;
  isGain: boolean;
  weeklyChangeKg: number;
  status: 'safe' | 'moderate' | 'aggressive' | 'extreme';
  exerciseDeficitKcal: number;
  weightKg: number;
}

// Energy cost from duration and intensity: kcal = MET x body weight (kg) x hours
const kcalFor = (met: number, weightKg: number, minutes: number) => Math.round(met * weightKg * (minutes / 60));
const addSet = (sets: string, extra: number) => String(Number(sets) + extra);

// Pure function: routine scales with the goal's required pace (tier 0-3 for loss), gain emphasises strength
function generateWeeklyRoutine(input: RoutineInput): RoutineExercise[] {
  const { daysPerWeek, focus, isLoss, isGain, weeklyChangeKg, status, exerciseDeficitKcal, weightKg } = input;

  const tier = !isLoss ? 1 : weeklyChangeKg <= 0.25 ? 0 : weeklyChangeKg <= 0.5 ? 1 : weeklyChangeKg <= 1.0 ? 2 : 3;
  const strengthMin = isGain ? 55 : [40, 50, 55, 60][tier];
  const cardioMin = isGain ? 30 : [35, 45, 55, 65][tier];
  const hiitMin = isGain ? 20 : [25, 30, 35, 40][tier];
  const recoveryMin = isLoss && tier === 3 ? 40 : 30;
  const finisherMin = isLoss ? [0, 0, 10, 20][tier] : 0;
  const extraSets = isGain ? 1 : 0;
  const hiMet = tier >= 2 ? 9.5 : 8.5;

  const cardioZone =
    isLoss && tier === 3
      ? 'Zone 2-3 (120 - 145 bpm) with 4 x 3 min Zone 4 intervals'
      : isLoss && tier === 2
        ? 'Zone 2-3 (120 - 140 bpm) / Brisk Pace'
        : 'Zone 2 (115 - 130 bpm) / Conversational Pace';
  const cardioMet = isLoss && tier === 3 ? 7.5 : isLoss && tier === 2 ? 6.5 : 5;
  const cardioKm = (cardioMin * (tier >= 2 && isLoss ? 0.125 : 0.11)).toFixed(1);
  const cardioTitle =
    isLoss && tier === 3
      ? 'Zone 2-3 Tempo Walk with Intervals'
      : isLoss && tier === 2
        ? 'Zone 2-3 Brisk Incline Walk'
        : 'Zone 2 Aerobic Fat Oxidation & Incline Walk';
  const strengthMet = 5;

  const strengthTip = isGain
    ? 'Surplus phase: push main lifts toward 1-2 reps in reserve, rest 90-120s, and progress load every 1-2 weeks.'
    : tier >= 2
      ? 'Deficit is large: keep loads heavy to protect muscle, keep rest to 45-75s, and finish with the cardio block.'
      : 'Keep rest intervals strictly between 60-90s to maximize metabolic caloric output while preserving muscle.';

  const finisher = finisherMin > 0
    ? [{ name: `${finisherMin}-minute Cardio Finisher (incline walk / bike)`, sets: '1', repsOrDuration: `${finisherMin} mins`, notes: 'Zone 2-3 steady effort right after the lifts' }]
    : [];
  const withFinisher = <T extends { name: string; sets: string; repsOrDuration: string; notes: string }>(list: T[]) => [...list, ...finisher];
  const strengthMinTotal = strengthMin + finisherMin;
  const finisherNote = finisherMin > 0 ? ` + ${finisherMin} min cardio finisher` : '';

  const baseCardioKcal = kcalFor(cardioMet, weightKg, cardioMin);
  const baseStrengthKcal = kcalFor(strengthMet, weightKg, strengthMin) + (finisherMin ? kcalFor(6.5, weightKg, finisherMin) : 0);
  const baseHiitKcal = kcalFor(hiMet, weightKg, hiitMin);
  const recoveryKcal = kcalFor(2.8, weightKg, recoveryMin);

  const daysSchedule = [
    { day: 'Monday', activeIndex: 0 },
    { day: 'Tuesday', activeIndex: 1 },
    { day: 'Wednesday', activeIndex: 2 },
    { day: 'Thursday', activeIndex: 3 },
    { day: 'Friday', activeIndex: 4 },
    { day: 'Saturday', activeIndex: 5 },
    { day: 'Sunday', activeIndex: 6 },
  ];

  // Template workout pools based on user's proven activity in Apple Health (Walking, Strength, HIIT, Running)
  const strengthUpper = {
    sessionTitle: 'Upper Body Hypertrophy & Core',
    workoutType: 'Functional Strength Training',
    targetDurationMin: strengthMinTotal,
    targetHeartRateZone: 'Zone 3 (125 - 145 bpm) / RPE 7-8',
    volume: `${4 + extraSets} sets × 10-12 reps per movement${finisherNote}`,
    estCaloriesBurned: baseStrengthKcal,
    equipment: 'Dumbbells, Pull-up bar / Cable machine, Bench',
    exercises: withFinisher([
      { name: 'Dumbbell Incline Bench Press', sets: addSet('4', extraSets), repsOrDuration: '10-12 reps', notes: 'Controlled tempo 3s eccentric' },
      { name: 'Chest-Supported Row', sets: addSet('4', extraSets), repsOrDuration: '10-12 reps', notes: 'Squeeze shoulder blades at top' },
      { name: 'Overhead Dumbbell Press', sets: '3', repsOrDuration: '10 reps', notes: 'Brace core, maintain neutral spine' },
      { name: 'Lat Pulldowns or Pull-ups', sets: '3', repsOrDuration: '10-12 reps', notes: 'Full lat stretch at peak' },
      { name: 'Hanging Knee Raises / Planks', sets: '3', repsOrDuration: '45-60s hold', notes: 'Posterior pelvic tilt' },
    ]),
    coachingTips: strengthTip,
  };

  const strengthLower = {
    sessionTitle: 'Lower Body Strength & Posterior Chain',
    workoutType: 'Functional Strength Training',
    targetDurationMin: strengthMinTotal,
    targetHeartRateZone: 'Zone 3 (130 - 150 bpm) / RPE 7-8',
    volume: `${4 + extraSets} sets × 8-12 reps per exercise${finisherNote}`,
    estCaloriesBurned: Math.round(baseStrengthKcal * 1.1),
    equipment: 'Barbell/Dumbbells, Leg Press / Squat Rack',
    exercises: withFinisher([
      { name: 'Goblet Squats or Barbell Back Squat', sets: addSet('4', extraSets), repsOrDuration: '8-10 reps', notes: 'Drive through mid-foot with depth' },
      { name: 'Romanian Deadlifts (RDL)', sets: addSet('4', extraSets), repsOrDuration: '10-12 reps', notes: 'Hinge hips back, feel hamstring stretch' },
      { name: 'Walking Dumbbell Lunges', sets: '3', repsOrDuration: '12 steps/leg', notes: 'Chest upright, knee tracking toes' },
      { name: 'Standing Calf Raises', sets: '3', repsOrDuration: '15 reps', notes: '2 second pause at top' },
      { name: 'Cable Woodchoppers', sets: '3', repsOrDuration: '15 reps/side', notes: 'Rotational core power' },
    ]),
    coachingTips: 'Compound lower-body movements recruit the largest muscle groups, generating high EPOC (afterburn effect).',
  };

  const zone2Cardio = {
    sessionTitle: cardioTitle,
    workoutType: 'Brisk Walking / Incline Treadmill',
    targetDurationMin: cardioMin,
    targetHeartRateZone: cardioZone,
    volume: `~${cardioKm} km / Incline 4-8%`,
    estCaloriesBurned: baseCardioKcal,
    equipment: 'Outdoor GPS Walking Route or Treadmill',
    exercises: [
      { name: '5-minute Dynamic Mobility Warm-up', sets: '1', repsOrDuration: '5 mins', notes: 'Hip openers, leg swings' },
      { name: 'Steady-State Incline Walk / Outdoor Power Walk', sets: '1', repsOrDuration: `${cardioMin - 10} mins`, notes: isLoss && tier === 3 ? 'Add 4 x 3 min Zone 4 efforts with 3 min easy between' : isLoss && tier === 2 ? 'Hold the upper end of Zone 2 into Zone 3' : 'Keep heart rate in Zone 2 fat-burning threshold' },
      { name: 'Cooldown & Hamstring / Calf Stretches', sets: '1', repsOrDuration: '5 mins', notes: 'Deep nasal breathing' },
    ],
    coachingTips: isGain
      ? 'Keep cardio short and easy in a surplus so calories go to muscle gain; it still supports recovery and heart health.'
      : tier >= 2 && isLoss
        ? 'Higher intensity raises daily burn for this faster pace; fuel with protein and carbs and cut a session short if form or sleep suffers.'
        : 'Zone 2 maximizes mitochondria density and utilizes fatty acids as the primary fuel source without fatiguing central nervous system.',
  };

  const hiitConditioning = {
    sessionTitle: 'High Intensity Interval Training (HIIT) Circuit',
    workoutType: 'High Intensity Interval Training',
    targetDurationMin: hiitMin,
    targetHeartRateZone: 'Zone 4-5 (155 - 175 bpm) / RPE 8.5-9',
    volume: `${Math.max(3, Math.round(hiitMin / 7))} rounds: 45s work / 45s rest`,
    estCaloriesBurned: baseHiitKcal,
    equipment: 'Kettlebells, Bodyweight, Battle ropes or Assault bike',
    exercises: [
      { name: 'Kettlebell Swings', sets: '5', repsOrDuration: '45s work', notes: 'Explosive hip extension' },
      { name: 'Medicine Ball Slams', sets: '5', repsOrDuration: '45s work', notes: 'Full body slam with core drive' },
      { name: 'Box Jumps or Step-Ups', sets: '5', repsOrDuration: '45s work', notes: 'Soft landing' },
      { name: 'Row Ergometer or Sprint', sets: '5', repsOrDuration: '45s work', notes: 'All-out sprint effort' },
      { name: 'Active Plank Hold', sets: '5', repsOrDuration: '45s work', notes: 'Stabilize before next round' },
    ],
    coachingTips: 'Push hard during work intervals. Elevates metabolic rate for up to 14 hours post-workout.',
  };

  const activeRecovery = {
    sessionTitle: 'Active Recovery & Functional Mobility',
    workoutType: 'Light Walking & Foam Rolling',
    targetDurationMin: recoveryMin,
    targetHeartRateZone: 'Zone 1 (< 110 bpm)',
    volume: '2 - 3 km easy scenic walk',
    estCaloriesBurned: recoveryKcal,
    equipment: 'Foam roller, Yoga mat',
    exercises: [
      { name: 'Gentle Outdoor Walk', sets: '1', repsOrDuration: '20 mins', notes: 'Promotes blood circulation to sore muscles' },
      { name: 'Thoracic Spine Openers & Foam Rolling', sets: '1', repsOrDuration: '10 mins', notes: 'Quads, IT band, lats' },
    ],
    coachingTips: 'Gentle movement accelerates lactic clearance and supports parasympathetic nervous system recovery.',
  };

  const restDay = {
    sessionTitle: 'Complete Rest & Muscle Restoration',
    workoutType: 'Rest Day',
    targetDurationMin: 0,
    targetHeartRateZone: 'Resting (< 70 bpm)',
    volume: '0 km',
    estCaloriesBurned: 0,
    equipment: 'None',
    exercises: [
      { name: 'Full Rest & Sleep Prioritization', sets: '1', repsOrDuration: '8+ hours sleep', notes: 'Crucial for muscle tissue repair and hormone balance' },
      { name: 'Hydration Target', sets: '1', repsOrDuration: '3.0 - 3.5 Liters water', notes: 'Include electrolytes if sweating heavily during week' },
    ],
    coachingTips: 'Muscles grow and recover during rest. Keep protein intake consistent at 1.6-2.0g per kg of body weight.',
  };

  // Build the 7-day schedule according to chosen frequency and focus
  const week = daysSchedule.map(({ day, activeIndex }) => {
    let session;
    let isRest = false;

    if (daysPerWeek === 3) {
      // 3 days: Mon, Wed, Fri
      if (activeIndex === 0) session = strengthUpper;
      else if (activeIndex === 2) session = strengthLower;
      else if (activeIndex === 4) session = focus === 'cardio' ? zone2Cardio : hiitConditioning;
      else if (activeIndex === 5) session = activeRecovery;
      else {
        session = restDay;
        isRest = true;
      }
    } else if (daysPerWeek === 4) {
      // 4 days: Mon, Tue, Thu, Sat
      if (activeIndex === 0) session = strengthUpper;
      else if (activeIndex === 1) session = zone2Cardio;
      else if (activeIndex === 3) session = strengthLower;
      else if (activeIndex === 5) session = focus === 'cardio' ? zone2Cardio : hiitConditioning;
      else if (activeIndex === 2) session = activeRecovery;
      else {
        session = restDay;
        isRest = true;
      }
    } else if (daysPerWeek === 5) {
      // 5 days: Mon, Tue, Wed, Fri, Sat
      if (activeIndex === 0) session = strengthUpper;
      else if (activeIndex === 1) session = zone2Cardio;
      else if (activeIndex === 2) session = strengthLower;
      else if (activeIndex === 4) session = hiitConditioning;
      else if (activeIndex === 5) session = zone2Cardio;
      else if (activeIndex === 3) session = activeRecovery;
      else {
        session = restDay;
        isRest = true;
      }
    } else {
      // 6 days: Mon - Sat
      if (activeIndex === 0) session = strengthUpper;
      else if (activeIndex === 1) session = zone2Cardio;
      else if (activeIndex === 2) session = strengthLower;
      else if (activeIndex === 3) session = activeRecovery;
      else if (activeIndex === 4) session = hiitConditioning;
      else if (activeIndex === 5) session = zone2Cardio;
      else {
        session = restDay;
        isRest = true;
      }
    }

    return {
      day,
      isRest,
      sessionTitle: session.sessionTitle,
      workoutType: session.workoutType,
      targetDurationMin: session.targetDurationMin,
      targetHeartRateZone: session.targetHeartRateZone,
      volume: session.volume,
      estCaloriesBurned: session.estCaloriesBurned,
      equipment: session.equipment,
      exercises: session.exercises,
      coachingTips: session.coachingTips,
    };
  });

  // Loss goals: calibrate session calories so the week tracks the exercise share of the deficit
  const weeklyTarget = isLoss ? exerciseDeficitKcal * 7 : 0;
  const weeklySum = week.reduce((a, d) => a + d.estCaloriesBurned, 0);
  if (weeklyTarget > 0 && weeklySum > 0) {
    const factor = Math.max(0.75, Math.min(1.4, weeklyTarget / weeklySum));
    week.forEach((d) => {
      if (!d.isRest) d.estCaloriesBurned = Math.max(120, Math.min(900, Math.round(d.estCaloriesBurned * factor)));
    });
  }
  return week;
}
