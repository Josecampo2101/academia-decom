export type RouteState = "completed" | "in_progress" | "not_started";
export type EventStatus =
  | "completed"
  | "submitted"
  | "graded"
  | "changes_requested"
  | "passed"
  | "not_passed"
  | "in_review";

export interface CourseRoute {
  enrollmentId: string;
  courseId: string;
  title: string;
  sortOrder: number;
  total: number;
  done: number;
  percent: number;
  state: RouteState;
  nextLessonTitle: string | null;
}

export interface PendingActivity {
  assignmentId: string;
  title: string;
  dueAt: string | null;
  reason: "to_deliver" | "changes_requested";
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  status: EventStatus;
}

export interface NextStep {
  kind: "activity" | "lesson" | "assessment";
  title: string;
  detail: string;
  href: string;
}

export interface TrackingInput {
  enrollments?: Array<{
    id: string;
    course_id: string;
    status?: string | null;
    completed_at?: string | null;
  }>;
  courses?: Array<{ id: string; title: string; sort_order?: number | null }>;
  modules?: Array<{ id: string; course_id: string; sort_order?: number | null; title?: string }>;
  lessons?: Array<{ id: string; module_id: string; title: string; sort_order?: number | null }>;
  progress?: Array<{
    enrollment_id: string;
    lesson_id: string;
    status: string;
    completed_at?: string | null;
  }>;
  assignments?: Array<{ id: string; activity_id: string; due_at?: string | null }>;
  activities?: Array<{ id: string; title: string; due_at?: string | null }>;
  submissions?: Array<{
    activity_id: string;
    assignment_id?: string | null;
    attempt_number?: number | null;
    status: string;
    submitted_at?: string | null;
    reviewed_at?: string | null;
  }>;
  attempts?: Array<{
    assessment_id: string;
    passed?: boolean | null;
    submitted_at?: string | null;
  }>;
  assessments?: Array<{ id: string; title: string }>;
}

export interface Tracking {
  routes: CourseRoute[];
  overall: { total: number; done: number; percent: number };
  pending: PendingActivity[];
  recent: TimelineEvent[];
  nextSteps: NextStep[];
}

export function orderedLessons(
  courseId: string,
  modules: NonNullable<TrackingInput["modules"]>,
  lessons: NonNullable<TrackingInput["lessons"]>,
): NonNullable<TrackingInput["lessons"]>;
export function buildCourseRoutes(data: TrackingInput): CourseRoute[];
export function overallProgress(routes: CourseRoute[]): {
  total: number;
  done: number;
  percent: number;
};
export function pendingActivities(data: TrackingInput): PendingActivity[];
export function recentActivity(data: TrackingInput, limit?: number): TimelineEvent[];
export function nextSteps(input: { routes: CourseRoute[]; pending: PendingActivity[] }): NextStep[];
export function buildTracking(data: TrackingInput): Tracking;
