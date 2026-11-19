/**
 * QUÉ VE CADA UNO (18/11/2026). Sin imports: lo usan el proxy y el menú.
 *
 * JUGADORES: lista BLANCA de pantallas (lo que no está aquí, no lo ven) y
 * lista NEGRA de datos (por si alguien pide la API a mano). Petición del
 * analista: «la plataforma completa pero nada sensible rellenado por el staff
 * (pizarra táctica, sus valoraciones de cada partido, pizarra de ABP, sus
 * seguimientos y cualquier otra cosa que pueda comprometernos)». Fuera, por
 * eso: seguimientos e individual, valoraciones, emocional, carga física,
 * pizarras (táctica, de sesión y de ABP), planes de partido, informes,
 * coding y vídeos internos, visionados (quién mira qué), tareas, alertas,
 * quiniela y apuestas del staff, el calendario de seguimiento, laboratorio y ajustes. La pantalla de Data
 * análisis tampoco (compara a cada jugador con sus compañeros), pero su API
 * sí se lee: la usan Rivales y Análisis de goles, y son datos de Wyscout/Opta,
 * no algo que rellene el staff.
 */

/**
 * Pantallas que ven los jugadores (la ruta exacta o lo que cuelga de ella).
 * 19/11/2026: fuera, a petición del analista, el Calendario Operativa, el
 * Desplazamiento y toda la Identidad y modelo de juego.
 */
export const PANTALLAS_JUGADOR = [
  "/jugadores",
  "/rivals",
  "/scout-rival-collective",
  "/scout-rival-individual",
  "/scout-rival-abp",
  "/scout-rival-area",
  "/setpieces",
  "/setpieces_def",
  "/throw-ins",
  "/throw-ins-def",
  "/analisis-goles",
  "/collective_history",
] as const;

export function pantallaDeJugador(ruta: string) {
  return PANTALLAS_JUGADOR.some((p) => ruta === p || ruta.startsWith(`${p}/`));
}

/** APIs que un jugador NO puede leer (lo que rellena el staff o lo interno). */
const API_VETADA_JUGADOR =
  /^\/api\/(ratings|performance|performance-files|training-import|training-session|registro|general|general-files|alertas|admin\/(?!$)|mantenimiento|actualizaciones|x-ideas|apuestas|quiniela\/(?!cuenta)|visionados|entreno|informe|coding|voice|abp-lab|laboratorio|proyeccion|create-player|update-player-status|player-alias|save-alias|find-player|almacen|nube|google|abp\/|youtube\/(?!videos))/;

/** Documentos que un jugador NO puede leer por /api/docs. */
const DOC_VETADO_JUGADOR =
  /^(abp-pizarra|riv-|abp-lab|abp:informe|abp-microciclo|tactics|match-board|session-board|pizarra|emotion|agenda|alertas|mantenimiento|x:|quiniela|apuestas|coding|informes|partido:|peso|rmcf:pesos|entreno|ajustes|secreto|seguimiento|valoracion|ratings|registro|notas|microciclo|plan|once-probable-staff|grupo:)/i;

export function apiVetadaJugador(ruta: string, metodo: string, key: string | null) {
  /* Un jugador no escribe nada, salvo entrar y salir. */
  if (metodo !== "GET" && metodo !== "HEAD") return !/^\/api\/acceso(\/|$)/.test(ruta);
  if (API_VETADA_JUGADOR.test(ruta)) return true;
  if (ruta === "/api/docs" && key && DOC_VETADO_JUGADOR.test(key)) return true;
  return false;
}

/**
 * Lo que se abre SIN haber entrado: la puerta, lo estático y los enlaces que
 * salen por WhatsApp o correo (vídeos, PDF) y los avisos de las tareas
 * programadas, que ya llevan su propia llave.
 */
export function rutaPublica(ruta: string, metodo: string, buscar: URLSearchParams) {
  if (ruta === "/entrar" || ruta.startsWith("/entrar/")) return true;
  if (/^\/api\/acceso(\/|$)/.test(ruta)) return true;
  if (ruta === "/api/admin") return true; /* el login de administrador; sus acciones piden la cookie dentro */
  if (ruta === "/api/quiniela/cuenta") return true; /* entrar / registrarse (registrarse pide el código del staff) */
  if (ruta.startsWith("/api/video/")) return true; /* los enlaces de vídeo de WhatsApp y de los informes */
  if (ruta.startsWith("/pdf/")) return true; /* la vista previa del PDF para WhatsApp */
  if (ruta === "/api/youtube/callback") return true; /* la vuelta de Google al dar permiso */
  if (ruta === "/api/quiniela/aviso") return true; /* la tarea de GitHub, con su CRON_SECRET (lo comprueba la ruta) */
  if (metodo === "GET") {
    /* Lo que toca la tarea «web despierta» de GitHub: nada sensible. */
    if (ruta === "/api/docs" && buscar.get("key") === "castilla:calendario") return true;
    if (ruta === "/api/data-analisis" && buscar.get("resumen") === "1" && buscar.size === 1) return true;
    if (ruta === "/api/youtube/visionados") return true;
  }
  return false;
}
