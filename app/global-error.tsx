"use client";

/**
 * El último recurso: si falla hasta el layout raíz, esto es lo único que
 * puede pintarse (por eso lleva su propio <html> y <body>, sin estilos de
 * la app). En la práctica salta sólo por un fallo del propio marco.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#0B0F14", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ maxWidth: 520, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 24 }}>
            <h1 style={{ fontSize: 18, margin: 0 }}>La plataforma no ha podido arrancar</h1>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
              Recarga la página; si sigue igual, el detalle de abajo es lo que hay que mirar.
            </p>
            {error?.message && (
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", wordBreak: "break-word" }}>
                {error.message}
                {error.digest ? ` · ${error.digest}` : ""}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 12, padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(200,169,107,0.5)", background: "rgba(200,169,107,0.15)", color: "#C8A96B", cursor: "pointer" }}
            >
              Volver a intentarlo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
