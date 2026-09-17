/**
 * QUIÉN ES CADA UNO EN LA QUINIELA.
 *
 * Es el primer control de acceso que tiene la plataforma, así que conviene
 * decir **qué es y qué no es**: esto impide que alguien rellene la quiniela de
 * otro, y nada más. No protege datos sensibles, porque la contraseña inicial
 * es la parte del correo anterior a la arroba —quien sabe tu correo la sabe—.
 * Es un pestillo entre compañeros, no una cerradura.
 *
 * Por eso mismo:
 *
 * - **Sólo cubre `/quiniela`.** El resto de la plataforma sigue abierto como
 *   estaba: meter un login de entrada a todo era un cambio grande y arriesgado
 *   —si falla, nadie entra a nada— y no es lo que hacía falta.
 * - **La contraseña se guarda cifrada igualmente.** Aunque sea adivinable, la
 *   gente reutiliza contraseñas: guardarla en claro sería regalar la de su
 *   correo el día que alguien lea la tabla. Se guarda el hash con sal.
 * - **Se puede cambiar**, y en cuanto alguien la cambia deja de ser adivinable.
 *
 * El documento vive bajo la clave `secreto:quiniela-cuentas`, que `/api/docs`
 * **se niega a servir al navegador** (ver el veto del prefijo `secreto:` en esa
 * ruta). Se lee y se escribe sólo desde el servidor, como el token de YouTube.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** La clave del documento. El prefijo `secreto:` es lo que lo mantiene fuera del navegador. */
export const CLAVE_CUENTAS = "secreto:quiniela-cuentas";

export type CuentaQuiniela = {
  /** El `slug` del staff: es quien juega, y lo que ata la cuenta al ranking. */
  slug: string;
  /** En minúsculas, ya limpio. */
  correo: string;
  /** `scrypt` en hexadecimal. */
  hash: string;
  /** La sal de ese hash, en hexadecimal. */
  sal: string;
  /** Cuándo se registró. */
  altaEn: string;
  /**
   * Si todavía tiene la contraseña que se le puso al registrarse.
   *
   * Sirve para poder recordarle que la cambie sin tener que compararla: en
   * cuanto la cambia, esto pasa a `false` y la pantalla deja de insistir.
   */
  inicial: boolean;
};

export type DocumentoCuentas = {
  /** Por `slug`. */
  cuentas: Record<string, CuentaQuiniela>;
};

export const CUENTAS_VACIAS: DocumentoCuentas = { cuentas: {} };

/* ------------------------------------------------------------------ */
/*  EL CORREO                                                          */
/* ------------------------------------------------------------------ */

/** Una dirección que se pueda usar, en minúsculas, o `null`. */
export function limpiaCorreo(valor: unknown): string | null {
  const texto = String(valor ?? "").trim().toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto) ? texto : null;
}

/**
 * La contraseña con la que se entra la primera vez: lo que va antes de la `@`.
 *
 * Se decidió así para que nadie tenga que repartir contraseñas por WhatsApp ni
 * apuntarlas en ningún sitio. A cambio no es secreta, y la pantalla lo dice.
 */
export function claveInicialDe(correo: string) {
  return correo.split("@")[0] ?? "";
}

/* ------------------------------------------------------------------ */
/*  LA CONTRASEÑA                                                      */
/* ------------------------------------------------------------------ */

/**
 * Mínimo cuatro caracteres.
 *
 * Es poco a propósito: varias direcciones del club son cortas —`ai@`, `jl@`—
 * y si el mínimo fuera ocho, la contraseña inicial de esa gente no valdría y
 * no podrían ni registrarse. Subir el listón aquí sin resolver ese caso sería
 * dejar a alguien fuera para presumir de rigor.
 */
export const MINIMO_CLAVE = 4;

/** `scrypt` con la sal dada, en hexadecimal. */
function amasa(clave: string, sal: string) {
  return scryptSync(clave.normalize("NFKC"), sal, 64).toString("hex");
}

export function cifra(clave: string) {
  const sal = randomBytes(16).toString("hex");

  return { sal, hash: amasa(clave, sal) };
}

/**
 * Si la contraseña es la de esta cuenta.
 *
 * La comparación es en tiempo constante (`timingSafeEqual`): comparar con
 * `===` filtra por el tiempo de respuesta cuántos caracteres se han acertado.
 * Aquí el riesgo es ridículo, pero escribir la versión mala de esto una vez es
 * la forma de que acabe copiada donde sí importe.
 */
export function acierta(clave: string, cuenta: CuentaQuiniela) {
  const candidato = Buffer.from(amasa(clave, cuenta.sal), "hex");

  const guardado = Buffer.from(cuenta.hash, "hex");

  if (candidato.length !== guardado.length) return false;

  return timingSafeEqual(candidato, guardado);
}

/* ------------------------------------------------------------------ */
/*  BUSCAR                                                             */
/* ------------------------------------------------------------------ */

/** La cuenta de un correo, mire quien mire. */
export function cuentaDeCorreo(doc: DocumentoCuentas, correo: string) {
  return (
    Object.values(doc.cuentas ?? {}).find((una) => una.correo === correo) ?? null
  );
}

/** Todas las direcciones dadas de alta: es a quien se avisa los viernes. */
export function correosDe(doc: DocumentoCuentas) {
  return [
    ...new Set(
      Object.values(doc.cuentas ?? {})
        .map((una) => una.correo)
        .filter(Boolean),
    ),
  ];
}
