
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type District = {
  id: string;
  name: string;
  code: string;
  status: string;
};

type Congregation = {
  id: string;
  district_id: string;
  name: string;
  city: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

type FormData = {
  district_id: string;
  name: string;
  city: string;
};

const emptyForm: FormData = {
  district_id: "",
  name: "",
  city: "",
};

type SupabaseErrorDetails = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

function getErrorDetails(err: unknown): SupabaseErrorDetails {
  if (typeof err === "object" && err !== null) {
    return err as SupabaseErrorDetails;
  }

  return { message: String(err) };
}

function getErrorMessage(err: unknown): string {
  const details = getErrorDetails(err);

  return [
    details.message,
    details.details,
    details.hint,
    details.code ? `Código: ${details.code}` : "",
  ]
    .filter(Boolean)
    .join(" | ") || "Ocurrió un error inesperado.";
}

export default function CongregationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [isNationalAdmin, setIsNationalAdmin] = useState(false);

  const [districts, setDistricts] = useState<District[]>([]);
  const [congregations, setCongregations] = useState<Congregation[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState("all");

  const [form, setForm] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/conexion");
        return;
      }

      const { data: assignments, error: assignmentsError } =
        await supabase
          .from("user_role_assignments")
          .select("role_id, district_id")
          .eq("user_id", user.id);

      if (assignmentsError) throw assignmentsError;

      const roleIds = [
        ...new Set((assignments ?? []).map((item) => item.role_id)),
      ];

      if (roleIds.length === 0) {
        setAuthorized(false);
        return;
      }

      const { data: roles, error: rolesError } = await supabase
        .from("roles")
        .select("id, role_key")
        .in("id", roleIds);

      if (rolesError) throw rolesError;

      const roleKeys = (roles ?? []).map((role) => role.role_key);

      const nationalAdmin = roleKeys.includes("national_admin");
      const districtCoordinator = roleKeys.includes("district_coordinator");

      setIsNationalAdmin(nationalAdmin);

      if (!nationalAdmin && !districtCoordinator) {
        setAuthorized(false);
        return;
      }

      const assignedDistrictIds = [
        ...new Set(
          (assignments ?? [])
            .filter((assignment) =>
              (roles ?? []).some(
                (role) =>
                  role.id === assignment.role_id &&
                  role.role_key === "district_coordinator"
              )
            )
            .map((assignment) => assignment.district_id)
            .filter(Boolean)
        ),
      ] as string[];

      if (!nationalAdmin && assignedDistrictIds.length === 0) {
        setAuthorized(false);
        setError(
          "Tu usuario todavía no tiene un distrito asignado para administrar congregaciones."
        );
        return;
      }

      let districtQuery = supabase
        .from("districts")
        .select("id, name, code, status")
        .order("code");

      if (!nationalAdmin) {
        districtQuery = districtQuery.in("id", assignedDistrictIds);
      }

      const { data: districtData, error: districtError } =
        await districtQuery;

      if (districtError) throw districtError;

      const availableDistricts = (districtData ?? []) as District[];

      setDistricts(availableDistricts);

      if (!nationalAdmin && availableDistricts.length === 1) {
        setSelectedDistrict(availableDistricts[0].id);
      }

      const { data: congregationData, error: congregationError } =
        await supabase
          .from("congregations")
          .select("id, district_id, name, city, status, created_at, updated_at")
          .order("name");

      if (congregationError) throw congregationError;

      setCongregations((congregationData ?? []) as Congregation[]);
      setAuthorized(true);
    } catch (err) {
      console.error("Error cargando congregaciones:", {
        error: err,
        ...getErrorDetails(err),
      });

      setError(`Error cargando información: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({
      ...emptyForm,
      district_id:
        !isNationalAdmin && districts.length === 1
          ? districts[0].id
          : selectedDistrict !== "all"
            ? selectedDistrict
            : "",
    });

    setEditingId(null);
    setShowForm(false);
  };

  const startNew = () => {
    setMessage("");
    setError("");

    setForm({
      ...emptyForm,
      district_id:
        !isNationalAdmin && districts.length === 1
          ? districts[0].id
          : selectedDistrict !== "all"
            ? selectedDistrict
            : "",
    });

    setEditingId(null);
    setShowForm(true);
  };

  const startEditing = (congregation: Congregation) => {
    setMessage("");
    setError("");

    setForm({
      district_id: congregation.district_id,
      name: congregation.name,
      city: congregation.city ?? "",
    });

    setEditingId(congregation.id);
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setError("");

    const cleanName = form.name.trim();
    const cleanCity = form.city.trim();

    if (!form.district_id || !cleanName) {
      setError(
        "Selecciona un distrito e ingresa el nombre de la congregación."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        district_id: form.district_id,
        name: cleanName,
        city: cleanCity || null,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("congregations")
          .update(payload)
          .eq("id", editingId);

        if (updateError) throw updateError;

        setMessage("La congregación fue actualizada correctamente.");
      } else {
        const { error: insertError } = await supabase
          .from("congregations")
          .insert({
            ...payload,
            status: "active",
          });

        if (insertError) throw insertError;

        setMessage("La congregación fue registrada correctamente.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      const details = getErrorDetails(err);

      console.error("Error guardando congregación:", {
        message: details.message,
        details: details.details,
        hint: details.hint,
        code: details.code,
        originalError: err,
      });

      if (details.code === "23505") {
        setError("Ya existe un registro con esos datos.");
      } else {
        setError(`No fue posible guardar la congregación: ${getErrorMessage(err)}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (congregation: Congregation) => {
    const nextStatus =
      congregation.status === "active" ? "inactive" : "active";

    const action =
      nextStatus === "inactive" ? "desactivar" : "activar";

    const confirmed = window.confirm(
      `¿Deseas ${action} la congregación "${congregation.name}"?`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("congregations")
        .update({ status: nextStatus })
        .eq("id", congregation.id);

      if (updateError) throw updateError;

      setMessage(
        nextStatus === "inactive"
          ? "La congregación fue desactivada."
          : "La congregación fue activada."
      );

      await loadData();
    } catch (err) {
      console.error("Error cambiando estado:", {
        error: err,
        ...getErrorDetails(err),
      });

      setError(`No fue posible actualizar el estado: ${getErrorMessage(err)}`);
    }
  };

  const filteredCongregations = congregations.filter((congregation) => {
    return (
      selectedDistrict === "all" ||
      congregation.district_id === selectedDistrict
    );
  });

  const getDistrictName = (districtId: string) => {
    const district = districts.find((item) => item.id === districtId);

    return district
      ? `${district.name} (${district.code})`
      : "Distrito no disponible";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <p className="text-slate-600 dark:text-slate-300">
          Cargando gestión de congregaciones...
        </p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Acceso restringido
          </h1>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Este módulo está disponible para Administración nacional y
            Coordinación distrital con asignación vigente.
          </p>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Volver al panel
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-5 text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400"
          >
            ← Volver al panel
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Administración institucional
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                Gestión de congregaciones
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Administra el directorio institucional de congregaciones y su
                vinculación con los distritos.
              </p>
            </div>

            <button
              onClick={startNew}
              className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              + Nueva congregación
            </button>
          </div>
        </header>

        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {showForm && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingId
                    ? "Editar congregación"
                    : "Registrar congregación"}
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Completa la información institucional.
                </p>
              </div>

              <button
                onClick={resetForm}
                type="button"
                className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="district_id"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Distrito *
                  </label>

                  <select
                    id="district_id"
                    value={form.district_id}
                    onChange={(e) =>
                      setForm({ ...form, district_id: e.target.value })
                    }
                    required
                    disabled={!isNationalAdmin}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
                  >
                    <option value="">Selecciona un distrito</option>

                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name} ({district.code})
                        {district.status === "inactive" ? " - Inactivo" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="congregation_name"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nombre de la congregación *
                  </label>

                  <input
                    id="congregation_name"
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="Ej. IPUC Bastidas"
                    required
                    maxLength={150}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="congregation_city"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Ciudad o municipio
                  </label>

                  <input
                    id="congregation_city"
                    type="text"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    placeholder="Ej. Santa Marta"
                    maxLength={100}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Guardando..."
                    : editingId
                      ? "Guardar cambios"
                      : "Registrar congregación"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Congregaciones registradas
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
              {congregations.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Activas
            </p>

            <p className="mt-2 text-3xl font-bold text-green-700 dark:text-green-400">
              {congregations.filter((item) => item.status === "active").length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Inactivas
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-500">
              {congregations.filter((item) => item.status === "inactive").length}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Directorio de congregaciones
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Consulta y administra los registros disponibles.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <label
                htmlFor="filter_district"
                className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Filtrar por distrito
              </label>

              <select
                id="filter_district"
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {isNationalAdmin && (
                  <option value="all">Todos los distritos</option>
                )}

                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name} ({district.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredCongregations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h3 className="font-medium text-slate-900 dark:text-white">
                No hay congregaciones registradas
              </h3>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Cuando registres una congregación, aparecerá en este directorio.
              </p>

              <button
                onClick={startNew}
                className="mt-5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Registrar primera congregación
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Congregación</th>
                    <th className="px-5 py-4 font-semibold">Distrito</th>
                    <th className="px-5 py-4 font-semibold">Ciudad o municipio</th>
                    <th className="px-5 py-4 font-semibold">Estado</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCongregations.map((congregation) => (
                    <tr
                      key={congregation.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                        {congregation.name}
                      </td>

                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {getDistrictName(congregation.district_id)}
                      </td>

                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {congregation.city || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            congregation.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {congregation.status === "active"
                            ? "Activa"
                            : "Inactiva"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => startEditing(congregation)}
                            className="text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-400"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => toggleStatus(congregation)}
                            className={`text-sm font-medium ${
                              congregation.status === "active"
                                ? "text-red-600 hover:text-red-800 dark:text-red-400"
                                : "text-green-700 hover:text-green-900 dark:text-green-400"
                            }`}
                          >
                            {congregation.status === "active"
                              ? "Desactivar"
                              : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Mostrando {filteredCongregations.length} de{" "}
            {congregations.length} congregaciones.
          </div>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-500 dark:text-slate-500">
          Academia DECOM · Formación para comunicar con propósito
        </footer>
      </div>
    </main>
  );
}
