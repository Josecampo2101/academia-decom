export type BadgeTier = "bronze" | "silver" | "gold";
export type BadgeCategory = "learning" | "practice" | "assessment" | "consistency" | "program";
export type ProgressMetric =
  | "lessonsCompleted"
  | "activitiesSubmitted"
  | "activitiesGraded"
  | "assessmentsPassed"
  | "longestStreakDays"
  | "coursesCompleted";

export type StudentProgress = Record<ProgressMetric, number>;

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  tier: BadgeTier;
  points: number;
  icon: string;
  metric: ProgressMetric;
  target: number;
}

export interface EvaluatedBadge extends BadgeDefinition {
  current: number;
  earned: boolean;
  percent: number;
  remaining: number;
}

export interface LevelInfo {
  index: number;
  name: string;
  min: number;
  nextName: string | null;
  nextMin: number | null;
  pointsToNext: number;
  percent: number;
}

export interface RecognitionSummary {
  earnedCount: number;
  total: number;
  points: number;
  level: LevelInfo;
  nextBadge: EvaluatedBadge | null;
}

export const TIERS: Record<BadgeTier, string>;
export const CATEGORIES: Record<BadgeCategory, string>;
export const METRIC_LABELS: Record<ProgressMetric, [string, string]>;
export function metricLabel(metric: ProgressMetric, amount: number): string;
export const BADGE_CATALOG: BadgeDefinition[];
export const LEVELS: { name: string; min: number }[];
export const EMPTY_PROGRESS: StudentProgress;
export const DEMO_PROGRESS: StudentProgress;

export function longestStreak(dates: Array<string | Date | null | undefined>): number;
export function buildProgress(input?: {
  lessonCompletedAt?: Array<string | null>;
  submissions?: Array<{
    assignment_id?: string | null;
    status?: string | null;
    submitted_at?: string | null;
  }>;
  attempts?: Array<{
    assessment_id?: string | null;
    passed?: boolean | null;
    submitted_at?: string | null;
  }>;
  enrollments?: Array<{
    course_id?: string | null;
    status?: string | null;
    completed_at?: string | null;
  }>;
}): StudentProgress;
export function evaluateBadges(
  progress: Partial<StudentProgress>,
  catalog?: BadgeDefinition[],
): EvaluatedBadge[];
export function levelFor(points: number, levels?: { name: string; min: number }[]): LevelInfo;
export function summarizeRecognitions(evaluated: EvaluatedBadge[]): RecognitionSummary;
