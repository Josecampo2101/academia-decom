import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const isLoginPage = pathname === "/";

  const isAccessDenied = pathname === "/acceso-denegado";

  // Sin sesión: bloquear el dashboard.
  if (isDashboard && (authError || !user)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";

    return NextResponse.redirect(redirectUrl);
  }

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    // Denegar si no existe el perfil, no está activo o hay un error.
    if (profileError || !profile || profile.status !== "active") {
      if (!isAccessDenied) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/acceso-denegado";
        redirectUrl.search = "";

        return NextResponse.redirect(redirectUrl);
      }

      return supabaseResponse;
    }

    // Los usuarios activos no necesitan ver esta página.
    if (isAccessDenied || isLoginPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";

      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/acceso-denegado"],
};
