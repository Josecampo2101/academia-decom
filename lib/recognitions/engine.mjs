// Motor de insignias y reconocimientos: funciones puras, sin dependencias, probadas con node:test.
// Las insignias se CALCULAN a partir del progreso del estudiante; no se almacenan (no requiere cambios en la base).
// IMPORTANTE: los umbrales, puntos y niveles son una PROPUESTA de diseño. Deben validarse con la coordinación de DECOM.

export const TIERS = { bronze: "Bronce", silver: "Plata", gold: "Oro" };

export const CATEGORIES = {
  learning: "Aprendizaje",
  practice: "Práctica",
  assessment: "Evaluación",
  consistency: "Constancia",
  program: "Programa",
};

/** Nombre legible de cada métrica de progreso: [singular, plural]. */
export const METRIC_LABELS = {
  lessonsCompleted: ["lección completada", "lecciones completadas"],
  activitiesSubmitted: ["actividad entregada", "actividades entregadas"],
  activitiesGraded: ["actividad calificada", "actividades calificadas"],
  assessmentsPassed: ["evaluación superada", "evaluaciones superadas"],
  longestStreakDays: ["día seguido de actividad", "días seguidos de actividad"],
  coursesCompleted: ["curso completado", "cursos completados"],
};

/** Etiqueta de una métrica concordando con la cantidad (1 curso completado, 3 cursos completados). */
export function metricLabel(metric, amount) {
  const [singular, plural] = METRIC_LABELS[metric];
  return amount === 1 ? singular : plural;
}

/** Catálogo de insignias. `icon` es el nombre de un icono de Lucide (ver components/recognitions/icons.ts). */
export const BADGE_CATALOG = [
  {
    id: "first-lesson",
    title: "Primera lección",
    description: "Completaste tu primera lección de formación.",
    category: "learning",
    tier: "bronze",
    points: 10,
    icon: "BookOpen",
    metric: "lessonsCompleted",
    target: 1,
  },
  {
    id: "steady-learner",
    title: "Aprendiz constante",
    description: "Completaste cinco lecciones de formación.",
    category: "learning",
    tier: "silver",
    points: 25,
    icon: "Library",
    metric: "lessonsCompleted",
    target: 5,
  },
  {
    id: "learning-marathon",
    title: "Maratón formativo",
    description: "Completaste quince lecciones de formación.",
    category: "learning",
    tier: "gold",
    points: 60,
    icon: "Rocket",
    metric: "lessonsCompleted",
    target: 15,
  },
  {
    id: "first-delivery",
    title: "Primera entrega",
    description: "Entregaste tu primera actividad práctica.",
    category: "practice",
    tier: "bronze",
    points: 15,
    icon: "PenLine",
    metric: "activitiesSubmitted",
    target: 1,
  },
  {
    id: "recognized-practice",
    title: "Práctica reconocida",
    description: "Tres de tus actividades ya fueron calificadas por tu tutor.",
    category: "practice",
    tier: "silver",
    points: 35,
    icon: "ClipboardCheck",
    metric: "activitiesGraded",
    target: 3,
  },
  {
    id: "practice-master",
    title: "Maestría en la práctica",
    description: "Ocho de tus actividades fueron calificadas por tu tutor.",
    category: "practice",
    tier: "gold",
    points: 80,
    icon: "Award",
    metric: "activitiesGraded",
    target: 8,
  },
  {
    id: "first-assessment",
    title: "Evaluación superada",
    description: "Aprobaste tu primera evaluación.",
    category: "assessment",
    tier: "bronze",
    points: 20,
    icon: "BadgeCheck",
    metric: "assessmentsPassed",
    target: 1,
  },
  {
    id: "sharp-mind",
    title: "Mente afinada",
    description: "Aprobaste tres evaluaciones distintas.",
    category: "assessment",
    tier: "silver",
    points: 50,
    icon: "Target",
    metric: "assessmentsPassed",
    target: 3,
  },
  {
    id: "proven-mastery",
    title: "Dominio comprobado",
    description: "Aprobaste seis evaluaciones distintas.",
    category: "assessment",
    tier: "gold",
    points: 100,
    icon: "Trophy",
    metric: "assessmentsPassed",
    target: 6,
  },
  {
    id: "streak-3",
    title: "Tres días seguidos",
    description: "Tuviste actividad de formación durante tres días consecutivos.",
    category: "consistency",
    tier: "bronze",
    points: 15,
    icon: "Flame",
    metric: "longestStreakDays",
    target: 3,
  },
  {
    id: "streak-7",
    title: "Semana de constancia",
    description: "Tuviste actividad de formación durante siete días consecutivos.",
    category: "consistency",
    tier: "silver",
    points: 40,
    icon: "Zap",
    metric: "longestStreakDays",
    target: 7,
  },
  {
    id: "streak-21",
    title: "Hábito de comunicador",
    description: "Tuviste actividad de formación durante veintiún días consecutivos.",
    category: "consistency",
    tier: "gold",
    points: 120,
    icon: "Crown",
    metric: "longestStreakDays",
    target: 21,
  },
  {
    id: "course-complete",
    title: "Curso completado",
    description: "Finalizaste un curso completo de la Escuela.",
    category: "program",
    tier: "silver",
    points: 80,
    icon: "GraduationCap",
    metric: "coursesCompleted",
    target: 1,
  },
  {
    id: "purposeful-communicator",
    title: "Comunicador con propósito",
    description: "Finalizaste tres cursos de la Escuela.",
    category: "program",
    tier: "gold",
    points: 200,
    icon: "Sparkles",
    metric: "coursesCompleted",
    target: 3,
  },
];

