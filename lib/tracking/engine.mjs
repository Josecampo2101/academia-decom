// Motor de seguimiento del estudiante: funciones puras (sin dependencias), probadas con node:test.
// Recibe filas reales de la base de datos y calcula avance por curso, pendientes, actividad reciente y próximos pasos.

const DELIVERED = ["submitted", "graded"];
const NEEDS_ACTION = ["changes_requested", "available", "draft"];

function toTime(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? null : time;
}

function byOrder(a, b) {
  return (
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    String(a.title ?? "").localeCompare(String(b.title ?? ""), "es")
  );
}

/** Lecciones de un curso en orden de lectura: por módulo y luego por lección. */
export function orderedLessons(courseId, modules, lessons) {
  const courseModules = modules.filter((module) => module.course_id === courseId).sort(byOrder);
  return courseModules.flatMap((module) =>
    lessons.filter((lesson) => lesson.module_id === module.id).sort(byOrder),
  );
}

/** Avance por curso matriculado. Solo cuentan las lecciones publicadas (el avance nunca supera 100 %). */
export function buildCourseRoutes({
  enrollments = [],
  courses = [],
  modules = [],
  lessons = [],
  progress = [],
}) {
  const routes = enrollments.map((enrollment) => {
    const course = courses.find((item) => item.id === enrollment.course_id);
    const lessonList = orderedLessons(enrollment.course_id, modules, lessons);
    const doneIds = new Set(
      progress
        .filter((row) => row.enrollment_id === enrollment.id && row.status === "completed")
        .map((row) => row.lesson_id),
    );
    const startedIds = new Set(
      progress.filter((row) => row.enrollment_id === enrollment.id).map((row) => row.lesson_id),
    );
    const total = lessonList.length;
    const done = lessonList.filter((lesson) => doneIds.has(lesson.id)).length;
    const started = lessonList.some((lesson) => startedIds.has(lesson.id));
    const finished =
      enrollment.status === "completed" ||
      Boolean(enrollment.completed_at) ||
      (total > 0 && done === total);
    const nextLesson = finished
      ? null
      : (lessonList.find((lesson) => !doneIds.has(lesson.id)) ?? null);

    return {
      enrollmentId: enrollment.id,
      courseId: enrollment.course_id,
      title: course?.title ?? "Curso",
      sortOrder: course?.sort_order ?? 0,
      total,
      done,
      percent: total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0,
      state: finished ? "completed" : done > 0 || started ? "in_progress" : "not_started",
      nextLessonTitle: nextLesson?.title ?? null,
    };
  });
  return routes.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "es"));
}

/** Avance global sumando todos los cursos matriculados. */
export function overallProgress(routes) {
  const total = routes.reduce((sum, route) => sum + route.total, 0);
  const done = routes.reduce((sum, route) => sum + route.done, 0);
  return { total, done, percent: total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0 };
}

/**
 * Actividades por entregar: asignaciones sin entrega, o cuya última entrega requiere acción
 * (cambios solicitados). Ordenadas por fecha límite (las que no tienen fecha, al final).
 */
export function pendingActivities({ assignments = [], activities = [], submissions = [] }) {
  const pending = [];
  for (const assignment of assignments) {
    const activity = activities.find((item) => item.id === assignment.activity_id);
    if (!activity) continue;
    const own = submissions
      .filter(
        (row) =>
          row.assignment_id === assignment.id ||
          (!row.assignment_id && row.activity_id === activity.id),
      )
      .sort(
        (a, b) =>
          (b.attempt_number ?? 0) - (a.attempt_number ?? 0) ||
          (toTime(b.submitted_at) ?? 0) - (toTime(a.submitted_at) ?? 0),
      );
    const latest = own[0];
    const delivered = latest && DELIVERED.includes(latest.status);
    if (delivered) continue;
    pending.push({
      assignmentId: assignment.id,
      title: activity.title,
      dueAt: assignment.due_at ?? activity.due_at ?? null,
      reason:
        latest && NEEDS_ACTION.includes(latest.status) && latest.status === "changes_requested"
          ? "changes_requested"
          : "to_deliver",
    });
  }
  return pending.sort((a, b) => (toTime(a.dueAt) ?? Infinity) - (toTime(b.dueAt) ?? Infinity));
}

