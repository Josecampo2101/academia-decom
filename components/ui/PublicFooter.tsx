/**
 * Pie de página para pantallas públicas (acceso, activación, solicitud).
 * Solo contiene enlaces verificados. TODO: añadir términos, política de tratamiento de datos
 * y redes sociales oficiales de DECOM cuando la coordinación confirme las URLs.
 */
type PublicFooterProps = {
  className?: string;
};

export function PublicFooter({ className = "" }: PublicFooterProps) {
  return (
    <footer className={`mt-8 text-center text-xs text-muted-fg ${className}`}>
      <p>Escuela de Comunicaciones D34 · Distrito 34 · IPUC</p>
      <p className="mt-1">
        <a
          href="https://ipuc.org.co/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          ipuc.org.co
        </a>
      </p>
    </footer>
  );
}
