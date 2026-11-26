import { NextRequest, NextResponse } from "next/server";
import { isValidInvitationToken } from "@/lib/invitations/link.mjs";

/**
 * Enlace corto de invitación: /invitacion/<token>.
 * Solo redirige (307) al formulario existente /solicitud-invitacion?token=...; no valida ni consume el token.
 * Los enlaces antiguos con ?token= siguen funcionando.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const target = request.nextUrl.clone();
  target.pathname = "/solicitud-invitacion";
  target.search = "";
  if (isValidInvitationToken(token)) {
    target.searchParams.set("token", token);
  }

  return NextResponse.redirect(target, 307);
}
