/**
 * ¿SIGUE VIVA LA CONEXIÓN CON GOOGLE? (02/11/2026)
 *
 * El correo del club y la subida a YouTube cuelgan del mismo `refresh_token`
 * (`secreto:youtube`). Cuando Google lo da por caducado (`invalid_grant`), la
 * app se enteraba **al mandar un informe**, que es justo el peor momento. Esto
 * lo pregunta sin mandar nada: pide un acceso de prueba —el mismo canje que
 * hace cada envío— y mira qué permisos trae.
 *
 * Lo usan dos sitios:
 * - `/api/google/estado`, que pinta el aviso de la portada con el botón
 *   «Volver a conectar Google»;
 * - `scripts/google-salud.mjs`, que el vigía del ordenador del club corre
 *   varias veces al día y que avisa por correo (SMTP) en cuanto cae. Usar el
 *   token a diario tiene además un efecto: Google no lo da por abandonado (los
 *   que pasan seis meses sin uso caducan).
 *
 * **Por qué caduca, si caduca a los siete días**: la aplicación de la consola
 * de Google sigue en modo «Prueba» (Testing). Ahí los tokens con permisos de
 * YouTube o Gmail duran siete días y no hay forma de alargarlos desde el
 * código. Se arregla una vez en Google Cloud Console → «Pantalla de
 * consentimiento de OAuth» (o «Google Auth Platform → Público») → «Publicar
 * aplicación» → estado «En producción». Por eso, si el fallo llega a los ~7
 * días de conectar, el aviso lo dice.
 *
 * **Esto es sólo de servidor.**
 */

import {
  dameAccesoConPermisos,
  ErrorGoogle,
  leeAjustes,
  permisosQueFaltan,
  type AjustesYoutube,
} from "@/lib/coding/youtube";
import { configSmtp } from "@/lib/correo/smtp";

export type EstadoGoogle =
  /** Todo bien: el token se canjea y trae todos los permisos. */
  | "ok"
  /** `invalid_grant`: revocado, caducado (modo Prueba) o contraseña cambiada. */
  | "caducado"
  /** No hay cuenta conectada. */
  | "sin-conectar"
  /** Se canjea, pero falta algún permiso (p. ej. se desmarcó Gmail al conectar). */
  | "faltan-permisos"
  /** No hay `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET` en este servidor. */
  | "sin-credenciales"
  /** Un corte de red o un error pasajero de Google: no se avisa por esto. */
  | "fallo";

export type SaludGoogle = {
  estado: EstadoGoogle;
  /** Lo que hay que leer, en una frase. */
  motivo: string;
  /** Si el estado pide que una persona vuelva a conectar la cuenta. */
  hayQueReconectar: boolean;
  /** El fallo llega a los ~7 días de conectar: casi seguro es el modo «Prueba». */
  pareceModoPrueba: boolean;
  conectadoEn: string;
  canal: string;
  faltan: string[];
  /** El correo tiene la vía SMTP (contraseña de aplicación), que no depende de esto. */
  correoPorSmtp: boolean;
  comprobadoEn: string;
};

const DIA_MS = 24 * 3_600_000;

/** Entre 6 y 8,5 días desde que se conectó: la marca de los siete días del modo Prueba. */
export function pareceSieteDias(conectadoEn: string, ahora: number) {
  const desde = Date.parse(conectadoEn);

  if (!Number.isFinite(desde)) return false;

  const dias = (ahora - desde) / DIA_MS;

  return dias >= 6 && dias <= 8.5;
}

const PASOS_PRODUCCION =
  "Para que no vuelva a pasar: Google Cloud Console → «Pantalla de consentimiento de OAuth» → «Publicar aplicación» (estado «En producción»).";

/** El diagnóstico, con las piezas inyectables para poder probarlo sin Google. */
export async function compruebaGoogle(
  piezas: {
    lee?: () => Promise<AjustesYoutube>;
    canjea?: typeof dameAccesoConPermisos;
    ahora?: number;
  } = {},
): Promise<SaludGoogle> {
  const ahora = piezas.ahora ?? Date.now();

  const ajustes = await (piezas.lee ?? leeAjustes)();

  const base = {
    conectadoEn: ajustes.conectadoEn,
    canal: ajustes.canalTitulo,
    faltan: [] as string[],
    correoPorSmtp: Boolean(configSmtp()),
    comprobadoEn: new Date(ahora).toISOString(),
    pareceModoPrueba: false,
  };

  try {
    const { permisos } = await (piezas.canjea ?? dameAccesoConPermisos)(ajustes);

    const faltan = permisosQueFaltan(permisos);

    if (faltan.length) {
      const nombres = faltan.map((uno) => uno.replace("https://www.googleapis.com/auth/", "")).join(", ");

      return {
        ...base,
        estado: "faltan-permisos",
        faltan,
        hayQueReconectar: true,
        motivo: `La cuenta de Google está conectada, pero sin el permiso ${nombres}. Vuelve a conectarla y marca todas las casillas.`,
      };
    }

    return { ...base, estado: "ok", hayQueReconectar: false, motivo: "La conexión con Google está bien." };
  } catch (error) {
    const codigo = error instanceof ErrorGoogle ? error.codigo : "fallo";

    const mensaje = error instanceof Error ? error.message : String(error);

    if (codigo === "caducado") {
      const prueba = pareceSieteDias(ajustes.conectadoEn, ahora);

      return {
        ...base,
        estado: "caducado",
        hayQueReconectar: true,
        pareceModoPrueba: prueba,
        motivo:
          "Google ha retirado el permiso de la cuenta del club (correo y YouTube). " +
          (prueba
            ? "Ha caído a los siete días de conectarla: es la aplicación en modo «Prueba». "
            : "") +
          PASOS_PRODUCCION,
      };
    }

    if (codigo === "sin-conectar") {
      return { ...base, estado: "sin-conectar", hayQueReconectar: true, motivo: "No hay ninguna cuenta de Google conectada." };
    }

    if (codigo === "sin-credenciales") {
      return { ...base, estado: "sin-credenciales", hayQueReconectar: false, motivo: mensaje };
    }

    return { ...base, estado: "fallo", hayQueReconectar: false, motivo: `No se ha podido preguntar a Google: ${mensaje}` };
  }
}
