/**
 * QUIÉN MARCA A QUIÉN EN EL CÓRNER DEFENSIVO (27/10/2026).
 *
 * Una propuesta, no una orden: cruza su once (el marcado en Plantillas
 * rivales o su último de BeSoccer) con lo que se sabe de cada uno por arriba
 * —remates de ABP en nuestras hojas y en su scouting, la etiqueta «rematador
 * de ABP», la altura y los duelos aéreos de Wyscout— y nuestro once con la
 * altura y los duelos aéreos de Wyscout. El más peligroso de ellos, para el
 * mejor de los nuestros por alto; y así hacia abajo.
 *
 * Aquí sólo hay cuentas: quien llama trae los datos.
 */

export type Atacante = {
  clave: string;
  nombre: string;
  dorsal: string;
  posicion: string;
  altura: number | null;
  aereoPct: number | null;
  aereos90: number | null;
  /** Remates a balón parado registrados (nuestras hojas + su scouting). */
  remates: number;
  remataAbp: boolean;
};

export type Marcador = {
  playerId: string;
  nombre: string;
  altura: number | null;
  aereoPct: number | null;
  aereos90: number | null;
  /** Ya estaba en esa marca de la diapositiva: se respeta el puesto. */
  puesto?: string | null;
};

export type Emparejamiento = {
  marcador: Marcador;
  atacante: Atacante;
  /** «1,92 · 7 remates ABP · 61 % aéreos», lo que justifica el cruce. */
  motivo: string;
};

const PORTERO = /portero|^po?r?$|^gk$/i;

/** Lo que pesa un rematador: lo que ha hecho primero, lo que mide después. */
export function peligro(a: Atacante) {
  return (
    a.remates * 3 +
    (a.remataAbp ? 5 : 0) +
    Math.max(0, ((a.altura ?? 178) - 175) / 3) +
    (a.aereoPct ?? 40) / 12 +
    (a.aereos90 ?? 2) / 2
  );
}

/** Lo que vale uno de los nuestros para marcar por arriba. */
export function poderAereo(m: Marcador) {
  return Math.max(0, ((m.altura ?? 178) - 175) / 3) + (m.aereoPct ?? 40) / 12 + (m.aereos90 ?? 2) / 3;
}

const metros = (cm: number | null) => (cm ? `${(cm / 100).toFixed(2).replace(".", ",")} m` : "");

export function motivoDe(a: Atacante) {
  return [
    metros(a.altura),
    a.remates ? `${a.remates} ${a.remates === 1 ? "remate" : "remates"} ABP` : a.remataAbp ? "rematador de ABP" : "",
    a.aereoPct != null ? `${Math.round(a.aereoPct)} % aéreos` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Empareja por orden: su más peligroso con nuestro mejor por alto. Sin su
 * portero, y tantas marcas como marcadores haya.
 */
export function proponMarcas(atacantes: Atacante[], marcadores: Marcador[]): Emparejamiento[] {
  const suyos = atacantes
    .filter((a) => !PORTERO.test(a.posicion.trim()))
    .sort((a, b) => peligro(b) - peligro(a));

  const nuestros = [...marcadores].sort((a, b) => poderAereo(b) - poderAereo(a));

  return nuestros.slice(0, suyos.length).map((marcador, i) => ({ marcador, atacante: suyos[i], motivo: motivoDe(suyos[i]) }));
}
