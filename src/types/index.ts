export interface UserProfile {
  sex: string | null;
  dob: string | null;
  bloodType: string | null;
  currentWeight: number | null;
  currentBMI: number | null;
  currentLeanMass: number | null;
  totalWorkouts: number;
  totalActiveCalories: number;
  totalSteps: number;
  totalDistanceKm: number;
  dateRange: {
    start: string;
    end: string;
  };
  avgDailySteps30d: number;
  avgActiveKcal30d: number;
  avgBasalKcal30d: number;
  avgRestingHR30d: number;
  recentVO2Max: number;
  workoutTypeCounts: Record<string, number>;
}

export interface DailyMetric {
  date: string;
  steps: number;
  distanceKm: number;
  activeKcal: number;
  basalKcal: number;
  exerciseMinutes: number;
  standMinutes: number;
  flightsClimbed: number;
  avgHeartRate: number | null;
  restingHR: number | null;
  walkingHR: number | null;
  hrv: number | null;
  vo2max: number | null;
  weightKg: number | null;
  bmi: number | null;
  leanMassKg: number | null;
  sleepHours: number;
}

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface GpxRoute {
  filename: string;
  pointCount: number;
  distanceKm: number;
  startPoint: GpxPoint;
  endPoint: GpxPoint;
  points: GpxPoint[];
}

export interface Workout {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  distanceKm: number;
  energyKcal: number;
  routePath?: string | null;
  routeData?: GpxRoute | null;
}

export type TrainingFocus = 'balanced' | 'cardio' | 'strength' | 'fat_loss';

export interface WeightGoalConfig {
  currentWeightKg: number;
  targetWeightKg: number;
  timeframeWeeks: number;
  workoutDaysPerWeek: number;
  trainingFocus: TrainingFocus;
  activityLevel: 'moderate' | 'active' | 'very_active';
}

export interface RoutineExercise {
  day: string;
  isRest: boolean;
  sessionTitle: string;
  workoutType: string;
  targetDurationMin: number;
  targetHeartRateZone: string;
  volume: string;
  estCaloriesBurned: number;
  equipment: string;
  exercises: {
    name: string;
    sets: string;
    repsOrDuration: string;
    notes: string;
  }[];
  coachingTips: string;
}

export interface PlanEvaluation {
  weeklyWeightChangeKg: number;
  totalDeficitKcal: number;
  dailyDeficitKcal: number;
  dietDeficitKcal: number;
  exerciseDeficitKcal: number;
  tdeeKcal: number;
  targetIntakeKcal: number;
  status: 'safe' | 'moderate' | 'aggressive' | 'extreme';
  statusMessage: string;
  recommendedWeeks?: number;
  routine: RoutineExercise[];
  projectedTrajectory: {
    week: number;
    date: string;
    projectedWeightKg: number;
    maintenanceWeightKg: number;
  }[];
}
