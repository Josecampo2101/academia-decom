
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab = "transfer" | "history" | "reviews";

type MembershipResult = {
  membership_id: string;
  full_name: string | null;
  phone: string | null;
  congregation_id: string;
  congregation_name: string;
  district_id: string;
  district_name: string;
  active_area_assignments: number;
};

type Destination = {
  id: string;
  name: string;
  district_id: string;
  district_name: string;
};

type TransferHistory = {
  transfer_id: string;
  membership_id: string;
  member_name: string | null;
  member_phone: string | null;
  from_congregation_id: string;
  from_congregation_name: string;
  from_district_id: string;
  from_district_name: string;
  to_congregation_id: string;
  to_congregation_name: string;
  to_district_id: string;
  to_district_name: string;
  performed_by: string | null;
  performed_by_name: string | null;
  observations: string | null;
  created_at: string;
  total_area_reviews: number;
  pending_area_reviews: number;
};

type AreaReview = {
  review_id: string;
  transfer_id: string;
  area_membership_id: string;
  area_id: string;
  area_name: string;
  area_position: string | null;
  member_name: string | null;
  member_phone: string | null;
  from_congregation_name: string;
  from_district_name: string;
  to_congregation_name: string;
  to_district_name: string;
  review_status: "pending" | "maintained" | "ended";
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  observations: string | null;
  transfer_date: string;
  review_created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "No registrada";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "maintained":
      return "Se mantiene";
    case "ended":
      return "Finalizada";
    default:
      return status;
  }
}

function statusClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
    case "maintained":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "ended":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

