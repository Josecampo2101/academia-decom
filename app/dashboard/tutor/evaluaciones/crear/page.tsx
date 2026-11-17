"use client";

import { Spinner } from "@/components/ui/Spinner";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Course = { id: string; district_id: string; title: string; sort_order: number };
type Assessment = {
  id: string;
  title: string;
  assessment_type: string;
  status: string;
  passing_score: number;
};
type Question = {
  id: string;
  prompt: string;
  question_type: string;
  points: number;
  sort_order: number;
};

const questionTypes = [
  { value: "single_choice", label: "Selección única" },
  { value: "multiple_choice", label: "Selección múltiple" },
  { value: "true_false", label: "Verdadero o falso" },
  { value: "short_answer", label: "Respuesta corta (revisión manual)" },
] as const;

export default function CreateAssessmentPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [userId, setUserId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [assessmentType, setAssessmentType] = useState<"lesson" | "practice" | "final">("lesson");
  const [passingScore, setPassingScore] = useState("70");
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [timeLimit, setTimeLimit] = useState("30");
  const [questionType, setQuestionType] =
    useState<(typeof questionTypes)[number]["value"]>("single_choice");
  const [prompt, setPrompt] = useState("");
  const [optionsText, setOptionsText] = useState("Opción A\nOpción B\nOpción C");
  const [answerText, setAnswerText] = useState("");
  const [points, setPoints] = useState("1");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAssessments = useCallback(
    async (courseId: string) => {
      if (!courseId) {
        setAssessments([]);
        setSelectedAssessmentId("");
        return;
      }
      const { data, error } = await supabase
        .from("academic_assessments")
        .select("id,title,assessment_type,status,passing_score")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) {
        setNotice(error.message);
        return;
      }
      const rows = (data ?? []) as Assessment[];
      setAssessments(rows);
      setSelectedAssessmentId((current) =>
        rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? ""),
      );
    },
    [supabase],
  );

  const loadQuestions = useCallback(
    async (assessmentId: string) => {
      if (!assessmentId) {
        setQuestions([]);
        return;
      }
      const { data, error } = await supabase
        .from("academic_assessment_questions")
        .select("id,prompt,question_type,points,sort_order")
        .eq("assessment_id", assessmentId)
        .order("sort_order");
      if (error) {
        setNotice(error.message);
        return;
      }
      setQuestions((data ?? []) as Question[]);
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace("/conexion");
          return;
        }
        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id,district_id,congregation_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        const roleIds = [...new Set((assignments ?? []).map((item) => item.role_id))];
        const { data: roles, error: roleError } = await supabase
          .from("roles")
          .select("id,role_key")
          .in("id", roleIds);
        if (roleError) throw roleError;
        const roleMap = new Map((roles ?? []).map((role) => [role.id, role.role_key]));
        const hasTutorRole = (assignments ?? []).some(
          (item) => item.congregation_id === null && roleMap.get(item.role_id) === "tutor",
        );
        const hasCatalogRole = (assignments ?? []).some(
          (item) =>
            item.congregation_id === null &&
            ["academic_editor", "national_admin"].includes(roleMap.get(item.role_id) ?? ""),
        );
        if (!hasTutorRole && !hasCatalogRole) {
          if (active) setAccess("denied");
          return;
        }

        const isNational = (assignments ?? []).some(
          (item) => roleMap.get(item.role_id) === "national_admin" && !item.district_id,
        );
        const districtIds = [
          ...new Set(
            (assignments ?? [])
              .filter(
                (item) =>
                  item.district_id &&
                  item.congregation_id === null &&
                  ["academic_editor", "national_admin"].includes(roleMap.get(item.role_id) ?? ""),
              )
              .map((item) => item.district_id as string),
          ),
        ];

        let assignedCourseIds: string[] | null = null;
        if (!isNational && !hasCatalogRole && hasTutorRole) {
          const { data: tutorCourseRows, error: tutorCourseError } = await supabase
            .from("academic_course_tutor_assignments")
            .select("course_id")
            .eq("tutor_user_id", user.id)
            .eq("status", "active");
          if (tutorCourseError) throw tutorCourseError;
          assignedCourseIds = [...new Set((tutorCourseRows ?? []).map((row) => row.course_id))];
        }

        let courseQuery = supabase
          .from("courses")
          .select("id,district_id,title,sort_order")
          .eq("status", "published")
          .order("sort_order");
        if (!isNational && !hasCatalogRole) {
          if (!assignedCourseIds?.length) {
            if (active) {
              setUserId(user.id);
              setCourses([]);
              setSelectedCourseId("");
              setAccess("allowed");
            }
            return;
          }
          courseQuery = courseQuery.in("id", assignedCourseIds);
        } else if (!isNational) {
          courseQuery = courseQuery.in("district_id", districtIds);
        }
        const { data: courseRows, error: courseError } = await courseQuery;
        if (courseError) throw courseError;
        if (!active) return;
        setUserId(user.id);
        setCourses((courseRows ?? []) as Course[]);
        setSelectedCourseId(courseRows?.[0]?.id ?? "");
        setAccess("allowed");
      } catch (error) {
        console.error("No fue posible cargar el creador de evaluaciones:", error);
        if (active) setAccess("error");
      }
    }
    void Promise.resolve().then(initialize);
    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (selectedCourseId) void Promise.resolve().then(() => loadAssessments(selectedCourseId));
  }, [selectedCourseId, loadAssessments]);

  useEffect(() => {
    if (selectedAssessmentId)
      void Promise.resolve().then(() => loadQuestions(selectedAssessmentId));
  }, [selectedAssessmentId, loadQuestions]);

  const selectedAssessment = assessments.find((item) => item.id === selectedAssessmentId);

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const course = courses.find((item) => item.id === selectedCourseId);
    if (!course || !title.trim()) return;
    setSaving(true);
    setNotice("");
    const { data, error } = await supabase
      .from("academic_assessments")
      .insert({
        district_id: course.district_id,
        course_id: course.id,
        title: title.trim(),
        instructions: instructions.trim() || null,
        assessment_type: assessmentType,
        passing_score: Number(passingScore),
        max_attempts: maxAttempts ? Number(maxAttempts) : null,
        time_limit_minutes: timeLimit ? Number(timeLimit) : null,
        created_by: userId,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setTitle("");
    setInstructions("");
    setNotice("Evaluación creada como borrador. Ahora agrega sus preguntas.");
    await loadAssessments(selectedCourseId);
    setSelectedAssessmentId(data.id);
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssessmentId || !prompt.trim()) return;
    const options =
      questionType === "true_false"
        ? ["Verdadero", "Falso"]
        : ["single_choice", "multiple_choice"].includes(questionType)
          ? optionsText
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
    let answerKey: string | string[] = answerText.trim();
    if (questionType === "multiple_choice") {
      answerKey = answerText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "es"));
    }
    if (
      ["single_choice", "multiple_choice", "true_false"].includes(questionType) &&
      (!options.length || !answerKey || (Array.isArray(answerKey) && !answerKey.length))
    ) {
      setNotice("Configura las opciones y la respuesta correcta antes de guardar.");
      return;
    }
    const selectedKeys = Array.isArray(answerKey) ? answerKey : [answerKey];
    if (questionType !== "short_answer" && selectedKeys.some((value) => !options.includes(value))) {
      setNotice(
        "La respuesta correcta debe coincidir exactamente con una o más opciones disponibles.",
      );
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("save_academic_assessment_question", {
      p_assessment_id: selectedAssessmentId,
      p_question_id: null as unknown as string,
      p_question_type: questionType,
      p_prompt: prompt.trim(),
      p_options: options,
      p_answer_key: answerKey,
      p_points: Number(points),
      p_sort_order: questions.length,
    });
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setPrompt("");
    setAnswerText("");
    setNotice("Pregunta guardada. La clave de respuesta se almacena fuera del esquema público.");
    await loadQuestions(selectedAssessmentId);
  }

  async function publishAssessment() {
    if (!selectedAssessmentId) return;
    setSaving(true);
    const { error } = await supabase.rpc("publish_academic_assessment", {
      p_assessment_id: selectedAssessmentId,
    });
    setSaving(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice("Evaluación publicada. Ya puede aparecer a estudiantes matriculados.");
    await loadAssessments(selectedCourseId);
  }

  if (access === "checking")
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </main>
    );
  if (access !== "allowed")
    return (
      <main id="contenido" className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="max-w-md rounded-3xl bg-surface p-8 text-center">
          <h1 className="text-xl font-bold">
            {access === "error" ? "No pudimos cargar el módulo" : "Acceso restringido"}
          </h1>
          <p className="mt-2 text-sm text-muted-fg">
            Este espacio requiere un rol de tutor, editor académico o administración nacional.
          </p>
          <button
            onClick={() => router.push("/dashboard/tutor")}
            className="mt-5 rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
          >
            Volver
          </button>
        </section>
      </main>
    );

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-decom-blue-text">
              ACADEMIA DECOM
            </p>
            <p className="mt-1 text-xs text-muted-fg">Constructor de evaluaciones</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/tutor/evaluaciones")}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold"
          >
            Volver a revisión
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-7 md:px-8">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-decom-teal-text">
            Instrumentos de evaluación
          </p>
          <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
            Crear evaluación o examen final
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-fg">
            Configura prácticas, evaluaciones por lección y el examen final. La clave de respuestas
            se mantiene en un esquema privado y la calificación se calcula en el servidor.
          </p>
        </section>
        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-5">
            <form
              onSubmit={createAssessment}
              className="space-y-4 rounded-3xl border border-line bg-surface p-5 md:p-6"
            >
              <h2 className="text-base font-bold">1. Datos generales</h2>
              <label className="block text-xs font-semibold">
                Curso publicado
                <select
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Título
                <input
                  required
                  minLength={2}
                  maxLength={180}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej. Examen final de fundamentos"
                  className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                Instrucciones
                <textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold">
                  Tipo
                  <select
                    value={assessmentType}
                    onChange={(event) =>
                      setAssessmentType(event.target.value as typeof assessmentType)
                    }
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
                  >
                    <option value="lesson">Evaluación de lección</option>
                    <option value="practice">Práctica</option>
                    <option value="final">Examen final (desbloquea el siguiente curso)</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold">
                  Nota mínima (%)
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={passingScore}
                    onChange={(event) => setPassingScore(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Intentos máximos
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={maxAttempts}
                    onChange={(event) => setMaxAttempts(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Tiempo (minutos)
                  <input
                    type="number"
                    min="1"
                    max="360"
                    value={timeLimit}
                    onChange={(event) => setTimeLimit(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                  />
                </label>
              </div>
              <button
                disabled={saving || !selectedCourseId}
                className="w-full rounded-xl bg-decom-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Crear borrador"}
              </button>
            </form>
            <div className="rounded-3xl border border-line bg-surface p-5 md:p-6">
              <h2 className="text-base font-bold">2. Evaluaciones del curso</h2>
              <div className="mt-3 space-y-2">
                {assessments.map((assessment) => (
                  <button
                    key={assessment.id}
                    onClick={() => setSelectedAssessmentId(assessment.id)}
                    className={`w-full rounded-xl border p-3 text-left ${selectedAssessmentId === assessment.id ? "border-decom-blue bg-sky-50" : "border-line"}`}
                  >
                    <span className="block text-sm font-semibold">{assessment.title}</span>
                    <span className="mt-1 block text-[11px] text-muted-fg">
                      {assessment.assessment_type === "final"
                        ? "Examen final"
                        : assessment.assessment_type === "practice"
                          ? "Práctica"
                          : "Evaluación de lección"}{" "}
                      · {assessment.status === "published" ? "Publicado" : "Borrador"} · mínimo{" "}
                      {assessment.passing_score}%
                    </span>
                  </button>
                ))}
                {assessments.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line p-4 text-xs text-muted-fg">
                    Todavía no hay evaluaciones en este curso.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <form
              onSubmit={saveQuestion}
              className="space-y-4 rounded-3xl border border-line bg-surface p-5 md:p-6"
            >
              <div>
                <h2 className="text-base font-bold">3. Banco de preguntas</h2>
                <p className="mt-1 text-xs text-muted-fg">
                  Selecciona un borrador para agregar preguntas. Las evaluaciones publicadas quedan
                  bloqueadas.
                </p>
              </div>
              {selectedAssessment && (
                <p className="rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-800">
                  {selectedAssessment.title} ·{" "}
                  {selectedAssessment.status === "published" ? "Publicado" : "Borrador"}
                </p>
              )}
              <label className="block text-xs font-semibold">
                Tipo de pregunta
                <select
                  value={questionType}
                  onChange={(event) => setQuestionType(event.target.value as typeof questionType)}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
                >
                  {questionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Enunciado
                <textarea
                  required
                  minLength={2}
                  maxLength={4000}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                  placeholder="Escribe la pregunta..."
                  className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                />
              </label>
              {["single_choice", "multiple_choice"].includes(questionType) && (
                <label className="block text-xs font-semibold">
                  Opciones (una por línea)
                  <textarea
                    value={optionsText}
                    onChange={(event) => setOptionsText(event.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                  />
                </label>
              )}
              <label className="block text-xs font-semibold">
                {questionType === "multiple_choice"
                  ? "Respuestas correctas (separadas por coma)"
                  : questionType === "short_answer"
                    ? "Guía de respuesta para el tutor"
                    : "Respuesta correcta"}
                <input
                  required
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                  placeholder={
                    questionType === "multiple_choice" ? "Opción A, Opción C" : "Respuesta esperada"
                  }
                  className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                Puntos
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={points}
                  onChange={(event) => setPoints(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
                />
              </label>
              <button
                disabled={saving || !selectedAssessment || selectedAssessment.status !== "draft"}
                className="w-full rounded-xl bg-decom-teal px-4 py-3 text-sm font-bold text-decom-navy disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar pregunta"}
              </button>
            </form>
            {selectedAssessment && (
              <div className="rounded-3xl border border-line bg-surface p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold">Preguntas ({questions.length})</h2>
                  <button
                    disabled={
                      saving || selectedAssessment.status !== "draft" || questions.length === 0
                    }
                    onClick={publishAssessment}
                    className="rounded-xl bg-decom-blue px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40 hover:bg-decom-blue-hover"
                  >
                    Publicar evaluación
                  </button>
                </div>
                <ol className="mt-4 space-y-2">
                  {questions.map((question, index) => (
                    <li key={question.id} className="rounded-xl bg-surface-muted p-3">
                      <p className="text-xs font-semibold">
                        {index + 1}. {question.prompt}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-fg">
                        {questionTypes.find((item) => item.value === question.question_type)
                          ?.label ?? question.question_type}{" "}
                        · {question.points} punto(s)
                      </p>
                    </li>
                  ))}
                </ol>
                {questions.length === 0 && (
                  <p className="mt-3 text-xs text-muted-fg">
                    Agrega al menos una pregunta antes de publicar.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-xs leading-5 text-sky-800"
          >
            {notice}
          </p>
        )}
      </div>
    </main>
  );
}
