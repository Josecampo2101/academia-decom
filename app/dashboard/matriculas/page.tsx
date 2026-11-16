"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type District = { id: string; name: string };
type Congregation = { id: string; name: string };
type Member = {
  id: string;
  user_id: string;
  congregation_id: string;
  full_name: string;
  phone: string | null;
  congregation_name: string;
};
type Course = { id: string; title: string; program_id: string };
type Enrollment = {
  id: string;
  user_id: string;
  course_id: string;
  status: "active" | "completed" | "withdrawn";
  enrolled_at: string;
};

export default function EnrollmentManagementPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtId, setDistrictId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [memberId, setMemberId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");

  const loadDistrictData = useCallback(
    async (id: string) => {
      if (!id) {
        setMembers([]);
        setCourses([]);
        setEnrollments([]);
        return;
      }
      setError("");
      const { data: congregationRows, error: congregationError } = await supabase
        .from("congregations")
        .select("id,name")
        .eq("district_id", id)
        .eq("status", "active")
        .order("name");
      if (congregationError) throw congregationError;
      const congregationData = (congregationRows ?? []) as Congregation[];
      const congregationIds = congregationData.map((c) => c.id);
      if (!congregationIds.length) {
        setMembers([]);
        setCourses([]);
        setEnrollments([]);
        return;
      }
      const { data: membershipRows, error: membershipError } = await supabase
        .from("memberships")
        .select("id,user_id,congregation_id")
        .in("congregation_id", congregationIds)
        .eq("member_status", "active");
      if (membershipError) throw membershipError;
      const memberships = (membershipRows ?? []) as {
        id: string;
        user_id: string;
        congregation_id: string;
      }[];
      const memberUserIds = [...new Set(memberships.map((m) => m.user_id))];
      const { data: profileRows, error: profileError } = memberUserIds.length
        ? await supabase
            .from("profiles")
            .select("id,full_name,phone,status")
            .in("id", memberUserIds)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const profiles = new Map(
        (profileRows ?? []).filter((p) => p.status === "active").map((p) => [p.id, p]),
      );
      const congregationMap = new Map(congregationData.map((c) => [c.id, c.name]));
      const memberData: Member[] = memberships
        .flatMap((m) => {
          const profile = profiles.get(m.user_id);
          if (!profile) return [];
          return [
            {
              id: m.id,
              user_id: m.user_id,
              congregation_id: m.congregation_id,
              full_name: profile.full_name ?? "Integrante sin nombre",
              phone: profile.phone,
              congregation_name: congregationMap.get(m.congregation_id) ?? "Congregación",
            },
          ];
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
      setMembers(memberData);
      setMemberId((current) =>
        memberData.some((m) => m.user_id === current) ? current : (memberData[0]?.user_id ?? ""),
      );
      const { data: programRows, error: programError } = await supabase
        .from("academic_programs")
        .select("id")
        .eq("district_id", id)
        .eq("status", "published");
      if (programError) throw programError;
      const programIds = (programRows ?? []).map((p) => p.id);
      const { data: courseRows, error: courseError } = programIds.length
        ? await supabase
            .from("courses")
            .select("id,title,program_id")
            .eq("district_id", id)
            .eq("status", "published")
            .in("program_id", programIds)
            .order("sort_order")
        : { data: [], error: null };
      if (courseError) throw courseError;
      const courseData = (courseRows ?? []) as Course[];
      setCourses(courseData);
      setCourseId((current) =>
        courseData.some((c) => c.id === current) ? current : (courseData[0]?.id ?? ""),
      );
      const { data: enrollmentRows, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select("id,user_id,course_id,status,enrolled_at")
        .eq("district_id", id)
        .order("enrolled_at", { ascending: false });
      if (enrollmentError) throw enrollmentError;
      setEnrollments((enrollmentRows ?? []) as Enrollment[]);
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;
    async function init() {
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
        const roleIds = [...new Set((assignments ?? []).map((a) => a.role_id))];
        const { data: roleRows, error: roleError } = roleIds.length
          ? await supabase.from("roles").select("id,role_key").in("id", roleIds)
          : { data: [], error: null };
        if (roleError) throw roleError;
        const roleMap = new Map((roleRows ?? []).map((r) => [r.id, r.role_key]));
        const national = (assignments ?? []).some(
          (a) =>
            roleMap.get(a.role_id) === "national_admin" && !a.district_id && !a.congregation_id,
        );
        const districtAssignments = (assignments ?? []).filter((a) =>
          ["district_coordinator", "area_coordinator"].includes(roleMap.get(a.role_id)),
        );
        const ids = [
          ...new Set(districtAssignments.map((a) => a.district_id).filter(Boolean)),
        ] as string[];
        if (!national && !ids.length) {
          router.replace("/acceso-denegado");
          return;
        }
        let query = supabase
          .from("districts")
          .select("id,name")
          .eq("status", "active")
          .order("name");
        if (!national) query = query.in("id", ids);
        const { data: rows, error: districtError } = await query;
        if (districtError) throw districtError;
        const districtData = (rows ?? []) as District[];
        if (!active) return;
        setDistricts(districtData);
        setDistrictId(districtData[0]?.id ?? "");
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "No se pudo cargar la gestión de matrículas.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (districtId)
      void Promise.resolve()
        .then(() => loadDistrictData(districtId))
        .catch((e) => setError(e.message));
  }, [districtId, loadDistrictData]);

  async function assign() {
    if (!districtId || !memberId || !courseId) {
      setError("Selecciona un estudiante y un curso publicado.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: insertError } = await supabase
        .from("course_enrollments")
        .upsert(
          { district_id: districtId, course_id: courseId, user_id: memberId, status: "active" },
          { onConflict: "course_id,user_id" },
        );
      if (insertError) throw insertError;
      await loadDistrictData(districtId);
      setNotice("Matrícula registrada o reactivada correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible asignar el curso.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(enrollment: Enrollment, status: "active" | "withdrawn") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase
        .from("course_enrollments")
        .update({ status, completed_at: null })
        .eq("id", enrollment.id);
      if (updateError) throw updateError;
      await loadDistrictData(districtId);
      setNotice(status === "active" ? "Matrícula reactivada." : "Matrícula retirada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible actualizar la matrícula.");
    } finally {
      setSaving(false);
    }
  }

  const visibleMembers = members.filter((m) =>
    (m.full_name + " " + m.congregation_name + " " + (m.phone ?? ""))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedCourse = courses.find((c) => c.id === courseId);
  const selectedMember = members.find((m) => m.user_id === memberId);
  const activeCount = enrollments.filter((e) => e.status === "active").length;
  const courseName = (id: string) => courses.find((c) => c.id === id)?.title ?? "Curso";
  const memberName = (id: string) =>
    members.find((m) => m.user_id === id)?.full_name ?? "Integrante";
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-fg">
        Cargando matrículas...
      </main>
    );
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-decom-blue-text">
              Academia DECOM · Gestión académica
            </p>
            <h1 className="mt-2 text-3xl font-bold">Matrículas de estudiantes</h1>
            <p className="mt-2 text-sm text-muted-fg">
              Asigna cursos publicados a integrantes activos de las congregaciones de tu distrito.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/espacio")}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold"
          >
            Volver a mi espacio
          </button>
        </header>
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800"
          >
            {notice}
          </div>
        )}
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase text-muted-fg">Distritos autorizados</p>
            <p className="mt-2 text-3xl font-bold">{districts.length}</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase text-muted-fg">Integrantes activos</p>
            <p className="mt-2 text-3xl font-bold">{members.length}</p>
          </article>
          <article className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold uppercase text-muted-fg">Matrículas activas</p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
          </article>
        </div>
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <h2 className="text-lg font-bold">1. Selecciona el ámbito</h2>
          <label className="mt-4 block max-w-md text-sm font-semibold">
            Distrito
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <h2 className="mt-7 text-lg font-bold">2. Asignar un curso</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Solo aparecen cursos cuyo programa y publicación están activos.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold">
              Estudiante
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
              >
                {visibleMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} · {m.congregation_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Curso publicado
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block max-w-xl text-sm font-semibold">
            Buscar integrante
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, congregación o teléfono"
              className="mt-2 w-full rounded-xl border border-line px-3 py-3 text-sm"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4">
            <p className="text-sm text-muted-fg">
              {selectedMember ? selectedMember.full_name : "Selecciona un estudiante"}
              {selectedCourse ? " · " + selectedCourse.title : ""}
            </p>
            <button
              disabled={
                saving ||
                !memberId ||
                !courseId ||
                !visibleMembers.some((m) => m.user_id === memberId)
              }
              onClick={() => void assign()}
              className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Asignar curso"}
            </button>
          </div>
          {!courses.length && (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              No hay cursos publicados disponibles en este distrito. Primero publica el programa y
              el curso desde el catálogo académico.
            </p>
          )}
          {!members.length && (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              No hay integrantes activos con perfil disponible en las congregaciones activas de este
              distrito.
            </p>
          )}
        </section>
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">3. Matrículas registradas</h2>
              <p className="mt-1 text-sm text-muted-fg">
                Puedes reactivar o retirar una matrícula sin borrar el historial.
              </p>
            </div>
            <span className="text-sm text-muted-fg">{enrollments.length} registros</span>
          </div>
          {!enrollments.length ? (
            <p className="mt-5 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted-fg">
              Todavía no hay matrículas para este distrito.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase text-muted-fg">
                    <th className="px-3 py-3">Estudiante</th>
                    <th className="px-3 py-3">Curso</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-line-soft">
                      <td className="px-3 py-4 font-semibold">{memberName(e.user_id)}</td>
                      <td className="px-3 py-4">{courseName(e.course_id)}</td>
                      <td className="px-3 py-4">
                        {e.status === "active"
                          ? "Activa"
                          : e.status === "completed"
                            ? "Completada"
                            : "Retirada"}
                      </td>
                      <td className="px-3 py-4">
                        {new Date(e.enrolled_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-3 py-4">
                        {e.status === "withdrawn" ? (
                          <button
                            disabled={saving}
                            onClick={() => void changeStatus(e, "active")}
                            className="text-xs font-semibold text-decom-blue-text"
                          >
                            Reactivar
                          </button>
                        ) : e.status === "active" ? (
                          <button
                            disabled={saving}
                            onClick={() => void changeStatus(e, "withdrawn")}
                            className="text-xs font-semibold text-amber-700"
                          >
                            Retirar
                          </button>
                        ) : (
                          <span className="text-xs text-muted-fg">Cerrada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
