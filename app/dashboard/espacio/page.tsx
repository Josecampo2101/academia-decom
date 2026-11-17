"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Role = { role_key: string; name: string; district_id: string | null };
type District = { id: string; name: string };
type Enrollment = { id: string; course_id: string; status: string; enrolled_at: string };
type Course = { id: string; title: string; description: string | null; status: string };

const roleCopy: Record<string, { title: string; description: string }> = {
  national_admin: {
    title: "Administración nacional",
    description:
      "Control global de la Academia, los distritos, los accesos y la operación académica.",
  },
  district_coordinator: {
    title: "Dirección distrital",
    description:
      "Seguimiento integral de congregaciones, integrantes, responsables y formación del distrito.",
  },
  area_coordinator: {
    title: "Comité distrital",
    description: "Vista de seguimiento y gestión compartida de la operación del distrito.",
  },
  member: {
    title: "Espacio del estudiante",
    description: "Tu ruta de aprendizaje, cursos asignados y avance académico.",
  },
  academic_editor: {
    title: "Edición académica",
    description: "Construcción, revisión y publicación del contenido formativo autorizado.",
  },
  tutor: {
    title: "Espacio del tutor",
    description: "Acompañamiento de estudiantes y seguimiento de su proceso formativo.",
  },
  local_responsible: {
    title: "Responsable local",
    description: "Seguimiento de integrantes y coordinación de la congregación.",
  },
};

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">{label}</p>
      <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-fg">{detail}</p>
    </article>
  );
}

