"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Course = { id: string; title: string; district_id: string; status: string };
type Tutor = { user_id: string; full_name: string; phone: string | null };
type Assignment = {
  id: string;
  course_id: string;
  district_id: string;
  tutor_user_id: string;
  status: string;
  assigned_at: string;
  notes: string | null;
};

export default function CourseTutorAssignmentsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [tutors, setTutors] = useState<Record<string, Tutor[]>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courseId, setCourseId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      setLoading(true);
      setError("");
      if (authError || !user) {
        router.replace("/conexion");
        return;
      }
      const { data: roleAssignments, error: roleError } = await supabase
        .from("user_role_assignments")
        .select("role_id,district_id")
        .eq("user_id", user.id);
      if (roleError) throw roleError;
      const roleIds = [...new Set((roleAssignments ?? []).map((x) => x.role_id))];
      const { data: roles, error: rolesError } = roleIds.length
        ? await supabase.from("roles").select("id,role_key").in("id", roleIds)
        : { data: [], error: null };
      if (rolesError) throw rolesError;
      const roleById = new Map((roles ?? []).map((x) => [x.id, x.role_key]));
      const global = (roleAssignments ?? []).some(
        (x) => roleById.get(x.role_id) === "national_admin",
      );
      const districtIds = [
        ...new Set(
          (roleAssignments ?? [])
            .filter(
              (x) =>
                ["district_coordinator", "area_coordinator", "academic_editor"].includes(
                  roleById.get(x.role_id) ?? "",
                ) && x.district_id,
            )
            .map((x) => x.district_id as string),
        ),
      ];
      if (!global && !districtIds.length)
        throw new Error("Esta sección requiere administración académica o coordinación distrital.");
      let courseQuery = supabase
        .from("courses")
        .select("id,title,district_id,status")
        .order("title");
      if (!global) courseQuery = courseQuery.in("district_id", districtIds);
      const { data: courseRows, error: courseError } = await courseQuery;
      if (courseError) throw courseError;
      const list = (courseRows ?? []) as Course[];
      setCourses(list);
      const ids = [...new Set(list.map((x) => x.district_id))];
      const candidateEntries = await Promise.all(
        ids.map(async (districtId) => {
          const { data, error: candidateError } = await supabase.rpc(
            "get_course_tutor_candidates",
            { p_district_id: districtId },
          );
          if (candidateError) throw candidateError;
          return [districtId, (data ?? []) as Tutor[]] as const;
        }),
      );
      const candidateMap = Object.fromEntries(candidateEntries);
      setTutors(candidateMap);
      const { data: assignmentRows, error: assignmentError } = list.length
        ? await supabase
            .from("academic_course_tutor_assignments")
            .select("id,course_id,district_id,tutor_user_id,status,assigned_at,notes")
            .in(
              "course_id",
              list.map((x) => x.id),
            )
            .order("assigned_at", { ascending: false })
        : { data: [], error: null };
      if (assignmentError) throw assignmentError;
      setAssignments((assignmentRows ?? []) as Assignment[]);
      setCourseId((current) =>
        list.some((x) => x.id === current) ? current : (list[0]?.id ?? ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible cargar las asignaciones.");
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
    });
    return () => {
      active = false;
    };
  }, [load]);
  const selectedCourse = courses.find((x) => x.id === courseId);
  const candidates = selectedCourse ? (tutors[selectedCourse.district_id] ?? []) : [];
  const activeAssignments = assignments.filter((x) => x.status === "active");
  const assignedForCourse = assignments.filter((x) => x.course_id === courseId);
  const assignedTutorIds = new Set(
    assignedForCourse.filter((x) => x.status === "active").map((x) => x.tutor_user_id),
  );
  const availableCandidates = candidates.filter((x) => !assignedTutorIds.has(x.user_id));

  async function assignTutor() {
    if (!selectedCourse || !tutorId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("La sesión expiró.");
      const { error: insertError } = await supabase
        .from("academic_course_tutor_assignments")
        .insert({
          district_id: selectedCourse.district_id,
          course_id: selectedCourse.id,
          tutor_user_id: tutorId,
          assigned_by: user.id,
          notes: notes.trim() || null,
        });
      if (insertError) throw insertError;
      setTutorId("");
      setNotes("");
      setNotice("Tutor asignado al curso.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible asignar el tutor.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(item: Assignment) {
    if (!window.confirm("¿Revocar la asignación de este tutor? El historial se conservará."))
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("La sesión expiró.");
      const { error: updateError } = await supabase
        .from("academic_course_tutor_assignments")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        })
        .eq("id", item.id)
        .eq("status", "active");
      if (updateError) throw updateError;
      setNotice("Asignación revocada; el registro histórico permanece.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible revocar la asignación.");
    } finally {
      setSaving(false);
    }
  }

  function tutorName(item: Assignment) {
    return (
      (tutors[item.district_id] ?? []).find((x) => x.user_id === item.tutor_user_id)?.full_name ??
      "Tutor"
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.push("/dashboard/administracion")}
          className="text-sm font-semibold text-decom-blue-text"
        >
          ← Administración
        </button>
        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-decom-teal-text">
            Gestión académica
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">Asignación de tutores</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-fg">
            Vincula tutores con cursos concretos. Las asignaciones se conservan como historial
            cuando se revocan.
          </p>
        </header>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}
        {loading ? (
          <div className="mt-8 rounded-2xl bg-surface p-8 text-sm text-muted-fg">
            Cargando cursos y tutores…
          </div>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-bold">Nueva asignación</h2>
              <label className="mt-5 block text-xs font-bold text-muted-fg">Curso</label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setTutorId("");
                }}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
              >
                {courses.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
              <label className="mt-4 block text-xs font-bold text-muted-fg">
                Tutor disponible en el distrito
              </label>
              <select
                value={tutorId}
                onChange={(e) => setTutorId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm"
              >
                <option value="">Seleccionar tutor</option>
                {availableCandidates.map((x) => (
                  <option key={x.user_id} value={x.user_id}>
                    {x.full_name}
                    {x.phone ? " · " + x.phone : ""}
                  </option>
                ))}
              </select>
              <label className="mt-4 block text-xs font-bold text-muted-fg">
                Observaciones (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
                placeholder="Responsabilidades o alcance de la tutoría"
              />
              <button
                disabled={!courseId || !tutorId || saving}
                onClick={() => void assignTutor()}
                className="mt-5 w-full rounded-xl bg-decom-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Asignar tutor al curso"}
              </button>
              {!availableCandidates.length && (
                <p className="mt-3 text-xs text-amber-700">
                  {candidates.length
                    ? "Todos los tutores activos ya están asignados a este curso."
                    : "No hay tutores activos disponibles en el distrito seleccionado."}
                </p>
              )}
            </section>
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Asignaciones del curso</h2>
                <span className="text-xs text-muted-fg">
                  {activeAssignments.length} activas en total
                </span>
              </div>
              {!assignedForCourse.length ? (
                <p className="mt-5 rounded-xl bg-surface-muted p-5 text-sm text-muted-fg">
                  Este curso aún no tiene asignaciones registradas.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {assignedForCourse.map((item) => (
                    <article key={item.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{tutorName(item)}</p>
                          <p className="mt-1 text-xs text-muted-fg">
                            {item.status === "active" ? "Activa" : "Revocada"} ·{" "}
                            {new Date(item.assigned_at).toLocaleDateString("es-CO")}
                          </p>
                          {item.notes && (
                            <p className="mt-2 text-xs text-muted-fg">{item.notes}</p>
                          )}
                        </div>
                        {item.status === "active" && (
                          <button
                            disabled={saving}
                            onClick={() => void revoke(item)}
                            className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
