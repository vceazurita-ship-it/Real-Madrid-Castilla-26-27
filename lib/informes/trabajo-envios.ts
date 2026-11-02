/**
 * LOS ENVÍOS DE LOS INFORMES, EN SEGUNDO PLANO (02/11/2026).
 *
 * Lo pidió el analista: «que todos los informes se queden cargando como la
 * exportación de los PDF y que salga un aviso cuando ya se han enviado, pero
 * que me deje seguir haciendo cosas a la vez». El mismo avance que
 * `lib/abp/trabajo-pdfs.ts` y `lib/video-informe/trabajo-video.ts`:
 *
 * - **El envío vive en este módulo, no en el diálogo.** Al pulsar «Enviar» el
 *   diálogo entrega su trabajo (esperar el vídeo, armar y subir el PDF, mandar
 *   el correo) y se puede cerrar al momento o cambiar de pantalla.
 * - **Panel con el paso** en el de los informes (`components/informes/TrabajoInformes.tsx`,
 *   en el layout raíz), y aviso al terminar con `avisaHecho` (toast y, con la
 *   pestaña escondida, la notificación del sistema).
 * - **Dos iguales a la vez, no**: la clave dice qué envío es.
 * - **Si falla, «Reintentar» sin rehacer lo hecho**: el trabajo es la misma
 *   función, que guarda por dentro lo que ya subió o mandó.
 * - **WhatsApp no sale solo**: abrir wa.me necesita el clic de la persona. Si
 *   el envío era por WhatsApp, al terminar se queda en el panel con un botón
 *   por persona (y el aviso lleva «Abrir WhatsApp»).
 *
 * Al recargar se pierde: por eso el layout avisa antes de cerrar la pestaña.
 */

import { avisaHecho } from "@/lib/aviso-hecho";
import { enlaceWhatsapp, type MensajeWhatsapp } from "@/lib/correo/whatsapp";

export type ParaWhatsapp = { mensajes: MensajeWhatsapp[]; telefonos: string[]; archivo?: File | null };

/** Lo que devuelve el trabajo al acabar. */
export type ResultadoEnvio = {
  /** «Informe de ABP enviado a 6 destinatarios». */
  titulo: string;
  texto?: string;
  /** Lo que no ha salido (uno de dos correos, por ejemplo): queda «Reintentar». */
  fallo?: string;
  /** Por WhatsApp: los mensajes ya con sus enlaces, para abrirlos con un clic. */
  whatsapp?: ParaWhatsapp;
};

export type EstadoEnvio = "enviando" | "fallo" | "whatsapp";

export type TrabajoEnvio = {
  clave: string;
  /** «Informe del partido · Post J10», para el panel. */
  rotulo: string;
  estado: EstadoEnvio;
  /** Por dónde va («Completo: subiendo el PDF 40 %…»). */
  paso: string;
  pedido: number;
  error?: string;
  whatsapp?: ParaWhatsapp;
};

type Pedido = {
  clave: string;
  rotulo: string;
  /** A dónde lleva «Ver» en el aviso. */
  href?: string;
  /** El envío entero. Se vuelve a llamar al reintentar: lo ya hecho lo guarda él. */
  ejecuta: (paso: (texto: string) => void) => Promise<ResultadoEnvio>;
};

type Interno = TrabajoEnvio & { pedidoOriginal: Pedido };

const trabajos = new Map<string, Interno>();
let foto: TrabajoEnvio[] = [];
const oyentes = new Set<() => void>();

const avisa = () => {
  foto = [...trabajos.values()]
    .map(({ clave, rotulo, estado, paso, pedido, error, whatsapp }) => ({ clave, rotulo, estado, paso, pedido, error, whatsapp }))
    .sort((a, b) => a.pedido - b.pedido);
  oyentes.forEach((o) => o());
};

const abreWhatsapp = (wa: ParaWhatsapp) => {
  const primero = wa.mensajes[0];

  if (!primero) return;

  /* Con una persona (o ninguna, que es elegir chat), se abre ya; con más, va uno a uno desde el panel. */
  if (wa.telefonos.length <= 1) window.open(enlaceWhatsapp(wa.telefonos[0] ?? null, primero.texto), "_blank", "noopener");
};

function corre(trabajo: Interno) {
  const { pedidoOriginal: pedido } = trabajo;

  trabajo.estado = "enviando";
  trabajo.paso = "empezando…";
  trabajo.error = undefined;
  avisa();

  const paso = (texto: string) => {
    if (trabajos.get(trabajo.clave) !== trabajo || trabajo.estado !== "enviando") return;

    trabajo.paso = texto;
    avisa();
  };

  void pedido.ejecuta(paso).then(
    (resultado) => {
      if (resultado.whatsapp?.mensajes.length) {
        trabajo.estado = "whatsapp";
        trabajo.whatsapp = resultado.whatsapp;
        avisa();

        const wa = resultado.whatsapp;

        avisaHecho({
          ok: true,
          titulo: resultado.titulo,
          texto: wa.telefonos.length > 1 ? "Abajo a la izquierda, un botón por persona con el mensaje escrito." : resultado.texto,
          accion: { label: "Abrir WhatsApp", onClick: () => abreWhatsapp(wa) },
        });

        return;
      }

      avisaHecho({ ok: true, titulo: resultado.titulo, texto: resultado.texto, href: pedido.href });

      if (resultado.fallo) {
        trabajo.estado = "fallo";
        trabajo.error = resultado.fallo;
        avisa();
        avisaHecho({ ok: false, titulo: `${pedido.rotulo}: una parte no ha salido`, texto: resultado.fallo, accion: { label: "Reintentar", onClick: () => trabajoEnvios.reintenta(pedido.clave) } });

        return;
      }

      trabajos.delete(trabajo.clave);
      avisa();
    },
    (error: unknown) => {
      const texto = error instanceof Error ? error.message : "No se ha podido enviar.";

      trabajo.estado = "fallo";
      trabajo.error = texto;
      avisa();
      avisaHecho({ ok: false, titulo: `${pedido.rotulo}: no se ha enviado`, texto, accion: { label: "Reintentar", onClick: () => trabajoEnvios.reintenta(pedido.clave) } });
    },
  );
}

export const trabajoEnvios = {
  suscribe(oyente: () => void) {
    oyentes.add(oyente);

    return () => {
      oyentes.delete(oyente);
    };
  },

  foto: () => foto,

  /** Si este envío ya está en marcha (para no lanzar otro igual). */
  enMarcha: (clave: string) => trabajos.get(clave)?.estado === "enviando",

  /** Cuántos se están enviando (para el aviso antes de cerrar la pestaña). */
  enviando: () => [...trabajos.values()].filter((t) => t.estado === "enviando").length,

  /** Lanza un envío. Devuelve `false` si ya había uno igual en marcha. */
  lanza(pedido: Pedido) {
    if (trabajoEnvios.enMarcha(pedido.clave)) return false;

    const trabajo: Interno = { clave: pedido.clave, rotulo: pedido.rotulo, estado: "enviando", paso: "", pedido: Date.now(), pedidoOriginal: pedido };

    trabajos.set(pedido.clave, trabajo);
    corre(trabajo);

    return true;
  },

  reintenta(clave: string) {
    const t = trabajos.get(clave);

    if (!t || t.estado === "enviando") return;

    corre(t);
  },

  /** Quita del panel uno fallado o uno de WhatsApp ya mandado. */
  quita(clave: string) {
    const t = trabajos.get(clave);

    if (!t || t.estado === "enviando") return;

    trabajos.delete(clave);
    avisa();
  },
};