export default function RoleWorkspacePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    congregations: 0,
    members: 0,
    activeEnrollments: 0,
    publishedCourses: 0,
  });

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          router.replace("/conexion");
          return;
        }
        const user = auth.user;
        const { data: assignments, error: assignmentError } = await supabase
          .from("user_role_assignments")
          .select("role_id,district_id")
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
        const roleIds = [...new Set((assignments ?? []).map((a) => a.role_id))];
        const { data: roleRows, error: roleError } = roleIds.length
          ? await supabase.from("roles").select("id,role_key,name").in("id", roleIds)
          : { data: [], error: null };
        if (roleError) throw roleError;
        const roleMap = new Map((roleRows ?? []).map((r) => [r.id, r]));
        const assignedRoles: Role[] = (assignments ?? []).flatMap((a) => {
          const role = roleMap.get(a.role_id);
          return role
            ? [{ role_key: role.role_key, name: role.name, district_id: a.district_id }]
            : [];
        });
        if (!alive) return;
        setEmail(user.email ?? "");
        setRoles(assignedRoles);

        const isNational = assignedRoles.some((r) => r.role_key === "national_admin");
        const districtIds = [
          ...new Set(assignedRoles.map((r) => r.district_id).filter(Boolean)),
        ] as string[];
        const districtQuery = supabase.from("districts").select("id,name").order("name");
        const { data: districtRows, error: districtError } = isNational
          ? await districtQuery
          : districtIds.length
            ? await districtQuery.in("id", districtIds)
            : { data: [], error: null };
        if (districtError) throw districtError;
        const scopedDistricts = (districtRows ?? []) as District[];
        setDistricts(scopedDistricts);

        if (assignedRoles.some((r) => r.role_key === "member")) {
          const { data: enrollmentRows, error: enrollmentError } = await supabase
            .from("course_enrollments")
            .select("id,course_id,status,enrolled_at")
            .eq("user_id", user.id)
            .order("enrolled_at", { ascending: false });
          if (enrollmentError) throw enrollmentError;
          const rows = (enrollmentRows ?? []) as Enrollment[];
          setEnrollments(rows);
          const courseIds = [...new Set(rows.map((e) => e.course_id))];
          if (courseIds.length) {
            const { data: courseRows, error: courseError } = await supabase
              .from("courses")
              .select("id,title,description,status")
              .in("id", courseIds);
            if (courseError) throw courseError;
            setCourses((courseRows ?? []) as Course[]);
          }
        }

        if (isNational || districtIds.length) {
          let congregationQuery = supabase
            .from("congregations")
            .select("id", { count: "exact", head: true });
          let memberQuery = supabase
            .from("memberships")
            .select("id", { count: "exact", head: true });
          let enrollmentQuery = supabase
            .from("course_enrollments")
            .select("id", { count: "exact", head: true })
            .eq("status", "active");
          let publishedQuery = supabase
            .from("courses")
            .select("id", { count: "exact", head: true })
            .eq("status", "published");
          if (!isNational) {
            congregationQuery = congregationQuery.in("district_id", districtIds);
            const { data: congregationRows, error: congregationError } = await supabase
              .from("congregations")
              .select("id")
              .in("district_id", districtIds);
            if (congregationError) throw congregationError;
            const congregationIds = (congregationRows ?? []).map((c) => c.id);
            memberQuery = congregationIds.length
              ? memberQuery.in("congregation_id", congregationIds)
              : memberQuery.eq("congregation_id", "00000000-0000-0000-0000-000000000000");
            enrollmentQuery = enrollmentQuery.in("district_id", districtIds);
            publishedQuery = publishedQuery.in("district_id", districtIds);
          }
          const [congregations, members, activeEnrollments, publishedCourses] = await Promise.all([
            congregationQuery,
            memberQuery,
            enrollmentQuery,
            publishedQuery,
          ]);
          const failure =
            congregations.error ??
            members.error ??
            activeEnrollments.error ??
            publishedCourses.error;
          if (failure) throw failure;
          setStats({
            congregations: congregations.count ?? 0,
            members: members.count ?? 0,
            activeEnrollments: activeEnrollments.count ?? 0,
            publishedCourses: publishedCourses.count ?? 0,
          });
        } else {
          const { count, error: courseError } = await supabase
            .from("courses")
            .select("id", { count: "exact", head: true })
            .eq("status", "published");
          if (courseError) throw courseError;
          setStats((s) => ({ ...s, publishedCourses: count ?? 0 }));
        }
      } catch (e) {
        console.error(e);
        if (alive) setError(e instanceof Error ? e.message : "No fue posible cargar tu espacio.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [router, supabase]);

  const primaryRole =
    roles.find((r) => r.role_key === "national_admin") ??
    roles.find((r) => r.role_key === "district_coordinator") ??
    roles.find((r) => r.role_key === "area_coordinator") ??
    roles.find((r) => r.role_key === "academic_editor") ??
    roles.find((r) => r.role_key === "tutor") ??
    roles.find((r) => r.role_key === "local_responsible") ??
    roles.find((r) => r.role_key === "member");
  const copy = primaryRole ? roleCopy[primaryRole.role_key] : null;
  const isStudent = roles.some((r) => r.role_key === "member");
  const isDistrict = roles.some((r) =>
    ["national_admin", "district_coordinator", "area_coordinator"].includes(r.role_key),
  );
  const isNational = roles.some((r) => r.role_key === "national_admin");

  if (loading)
    return (
      <main
        id="contenido"
        className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-fg"
      >
        Preparando tu espacio de trabajo...
      </main>
    );

  return (
    <main id="contenido" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-decom-blue text-xl font-black text-white">
              D
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-[0.14em]">ACADEMIA DECOM</p>
              <p className="text-xs text-muted-fg">Centro de trabajo por perfil</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-64 truncate text-xs text-muted-fg sm:block">{email}</span>
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-decom-blue"
            >
              Panel principal
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            No se pudo completar la consulta: {error}
          </div>
        )}

        <section className="mt-8 overflow-hidden rounded-3xl bg-decom-navy px-6 py-9 text-white sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-decom-teal-light">
            Espacio personalizado
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            {copy?.title ?? "Tu espacio en Academia DECOM"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100">
            {copy?.description ??
              "Tu cuenta todavía no tiene un perfil operativo asignado. Solicita al administrador que revise tus accesos."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {roles.map((r, i) => (
              <span
                key={r.role_key + i}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold"
              >
                {r.name}
                {r.district_id ? " · Distrito asignado" : ""}
              </span>
            ))}
          </div>
        </section>

        {isStudent && (
          <section className="mt-7">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Mi formación</h2>
              <p className="mt-1 text-sm text-muted-fg">
                Cursos que te han asignado y estado de tu matrícula.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric
                label="Cursos asignados"
                value={enrollments.length}
                detail="Matrículas registradas en tu cuenta"
              />
              <Metric
                label="En curso"
                value={enrollments.filter((e) => e.status === "active").length}
                detail="Puedes continuar cuando el contenido esté publicado"
              />
              <Metric
                label="Cursos aprobados"
                value={enrollments.filter((e) => e.status === "completed").length}
                detail="La aprobación se confirma mediante el examen final de cada curso"
              />
            </div>
            <div className="mt-4 space-y-3">
              {enrollments.length ? (
                enrollments.map((e) => {
                  const course = courses.find((c) => c.id === e.course_id);
                  return (
                    <article key={e.id} className="rounded-2xl border border-line bg-surface p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{course?.title ?? "Curso asignado"}</h3>
                          <p className="mt-1 text-sm text-muted-fg">
                            {course?.description ?? "Descripción pendiente"}
                          </p>
                        </div>
                        <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-decom-blue-text">
                          {e.status === "active"
                            ? "En curso"
                            : e.status === "completed"
                              ? "Completado"
                              : "Retirado"}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-line bg-surface p-7 text-center">
                  <p className="font-semibold">Todavía no tienes cursos asignados.</p>
                  <p className="mt-1 text-sm text-muted-fg">
                    Cuando la dirección académica registre tu matrícula, aparecerá aquí tu ruta de
                    aprendizaje.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/dashboard/formacion")}
                className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white hover:bg-decom-blue-hover"
              >
                Abrir mi formación
              </button>
              <button
                onClick={() => router.push("/dashboard/estudiante/evaluaciones")}
                className="rounded-xl border border-decom-blue bg-surface px-5 py-3 text-sm font-semibold text-decom-blue-text hover:bg-sky-50"
              >
                Mis evaluaciones
              </button>
            </div>
          </section>
        )}

        {isDistrict && (
          <section className="mt-7">
            <div className="mb-4">
              <h2 className="text-xl font-bold">
                {isNational ? "Resumen nacional" : "Gestión del distrito"}
              </h2>
              <p className="mt-1 text-sm text-muted-fg">
                Indicadores consultados desde los registros autorizados por Supabase.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Distritos visibles"
                value={districts.length}
                detail="Según el alcance de tu rol"
              />
              <Metric
                label="Congregaciones"
                value={stats.congregations}
                detail="En el ámbito autorizado"
              />
              <Metric label="Integrantes" value={stats.members} detail="Membresías registradas" />
              <Metric
                label="Matrículas activas"
                value={stats.activeEnrollments}
                detail="Estudiantes en formación"
              />
              <Metric
                label="Cursos publicados"
                value={stats.publishedCourses}
                detail="Oferta académica disponible"
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <button
                onClick={() => router.push("/dashboard/congregaciones")}
                className="rounded-2xl border border-line bg-surface p-5 text-left hover:border-decom-blue"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-decom-blue-text">
                  Administración territorial
                </span>
                <h3 className="mt-2 font-bold">Congregaciones e integrantes</h3>
                <p className="mt-1 text-sm text-muted-fg">
                  Consultar y gestionar los registros según el alcance del distrito.
                </p>
              </button>
              <button
                onClick={() => router.push("/dashboard/reubicaciones")}
                className="rounded-2xl border border-line bg-surface p-5 text-left hover:border-decom-blue"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-decom-blue-text">
                  Operación distrital
                </span>
                <h3 className="mt-2 font-bold">Reubicación de creyentes</h3>
                <p className="mt-1 text-sm text-muted-fg">
                  Traslados, historial y revisión de responsabilidades.
                </p>
              </button>
              <button
                onClick={() => router.push("/dashboard/matriculas")}
                className="rounded-2xl border border-line bg-surface p-5 text-left hover:border-decom-blue"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-decom-blue-text">
                  Gestión académica
                </span>
                <h3 className="mt-2 font-bold">Matrículas de estudiantes</h3>
                <p className="mt-1 text-sm text-muted-fg">
                  Asignar cursos publicados y consultar el estado de cada matrícula.
                </p>
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-bold">Distritos bajo tu alcance</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {districts.map((d) => (
                  <span
                    key={d.id}
                    className="rounded-full bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {roles.some((r) =>
          [
            "tutor",
            "academic_editor",
            "district_coordinator",
            "area_coordinator",
            "national_admin",
          ].includes(r.role_key),
        ) && (
          <section className="mt-7 rounded-2xl border border-decom-teal/30 bg-surface p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-decom-teal-text">
              Diseño de experiencias de aprendizaje
            </p>
            <h2 className="mt-2 text-xl font-bold">Planner académico y creación de clases</h2>
            <p className="mt-2 text-sm text-muted-fg">
              Estructura sesiones, define temas y resultados de aprendizaje, organiza la secuencia
              didáctica y adjunta documentos, presentaciones, imágenes, audio, video o guías.
            </p>
            <button
              onClick={() => router.push("/dashboard/planificador")}
              className="mt-4 rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
            >
              Abrir planner académico
            </button>
          </section>
        )}

        {roles.some((r) => r.role_key === "academic_editor") && (
          <section className="mt-7 rounded-2xl border border-line bg-surface p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-decom-blue-text">
              Contenido y currículo
            </p>
            <h2 className="mt-2 text-xl font-bold">Administración del catálogo académico</h2>
            <p className="mt-2 text-sm text-muted-fg">
              Crea programas, cursos, módulos y lecciones; los cambios se mantienen como borradores
              hasta su publicación autorizada.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/dashboard/administracion/catalogo")}
                className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
              >
                Abrir editor académico
              </button>
              <button
                onClick={() => router.push("/dashboard/revision-academica")}
                className="rounded-xl border border-decom-blue bg-surface px-5 py-3 text-sm font-semibold text-decom-blue-text"
              >
                Revisar planificaciones
              </button>
            </div>
          </section>
        )}

        {isNational && (
          <section className="mt-7 rounded-2xl border border-decom-teal/30 bg-decom-teal/5 p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-decom-teal-text">
              Control global
            </p>
            <h2 className="mt-2 text-xl font-bold">Administración nacional</h2>
            <p className="mt-2 text-sm text-muted-fg">
              Tu rol tiene alcance global. La gestión de roles, configuración institucional y
              publicación académica debe permanecer restringida a esta autorización.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white hover:bg-decom-blue-hover"
              >
                Panel de administración
              </button>
              <button
                onClick={() => router.push("/dashboard/administracion/catalogo")}
                className="rounded-xl border border-decom-blue bg-surface px-5 py-3 text-sm font-semibold text-decom-blue-text"
              >
                Catálogo académico
              </button>
              <button
                onClick={() => router.push("/dashboard/revision-academica")}
                className="rounded-xl border border-decom-blue bg-surface px-5 py-3 text-sm font-semibold text-decom-blue-text"
              >
                Revisión académica
              </button>
              <button
                onClick={() => router.push("/dashboard/matriculas")}
                className="rounded-xl border border-decom-blue bg-surface px-5 py-3 text-sm font-semibold text-decom-blue-text"
              >
                Matrículas
              </button>
            </div>
          </section>
        )}

        {roles.some((r) => r.role_key === "tutor") && (
          <section className="mt-7 rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-xl font-bold">Acompañamiento tutorial</h2>
            <p className="mt-2 text-sm text-muted-fg">
              Consulta tus planificaciones, identifica las que requieren ajustes y continúa
              preparando clases y materiales.
            </p>
            <button
              onClick={() => router.push("/dashboard/tutor")}
              className="mt-4 rounded-xl bg-decom-blue px-5 py-3 text-sm font-semibold text-white"
            >
              Abrir espacio del tutor
            </button>
          </section>
        )}

        <footer className="py-9 text-center text-xs text-muted-fg">
          Academia DECOM · Formación para comunicar con propósito.
        </footer>
      </div>
    </main>
  );
}