/** Línea de tiempo con los últimos eventos reales (lecciones, entregas y evaluaciones). */
export function recentActivity(
  {
    progress = [],
    lessons = [],
    submissions = [],
    activities = [],
    attempts = [],
    assessments = [],
  },
  limit = 6,
) {
  const events = [];
  for (const row of progress) {
    if (row.status !== "completed" || !toTime(row.completed_at)) continue;
    const lesson = lessons.find((item) => item.id === row.lesson_id);
    if (!lesson) continue;
    events.push({
      id: `lesson-${row.lesson_id}-${row.enrollment_id}`,
      date: row.completed_at,
      title: lesson.title,
      description: "Lección completada.",
      status: "completed",
    });
  }
  for (const row of submissions) {
    const activity = activities.find((item) => item.id === row.activity_id);
    if (!activity) continue;
    if (row.status === "graded" && toTime(row.reviewed_at)) {
      events.push({
        id: `graded-${row.activity_id}-${row.attempt_number}`,
        date: row.reviewed_at,
        title: activity.title,
        description: "Tu tutor calificó esta actividad.",
        status: "graded",
      });
    } else if (row.status === "changes_requested" && toTime(row.reviewed_at)) {
      events.push({
        id: `changes-${row.activity_id}-${row.attempt_number}`,
        date: row.reviewed_at,
        title: activity.title,
        description: "Tu tutor pidió ajustes antes de calificar.",
        status: "changes_requested",
      });
    }
    if (DELIVERED.includes(row.status) && toTime(row.submitted_at)) {
      events.push({
        id: `submitted-${row.activity_id}-${row.attempt_number}`,
        date: row.submitted_at,
        title: activity.title,
        description: "Actividad entregada.",
        status: "submitted",
      });
    }
  }
  for (const row of attempts) {
    if (!toTime(row.submitted_at)) continue;
    const assessment = assessments.find((item) => item.id === row.assessment_id);
    if (!assessment) continue;
    events.push({
      id: `attempt-${row.assessment_id}-${row.submitted_at}`,
      date: row.submitted_at,
      title: assessment.title,
      description:
        row.passed === true
          ? "Evaluación superada."
          : row.passed === false
            ? "Evaluación presentada; aún no se alcanza el puntaje mínimo."
            : "Evaluación presentada; en revisión.",
      status: row.passed === true ? "passed" : row.passed === false ? "not_passed" : "in_review",
    });
  }
  return events.sort((a, b) => (toTime(b.date) ?? 0) - (toTime(a.date) ?? 0)).slice(0, limit);
}

/** Hasta tres acciones sugeridas, según lo que realmente está pendiente. */
export function nextSteps({ routes, pending }) {
  const steps = [];
  if (pending.length > 0) {
    const first = pending[0];
    steps.push({
      kind: "activity",
      title:
        first.reason === "changes_requested"
          ? "Ajustar y reenviar actividad"
          : "Entregar actividad pendiente",
      detail: first.title,
      href: "/dashboard/estudiante/actividades",
    });
  }
  const current =
    routes.find((route) => route.state === "in_progress") ??
    routes.find((route) => route.state === "not_started");
  if (current) {
    steps.push({
      kind: "lesson",
      title: current.state === "in_progress" ? "Continuar formación" : "Comenzar formación",
      detail: current.nextLessonTitle
        ? `${current.title} · ${current.nextLessonTitle}`
        : current.title,
      href: "/dashboard/estudiante/formacion",
    });
  }
  steps.push({
    kind: "assessment",
    title: "Practicar con evaluaciones",
    detail: "Refuerza lo aprendido con las evaluaciones disponibles.",
    href: "/dashboard/estudiante/evaluaciones",
  });
  return steps.slice(0, 3);
}

/** Calcula todo el seguimiento a partir de las filas reales. */
export function buildTracking(data) {
  const routes = buildCourseRoutes(data);
  const pending = pendingActivities(data);
  return {
    routes,
    overall: overallProgress(routes),
    pending,
    recent: recentActivity(data),
    nextSteps: nextSteps({ routes, pending }),
  };
}
