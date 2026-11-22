import type { createClient } from "@/lib/supabase/client";

type Supabase = ReturnType<typeof createClient>;

/** Bucket privado definido en la migración de la biblioteca académica. */
export const LIBRARY_BUCKET = "academic-library-resources";

export type LibraryCategory = { id: string; name: string };

export type LibraryResource = {
  id: string;
  title: string;
  description: string;
  resource_type: string;
  version_label: string;
  storage_path: string | null;
  external_url: string | null;
  content: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  category_id: string;
  course_id: string | null;
  published_at: string | null;
};

export type PublishedLibrary = {
  categories: LibraryCategory[];
  resources: LibraryResource[];
  courseTitles: Record<string, string>;
};

/**
 * Lee la biblioteca publicada (solo lectura). Las políticas RLS limitan lo que cada persona ve
 * según su distrito; aquí además se pide explícitamente status = published para que ni
 * administradores ni editores vean borradores en la vista del estudiante.
 */
export async function loadPublishedLibrary(supabase: Supabase): Promise<PublishedLibrary> {
  const [categoriesResult, resourcesResult] = await Promise.all([
    supabase.from("academic_library_categories").select("id,name").order("name"),
    supabase
      .from("academic_library_resources")
      .select(
        "id,title,description,resource_type,version_label,storage_path,external_url,content,mime_type,size_bytes,category_id,course_id,published_at",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false }),
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (resourcesResult.error) throw resourcesResult.error;

  const resources = (resourcesResult.data ?? []) as LibraryResource[];
  const courseIds = [
    ...new Set(resources.map((item) => item.course_id).filter(Boolean)),
  ] as string[];

  // Los títulos de curso son un complemento: si no se pueden leer, la biblioteca sigue funcionando.
  const courseTitles: Record<string, string> = {};
  if (courseIds.length > 0) {
    const { data: courses } = await supabase.from("courses").select("id,title").in("id", courseIds);
    for (const course of courses ?? []) courseTitles[course.id] = course.title;
  }

  return {
    categories: (categoriesResult.data ?? []) as LibraryCategory[],
    resources,
    courseTitles,
  };
}

/** Dirección firmada y temporal (5 minutos) para abrir un archivo del almacenamiento privado. */
export async function createLibraryFileUrl(supabase: Supabase, storagePath: string) {
  const { data, error } = await supabase.storage
    .from(LIBRARY_BUCKET)
    .createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl)
    throw error ?? new Error("No se pudo generar el enlace de descarga.");
  return data.signedUrl;
}
