"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  Save,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const AVATAR_BUCKET = "decom-profile-avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ProfileData = {
  full_name: string | null;
  phone: string | null;
  avatar_path: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">("info");

  const profileComplete = fullName.trim().length >= 3 && phone.trim().length >= 7;

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !authData.user) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_path")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setMessage("No fue posible consultar tu perfil. Intenta nuevamente o contacta al administrador.");
        setMessageType("error");
        setLoading(false);
        return;
      }

      const profile = data as ProfileData;
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setAvatarPath(profile.avatar_path);

      if (profile.avatar_path) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(profile.avatar_path, 60 * 60);

        if (active && !signedError && signedData?.signedUrl) {
          setAvatarUrl(signedData.signedUrl);
        }
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setMessage("");
    setSelectedFile(null);
    setPreviewUrl("");

    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setMessage("Selecciona una imagen JPG, PNG o WebP.");
      setMessageType("error");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setMessage("La fotografía no puede superar los 5 MB.");
      setMessageType("error");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const cleanName = fullName.trim().replace(/\s+/g, " ");
    const cleanPhone = phone.trim();

    if (cleanName.length < 3 || cleanName.length > 120) {
      setMessage("Escribe tu nombre completo (entre 3 y 120 caracteres).");
      setMessageType("error");
      return;
    }

    if (cleanPhone.length < 7 || cleanPhone.length > 25) {
      setMessage("Escribe un número de WhatsApp válido (entre 7 y 25 caracteres).");
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage("");

    const supabase = createClient();
    let uploadedPath: string | null = null;

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace("/");
        return;
      }

      if (selectedFile) {
        const extension = selectedFile.type === "image/png"
          ? "png"
          : selectedFile.type === "image/webp"
            ? "webp"
            : "jpg";
        uploadedPath = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(uploadedPath, selectedFile, {
            cacheControl: "3600",
            contentType: selectedFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: cleanName,
          phone: cleanPhone,
          ...(uploadedPath ? { avatar_path: uploadedPath } : {}),
        })
        .eq("id", authData.user.id)
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedProfile) {
        throw new Error("No fue posible guardar el perfil. Verifica los permisos de tu cuenta.");
      }

      if (uploadedPath && avatarPath && avatarPath !== uploadedPath) {
        const { error: removeError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .remove([avatarPath]);
        if (removeError) console.warn("No se pudo retirar la fotografía anterior:", removeError.message);
      }

      setAvatarPath(uploadedPath ?? avatarPath);
      setSelectedFile(null);
      setMessage("Tu perfil se guardó correctamente.");
      setMessageType("success");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath]);
      }
      console.error("Error guardando el perfil:", error);
      setMessage(error instanceof Error ? error.message : "Ocurrió un error al guardar tu perfil.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  const visibleAvatar = previewUrl || avatarUrl;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 text-[#102d4d] dark:bg-[#0b1422] dark:text-white">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-[#087db5]" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Cargando tu perfil...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-[#102d4d] dark:bg-[#0b1422] dark:text-white sm:py-12">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#087db5] transition hover:bg-[#087db5]/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </button>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-[#142235]">
          <div className="bg-[#102d4d] px-6 py-8 text-white sm:px-9">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9bdcf5]">Escuela de Comunicaciones D34</p>
                <h1 className="mt-1 text-2xl font-bold">Tu perfil institucional</h1>
              </div>
            </div>
            <p className="mt-5 max-w-lg text-sm leading-6 text-blue-100">
              Completa tus datos para ingresar a tu espacio académico. Puedes agregar una fotografía ahora o hacerlo más adelante.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-6 py-8 sm:px-9">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#087db5]/15 bg-[#087db5]/10 text-[#087db5]">
                {visibleAvatar ? (
                  <Image src={visibleAvatar} alt="Vista previa de tu fotografía de perfil" width={112} height={112} unoptimized className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-12 w-12" />
                )}
                <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#087db5] text-white dark:border-[#142235]">
                  <Camera className="h-4 w-4" />
                </span>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="font-bold">Fotografía de perfil</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">JPG, PNG o WebP · Máximo 5 MB</p>
                <label htmlFor="profile-avatar" className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#087db5]/30 px-4 py-2.5 text-sm font-semibold text-[#087db5] transition hover:bg-[#087db5]/10">
                  <ImagePlus className="h-4 w-4" />
                  {selectedFile ? "Cambiar fotografía" : avatarPath ? "Actualizar fotografía" : "Subir fotografía"}
                </label>
                <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="sr-only" />
              </div>
            </div>

            <div>
              <label htmlFor="full-name" className="mb-2 block text-sm font-semibold">Nombre completo <span className="text-red-500">*</span></label>
              <input
                id="full-name"
                type="text"
                required
                minLength={3}
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Escribe tu nombre y apellidos"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#087db5] focus:ring-4 focus:ring-[#087db5]/10 dark:border-slate-600 dark:bg-[#0b1422] dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-2 block text-sm font-semibold">Número de WhatsApp <span className="text-red-500">*</span></label>
              <input
                id="phone"
                type="tel"
                required
                minLength={7}
                maxLength={25}
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Tu número de contacto"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#087db5] focus:ring-4 focus:ring-[#087db5]/10 dark:border-slate-600 dark:bg-[#0b1422] dark:text-white"
              />
            </div>

            {message && (
              <div role="status" className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-5 ${messageType === "error" ? "border-red-200 bg-red-50 text-red-700" : messageType === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                {messageType === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                <span>{message}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 dark:border-slate-700 sm:flex-row sm:justify-end">
              {profileComplete && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="h-12 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#087db5] px-6 text-sm font-bold text-white shadow-lg shadow-[#087db5]/20 transition hover:bg-[#06689a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar y continuar"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