export default function ReubicacionesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const [isNationalAdmin, setIsNationalAdmin] = useState(false);
  const [isDistrictCoordinator, setIsDistrictCoordinator] =
    useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("transfer");

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MembershipResult[]>([]);
  const [selected, setSelected] =
    useState<MembershipResult | null>(null);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationId, setDestinationId] = useState("");
  const [observations, setObservations] = useState("");

  const [history, setHistory] = useState<TransferHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const [reviews, setReviews] = useState<AreaReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [reviewObservations, setReviewObservations] = useState("");
  const [resolvingReviewId, setResolvingReviewId] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // =========================================================
  // INICIALIZACIÓN
  // =========================================================

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        setLoading(true);
        setErrorMessage("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/");
          return;
        }

        const { data: nationalResult, error: nationalError } =
          await supabase.rpc("has_role", {
            requested_role: "national_admin",
          });

        if (nationalError) throw nationalError;

        const national = Boolean(nationalResult);

        // La autorización distrital contempla coordinación y comité.
        // has_role exige un distrito concreto; validamos las asignaciones
        // propias y su ámbito territorial antes de cargar los registros.
        const { data: assignments, error: assignmentsError } = await supabase
          .from("user_role_assignments")
          .select("role_id, district_id, congregation_id")
          .eq("user_id", user.id);

        if (assignmentsError) throw assignmentsError;

        const roleIds = [
          ...new Set((assignments ?? []).map((assignment) => assignment.role_id)),
        ];

        const { data: roles, error: rolesError } = roleIds.length
          ? await supabase
              .from("roles")
              .select("id, role_key")
              .in("id", roleIds)
          : { data: [], error: null };

        if (rolesError) throw rolesError;

        const districtRoleIds = new Set(
          (roles ?? [])
            .filter((role) =>
              ["district_coordinator", "area_coordinator"].includes(role.role_key)
            )
            .map((role) => role.id)
        );

        const district = (assignments ?? []).some(
          (assignment) =>
            districtRoleIds.has(assignment.role_id) &&
            Boolean(assignment.district_id) &&
            assignment.congregation_id === null
        );

        if (!national && !district) {
          router.replace("/acceso-denegado");
          return;
        }

        if (!active) return;

        setIsNationalAdmin(national);
        setIsDistrictCoordinator(district);

        const { data: congregations, error: congregationError } =
          await supabase
            .from("congregations")
            .select("id, name, district_id")
            .eq("status", "active")
            .order("name");

        if (congregationError) throw congregationError;

        const congregationRows = congregations ?? [];
        const districtIds = [
          ...new Set(congregationRows.map((c) => c.district_id)),
        ];

        let districtRows: { id: string; name: string }[] = [];

        if (districtIds.length > 0) {
          const { data, error: districtError } = await supabase
            .from("districts")
            .select("id, name")
            .eq("status", "active")
            .in("id", districtIds);

          if (districtError) throw districtError;
          districtRows = data ?? [];
        }

        const districtMap = new Map(
          districtRows.map((d) => [d.id, d.name])
        );

        const availableDestinations: Destination[] =
          congregationRows
            .filter((c) => districtMap.has(c.district_id))
            .map((c) => ({
              id: c.id,
              name: c.name,
              district_id: c.district_id,
              district_name: districtMap.get(c.district_id)!,
            }));

        if (!active) return;

        setDestinations(availableDestinations);
      } catch (error) {
        console.error("Error inicializando reubicaciones:", error);

        if (active) {
          setErrorMessage(
            "No fue posible cargar el módulo. Verifica tu conexión e inténtalo nuevamente."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [supabase, router]);

  // =========================================================
  // BÚSQUEDA DE CREYENTES
  // =========================================================

  async function searchMembers() {
    const term = search.trim();

    setErrorMessage("");
    setSuccessMessage("");
    setSelected(null);
    setDestinationId("");

    if (term.length < 2) {
      setResults([]);
      setErrorMessage(
        "Escribe al menos dos caracteres para realizar la búsqueda."
      );
      return;
    }

    try {
      setSearching(true);

      const { data, error } = await supabase.rpc(
        "search_memberships_for_transfer",
        { p_search: term }
      );

      if (error) throw error;

      setResults((data ?? []) as MembershipResult[]);

      if (!data || data.length === 0) {
        setSuccessMessage(
          "No se encontraron creyentes activos con ese criterio de búsqueda."
        );
      }
    } catch (error) {
      console.error("Error buscando creyentes:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible realizar la búsqueda."
      );
    } finally {
      setSearching(false);
    }
  }

  // Actualiza los resultados sin borrar el mensaje de éxito.
  async function refreshSearchResults() {
    const term = search.trim();

    if (term.length < 2) return;

    const { data, error } = await supabase.rpc(
      "search_memberships_for_transfer",
      { p_search: term }
    );

    if (error) {
      console.error("Error actualizando resultados:", error);
      return;
    }

    setResults((data ?? []) as MembershipResult[]);
  }

  // =========================================================
  // EJECUTAR TRASLADO
  // =========================================================

  async function executeTransfer() {
    if (!selected || !destinationId) {
      setErrorMessage(
        "Selecciona un creyente y una congregación de destino."
      );
      return;
    }

    if (destinationId === selected.congregation_id) {
      setErrorMessage(
        "La congregación de destino debe ser diferente a la actual."
      );
      return;
    }

    const destination = destinations.find(
      (item) => item.id === destinationId
    );

    if (!destination) {
      setErrorMessage("La congregación seleccionada no es válida.");
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas el traslado de ${selected.full_name ?? "este creyente"}?\n\n` +
        `Origen: ${selected.congregation_name} (${selected.district_name})\n` +
        `Destino: ${destination.name} (${destination.district_name})`
    );

    if (!confirmed) return;

    try {
      setTransferring(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase.rpc(
        "transfer_membership",
        {
          p_membership_id: selected.membership_id,
          p_to_congregation_id: destinationId,
          p_observations: observations.trim() || undefined,
        }
      );

      if (error) throw error;

      setSuccessMessage(
        `Traslado realizado correctamente. Número de operación: ${data}`
      );

      setSelected(null);
      setDestinationId("");
      setObservations("");

      await refreshSearchResults();

      setHistoryLoaded(false);
      setReviewsLoaded(false);
    } catch (error) {
      console.error("Error realizando traslado:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible completar el traslado."
      );
    } finally {
      setTransferring(false);
    }
  }

  // =========================================================
  // HISTORIAL DE TRASLADOS
  // =========================================================

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      setErrorMessage("");

      const { data, error } = await supabase.rpc(
        "get_membership_transfer_history"
      );

      if (error) throw error;

      setHistory((data ?? []) as TransferHistory[]);
      setHistoryLoaded(true);
    } catch (error) {
      console.error("Error cargando historial:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el historial de traslados."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  // =========================================================
  // REVISIONES DE RESPONSABILIDADES
  // =========================================================

  async function loadReviews(status = reviewFilter) {
    try {
      setLoadingReviews(true);
      setErrorMessage("");

      const { data, error } = await supabase.rpc(
        "get_membership_transfer_area_reviews",
        { p_status: status }
      );

      if (error) throw error;

      setReviews((data ?? []) as AreaReview[]);
      setReviewsLoaded(true);
    } catch (error) {
      console.error("Error cargando revisiones:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible cargar las revisiones de responsabilidades."
      );
    } finally {
      setLoadingReviews(false);
    }
  }

  async function resolveReview(
    review: AreaReview,
    decision: "maintained" | "ended"
  ) {
    const decisionText =
      decision === "maintained"
        ? "mantener la responsabilidad"
        : "finalizar la responsabilidad";

    const confirmed = window.confirm(
      `¿Confirmas ${decisionText} de ${review.member_name ?? "este creyente"} en el área ${review.area_name}?`
    );

    if (!confirmed) return;

    try {
      setResolvingReviewId(review.review_id);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc(
        "resolve_membership_transfer_area_review",
        {
          p_review_id: review.review_id,
          p_decision: decision,
          p_observations: reviewObservations.trim() || undefined,
        }
      );

      if (error) throw error;

      setSuccessMessage(
        decision === "maintained"
          ? "La responsabilidad fue confirmada y se mantiene activa."
          : "La responsabilidad fue finalizada correctamente."
      );

      setReviewObservations("");
      setReviewsLoaded(false);

      await loadReviews(reviewFilter);
    } catch (error) {
      console.error("Error resolviendo revisión:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No fue posible resolver la revisión."
      );
    } finally {
      setResolvingReviewId("");
    }
  }

  // =========================================================
  // CAMBIO DE SECCIONES
  // =========================================================

  function changeTab(tab: Tab) {
    setActiveTab(tab);
    setErrorMessage("");
    setSuccessMessage("");

    if (tab === "history" && !historyLoaded) {
      void loadHistory();
    }

    if (tab === "reviews" && !reviewsLoaded) {
      void loadReviews(reviewFilter);
    }
  }

  function changeReviewFilter(value: string) {
    setReviewFilter(value);
    setReviewsLoaded(false);
    void loadReviews(value);
  }

  // =========================================================
  // ESTADOS DE CARGA
  // =========================================================

  const filteredDestinations = destinations.filter(
    (destination) =>
      destination.id !== selected?.congregation_id
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-sky-200 border-t-sky-700" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Cargando módulo de reubicaciones...
          </p>
        </div>
      </main>
    );
  }

  // =========================================================
  // INTERFAZ
  // =========================================================

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">

        {/* ENCABEZADO */}

        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-5 text-sm font-medium text-sky-700 hover:text-sky-900 dark:text-sky-400"
          >
            ← Volver al panel
          </button>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-400">
                Administración institucional
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Reubicación de creyentes
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Gestiona los traslados de creyentes entre congregaciones,
                conservando su historial institucional y sus asignaciones.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alcance de tu acceso
              </p>

              <p className="mt-1 font-semibold text-slate-800 dark:text-white">
                {isNationalAdmin
                  ? "Administración nacional"
                  : isDistrictCoordinator
                    ? "Coordinación distrital"
                    : "Acceso autorizado"}
              </p>
            </div>
          </div>
        </div>

        {/* REGLAS DE ACCESO */}

        <div className="mb-6 rounded-xl border border-sky-100 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
          <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
            Alcance de los traslados
          </p>

          <p className="mt-1 text-sm leading-6 text-sky-800 dark:text-sky-300">
            {isNationalAdmin
              ? "Puedes trasladar creyentes entre congregaciones de cualquier distrito."
              : "Puedes trasladar creyentes únicamente entre congregaciones de tu distrito. Los traslados entre distritos requieren autorización nacional."}
          </p>
        </div>

        {/* PESTAÑAS */}

        <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => changeTab("transfer")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === "transfer"
                ? "bg-sky-700 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Nuevo traslado
          </button>

          <button
            type="button"
            onClick={() => changeTab("history")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === "history"
                ? "bg-sky-700 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Historial
          </button>

          <button
            type="button"
            onClick={() => changeTab("reviews")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === "reviews"
                ? "bg-sky-700 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Responsabilidades
          </button>
        </div>

        {/* MENSAJES */}

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            {successMessage}
          </div>
        )}

        {/* ================================================= */}
        {/* PESTAÑA: NUEVO TRASLADO */}
        {/* ================================================= */}

        {activeTab === "transfer" && (
          <>
            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  1. Buscar creyente
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Busca por nombre o número de teléfono. Solo aparecen perfiles
                  y membresías activos dentro de tu ámbito autorizado.
                </p>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchMembers();
                }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre o número de teléfono..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-sky-900"
                />

                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-sky-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {searching ? "Buscando..." : "Buscar creyente"}
                </button>
              </form>
            </section>

            {results.length > 0 && (
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      2. Resultados de búsqueda
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Selecciona el creyente que deseas reubicar.
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {results.length} resultado(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {results.map((member) => {
                    const isSelected =
                      selected?.membership_id === member.membership_id;

                    return (
                      <button
                        key={member.membership_id}
                        type="button"
                        onClick={() => {
                          setSelected(member);
                          setDestinationId("");
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? "border-sky-600 bg-sky-50 ring-2 ring-sky-100 dark:border-sky-500 dark:bg-sky-950/40 dark:ring-sky-900"
                            : "border-slate-200 hover:border-sky-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {member.full_name || "Nombre no registrado"}
                            </p>

                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {member.phone || "Sin teléfono registrado"}
                            </p>

                            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                              Congregación:{" "}
                              <strong>{member.congregation_name}</strong>
                            </p>

                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Distrito: {member.district_name}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Asignaciones activas a áreas:{" "}
                              <strong>
                                {member.active_area_assignments}
                              </strong>
                            </span>

                            <span
                              className={`text-xs font-semibold ${
                                isSelected
                                  ? "text-sky-700 dark:text-sky-300"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {isSelected ? "Seleccionado ✓" : "Seleccionar →"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {selected && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    3. Configurar traslado
                  </h2>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Revisa la información y selecciona la congregación de destino.
                  </p>
                </div>

                <div className="mb-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Congregación de origen
                  </p>

                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selected.congregation_name}
                  </p>

                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selected.district_name}
                  </p>
                </div>

                <div className="mb-5">
                  <label
                    htmlFor="destination"
                    className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Congregación de destino
                  </label>

                  <select
                    id="destination"
                    value={destinationId}
                    onChange={(event) =>
                      setDestinationId(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">Seleccionar congregación...</option>

                    {filteredDestinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name} — {destination.district_name}
                      </option>
                    ))}
                  </select>

                  {filteredDestinations.length === 0 && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                      No hay congregaciones activas disponibles como destino.
                    </p>
                  )}
                </div>

                <div className="mb-6">
                  <label
                    htmlFor="observations"
                    className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Observaciones (opcional)
                  </label>

                  <textarea
                    id="observations"
                    rows={3}
                    value={observations}
                    onChange={(event) =>
                      setObservations(event.target.value)
                    }
                    placeholder="Motivo del traslado u observaciones adicionales..."
                    maxLength={1000}
                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />

                  <p className="mt-1 text-right text-xs text-slate-400">
                    {observations.length}/1000
                  </p>
                </div>

                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    Antes de confirmar
                  </p>

                  <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-400">
                    El traslado actualizará la congregación de la membresía
                    existente. Se conservarán el perfil y las asignaciones
                    a áreas. Estas últimas generarán revisiones pendientes
                    para su evaluación posterior.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setDestinationId("");
                      setObservations("");
                      setErrorMessage("");
                    }}
                    disabled={transferring}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={executeTransfer}
                    disabled={!destinationId || transferring}
                    className="rounded-xl bg-sky-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {transferring
                      ? "Procesando traslado..."
                      : "Confirmar reubicación"}
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {/* ================================================= */}
        {/* PESTAÑA: HISTORIAL */}
        {/* ================================================= */}

        {activeTab === "history" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Historial de traslados
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Consulta los movimientos institucionales y sus registros de responsabilidad.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadHistory()}
                disabled={loadingHistory}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {loadingHistory ? "Actualizando..." : "Actualizar historial"}
              </button>
            </div>

            {loadingHistory ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Cargando historial...
              </p>
            ) : history.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-5 py-10 text-center dark:bg-slate-950">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  No hay traslados registrados.
                </p>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Cuando se realice una reubicación, aparecerá aquí su historial.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {history.length} traslado(s) encontrado(s). Se muestran hasta 100 registros.
                </div>

                {history.map((item) => (
                  <article
                    key={item.transfer_id}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {item.member_name || "Nombre no registrado"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {item.member_phone || "Sin teléfono registrado"}
                        </p>
                      </div>

                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    <div className="my-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Origen
                        </p>

                        <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                          {item.from_congregation_name}
                        </p>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {item.from_district_name}
                        </p>
                      </div>

                      <div className="rounded-lg bg-sky-50 p-3 dark:bg-sky-950/30">
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                          Destino
                        </p>

                        <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                          {item.to_congregation_name}
                        </p>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {item.to_district_name}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <p className="text-slate-600 dark:text-slate-300">
                        Responsable:{" "}
                        <strong className="text-slate-800 dark:text-white">
                          {item.performed_by_name || "No disponible"}
                        </strong>
                      </p>

                      <p className="text-slate-600 dark:text-slate-300">
                        Revisiones de áreas:{" "}
                        <strong className="text-slate-800 dark:text-white">
                          {item.total_area_reviews}
                        </strong>
                      </p>

                      <p className="text-slate-600 dark:text-slate-300">
                        Revisiones pendientes:{" "}
                        <strong className="text-amber-700 dark:text-amber-400">
                          {item.pending_area_reviews}
                        </strong>
                      </p>
                    </div>

                    {item.observations && (
                      <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Observaciones
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                          {item.observations}
                        </p>
                      </div>
                    )}

                    <p className="mt-4 break-all text-xs text-slate-400">
                      Operación: {item.transfer_id}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================================= */}
        {/* PESTAÑA: RESPONSABILIDADES */}
        {/* ================================================= */}

        {activeTab === "reviews" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Revisión de responsabilidades
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Evalúa las asignaciones a áreas de los creyentes después de su traslado.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadReviews(reviewFilter)}
                disabled={loadingReviews}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {loadingReviews ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div className="mb-6">
              <label
                htmlFor="review-filter"
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Filtrar revisiones
              </label>

              <select
                id="review-filter"
                value={reviewFilter}
                onChange={(event) => changeReviewFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:max-w-xs"
              >
                <option value="pending">Pendientes</option>
                <option value="maintained">Responsabilidades mantenidas</option>
                <option value="ended">Responsabilidades finalizadas</option>
                <option value="all">Todas las revisiones</option>
              </select>
            </div>

            {loadingReviews ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Cargando revisiones...
              </p>
            ) : reviews.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-5 py-10 text-center dark:bg-slate-950">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  No hay revisiones en esta categoría.
                </p>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Las asignaciones activas de área generarán revisiones cuando se realicen traslados.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const isPending = review.review_status === "pending";
                  const isResolving =
                    resolvingReviewId === review.review_id;

                  return (
                    <article
                      key={review.review_id}
                      className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {review.member_name || "Nombre no registrado"}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {review.member_phone || "Sin teléfono registrado"}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(review.review_status)}`}
                        >
                          {statusLabel(review.review_status)}
                        </span>
                      </div>

                      <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Área y responsabilidad
                        </p>

                        <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                          {review.area_name}
                        </p>

                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Cargo o posición: {review.area_position || "No especificado"}
                        </p>
                      </div>

                      <div className="my-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Congregación de origen
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                            {review.from_congregation_name}
                          </p>

                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {review.from_district_name}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Congregación de destino
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                            {review.to_congregation_name}
                          </p>

                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {review.to_district_name}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                        <p>
                          Fecha del traslado: {formatDate(review.transfer_date)}
                        </p>

                        <p>
                          Fecha de revisión: {formatDate(review.reviewed_at)}
                        </p>

                        {review.reviewer_name && (
                          <p>
                            Revisado por: {review.reviewer_name}
                          </p>
                        )}
                      </div>

                      {review.observations && (
                        <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Observaciones de la revisión
                          </p>

                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                            {review.observations}
                          </p>
                        </div>
                      )}

                      {isPending && (
                        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                          <label
                            htmlFor={`review-observations-${review.review_id}`}
                            className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                          >
                            Observaciones de la decisión (opcional)
                          </label>

                          <textarea
                            id={`review-observations-${review.review_id}`}
                            rows={2}
                            value={reviewObservations}
                            onChange={(event) =>
                              setReviewObservations(event.target.value)
                            }
                            maxLength={2000}
                            placeholder="Registra el motivo o las observaciones de esta decisión..."
                            disabled={Boolean(resolvingReviewId)}
                            className="mb-4 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />

                          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                void resolveReview(review, "ended")
                              }
                              disabled={Boolean(resolvingReviewId)}
                              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {isResolving
                                ? "Procesando..."
                                : "Finalizar responsabilidad"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void resolveReview(review, "maintained")
                              }
                              disabled={Boolean(resolvingReviewId)}
                              className="rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
                            >
                              {isResolving
                                ? "Procesando..."
                                : "Mantener responsabilidad"}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* PIE */}

        <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
          <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
            Academia DECOM · Formación para comunicar con propósito.
            Los traslados se registran en el historial institucional.
            Las revisiones de asignaciones a áreas se gestionan de forma independiente.
          </p>
        </div>
      </div>
    </main>
  );
}