/** Niveles según puntos acumulados (propuesta). */
export const LEVELS = [
  { name: "Aprendiz", min: 0 },
  { name: "Practicante", min: 60 },
  { name: "Comunicador", min: 200 },
  { name: "Referente", min: 450 },
  { name: "Mentor", min: 750 },
];

/** Progreso vacío: punto de partida para estudiantes sin actividad. */
export const EMPTY_PROGRESS = {
  lessonsCompleted: 0,
  activitiesSubmitted: 0,
  activitiesGraded: 0,
  assessmentsPassed: 0,
  longestStreakDays: 0,
  coursesCompleted: 0,
};

/** Progreso de ejemplo para la vista previa (claramente marcado como ejemplo en la interfaz). */
export const DEMO_PROGRESS = {
  lessonsCompleted: 7,
  activitiesSubmitted: 4,
  activitiesGraded: 3,
  assessmentsPassed: 1,
  longestStreakDays: 4,
  coursesCompleted: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000; // Colombia: UTC-5, sin horario de verano

/** Racha más larga de días consecutivos con actividad, contando los días en hora de Colombia. */
export function longestStreak(dates) {
  const days = new Set();
  for (const value of dates ?? []) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;
    days.add(Math.floor((time + BOGOTA_OFFSET_MS) / DAY_MS));
  }
  const sorted = [...days].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    if (run > best) best = run;
    previous = day;
  }
  return best;
}

function uniqueCount(items, keyOf) {
  return new Set(items.map((item, index) => keyOf(item) ?? `__${index}`)).size;
}

/**
 * Convierte filas reales de la base de datos en el progreso que usa el motor.
 * - lessonCompletedAt: fechas de lecciones completadas.
 * - submissions: entregas de actividades ({ assignment_id, status, submitted_at }).
 * - attempts: intentos de evaluación ({ assessment_id, passed, submitted_at }).
 * - enrollments: matrículas ({ course_id, status, completed_at }).
 */
export function buildProgress({
  lessonCompletedAt = [],
  submissions = [],
  attempts = [],
  enrollments = [],
} = {}) {
  const delivered = submissions.filter(
    (row) => row.submitted_at || ["submitted", "graded", "changes_requested"].includes(row.status),
  );
  const graded = submissions.filter((row) => row.status === "graded");
  const passed = attempts.filter((row) => row.passed === true);
  const completedCourses = enrollments.filter(
    (row) => row.status === "completed" || row.completed_at,
  );

  return {
    lessonsCompleted: lessonCompletedAt.length,
    activitiesSubmitted: uniqueCount(delivered, (row) => row.assignment_id),
    activitiesGraded: uniqueCount(graded, (row) => row.assignment_id),
    assessmentsPassed: uniqueCount(passed, (row) => row.assessment_id),
    longestStreakDays: longestStreak([
      ...lessonCompletedAt,
      ...submissions.map((row) => row.submitted_at),
      ...attempts.map((row) => row.submitted_at),
    ]),
    coursesCompleted: uniqueCount(completedCourses, (row) => row.course_id),
  };
}

/** Evalúa cada insignia del catálogo contra el progreso. */
export function evaluateBadges(progress, catalog = BADGE_CATALOG) {
  return catalog.map((badge) => {
    const current = Math.max(0, Number(progress?.[badge.metric] ?? 0));
    const earned = current >= badge.target;
    return {
      ...badge,
      current: Math.min(current, badge.target),
      earned,
      percent: Math.min(100, Math.floor((current / badge.target) * 100)),
      remaining: Math.max(0, badge.target - current),
    };
  });
}

/** Nivel actual y avance hacia el siguiente, según puntos. */
export function levelFor(points, levels = LEVELS) {
  let index = 0;
  levels.forEach((level, i) => {
    if (points >= level.min) index = i;
  });
  const current = levels[index];
  const next = levels[index + 1] ?? null;
  return {
    index,
    name: current.name,
    min: current.min,
    nextName: next ? next.name : null,
    nextMin: next ? next.min : null,
    pointsToNext: next ? next.min - points : 0,
    percent: next ? Math.floor(((points - current.min) / (next.min - current.min)) * 100) : 100,
  };
}

/** Resumen: insignias obtenidas, puntos, nivel y la próxima insignia más cercana. */
export function summarizeRecognitions(evaluated) {
  const earned = evaluated.filter((badge) => badge.earned);
  const points = earned.reduce((total, badge) => total + badge.points, 0);
  const pending = evaluated.filter((badge) => !badge.earned);
  const nextBadge =
    [...pending].sort((a, b) => b.percent - a.percent || a.remaining - b.remaining)[0] ?? null;
  return {
    earnedCount: earned.length,
    total: evaluated.length,
    points,
    level: levelFor(points),
    nextBadge,
  };
}
