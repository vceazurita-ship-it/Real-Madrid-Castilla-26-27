"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { EstadoError, Hueso } from "@/components/ui/estados";
import { chipInk } from "@/lib/theme";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { guardaEnLaHoja, leeRivales } from "@/lib/hojaRivales";
import { traeJson } from "@/lib/hojaCsv";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { conTildes } from "@/lib/rivals/tildes";
import { completaNombres } from "@/lib/rivals/completa-nombres";
import { comoNombre } from "@/lib/duelos-onces";
import { formatea } from "@/lib/data-analisis/metricas";
import { aJornada, claveFecha } from "@/lib/abp/jornada";
import { POR_VENIR, cargaOrdenRivales, claveDeHoy, jornadaJugada, proximosEnfrentamientos } from "@/lib/rivals/orden-calendario";
import { toast } from "sonner";
import { AutoSaveStatus } from "@/components/save-guard/AutoSaveStatus";
import { ColumnasPerdidas } from "@/components/save-guard/ColumnasPerdidas";
import RecursosRival, {
  type RecursoFijo,
} from "@/components/rivals/RecursosRival";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { AvisoLento } from "@/components/rivals/AvisoLento";
import { TiraJornadas } from "@/components/rivals/TiraJornadas";
import { useEscudos } from "@/hooks/useEscudos";
import { useLento } from "@/hooks/useLento";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flame,
  Loader2,
  MapPin,
  Pencil,
} from "lucide-react";

/* Los campos que la hoja RIVALES no tiene viven aquí, en Supabase, con el
   `ID` del rival por clave. Ver `CAMPOS_REMOTOS`, más abajo. */
const EXTRA_DOC_KEY = "scout-rival-colectivo-extra";
const EXTRA_DOC_KIND = "scout-rival";

type Rival = Record<string, string>;

/** Lo que la hoja no guarda: `{ "RIV-01": { CAMPO: "texto" } }`. */
type Extras = Record<string, Record<string, string>>;

import {
  CONCLUSIONES,
  SECTIONS,
  type FieldDef,
} from "@/lib/rivals/scout-colectivo-campos";

const ALL_FIELDS = [
  ...SECTIONS.flatMap((s) => s.bloques.flatMap((b) => b.campos)),
  ...CONCLUSIONES,
];

/** Los que no van a la hoja. Se resuelve una vez, no en cada tecla. */
const CAMPOS_REMOTOS = new Set(
  ALL_FIELDS.filter((f) => f.remoto).map((f) => f.campo),
);

/*
| Las columnas de la hoja que se editan en esta pantalla: el informe, los
| datos del partido de la cabecera y los recursos fijos. Es lo único que se
| manda encima de la fila recién leída; el resto de la fila —el plan de
| partido, sobre todo— se deja como esté en la hoja.
*/
const CAMPOS_DE_ESTA_PANTALLA = [
  ...ALL_FIELDS.filter((f) => !f.remoto).map((f) => f.campo),
  "JORNADA",
  "FECHA",
  "LOCAL_VISITANTE",
  "VIDEO",
  "HUDL_PLAYLIST",
  "DOC",
];

const NAV = [
  { id: "datos", label: "Datos y recursos" },
  { id: "ofensivo", label: "Fase ofensiva" },
  { id: "defensivo", label: "Fase defensiva" },
  { id: "conclusiones", label: "Conclusiones" },
];

function formatDate(value?: string, sinAnio = false) {
  if (!value) return "";

  /* «05/10/2026» lo leía `new Date` a la americana (5 de mayo) y con día
     mayor que 12 no la entendía: se pasa antes por `claveFecha`, y se monta
     a mediodía de aquí para no caer en el día de al lado (19/10/2026).
     Menos un instante con zona («…T22:00:00.000Z», la medianoche de Madrid
     que manda la hoja): `claveFecha` lo recorta y daría el día anterior, así
     que ése va tal cual por `new Date`, que lo pasa a la hora de aquí. */
  const conZona = /T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const clave = conZona ? "" : claveFecha(value);
  const date = clave ? new Date(`${clave}T12:00:00`) : new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date
        .toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
          ...(sinAnio ? {} : { year: "numeric" }),
        })
        .replace(/\.$/, "");
}

/* Un campo con sólo «-», «—», «–» o «.» es un hueco que dejó el analista, no un dato (29/10/2026). */
function esVacio(texto: string) {
  return /^[\s\-—–.]*$/.test(texto);
}

/*
| Las siglas que usa el analista al escribir (29/10/2026). Al pie del informe
| salen sólo las que aparecen en el texto: lo que no está no se explica.
| La sigla tiene que ir suelta, no dentro de otra palabra («CRUCE» no es CR).
*/
const SIGLAS: { sigla: string; patron: RegExp; significado: string }[] = [
  { sigla: "PT", patron: /(?<![\p{L}\d])PTs?(?![\p{L}\d])/u, significado: "portero" },
  { sigla: "CT", patron: /(?<![\p{L}\d])CTs?(?![\p{L}\d])/u, significado: "central" },
  { sigla: "LT", patron: /(?<![\p{L}\d])LTs?(?![\p{L}\d])/u, significado: "lateral" },
  { sigla: "MC / MCs", patron: /(?<![\p{L}\d])MCs?(?![\p{L}\d])/u, significado: "mediocentro(s)" },
  { sigla: "MP", patron: /(?<![\p{L}\d])MPs?(?![\p{L}\d])/u, significado: "mediapunta" },
  { sigla: "EX", patron: /(?<![\p{L}\d])EXs?(?![\p{L}\d])/u, significado: "extremo" },
  { sigla: "DC", patron: /(?<![\p{L}\d])DCs?(?![\p{L}\d])/u, significado: "delantero centro" },
  { sigla: "CP", patron: /(?<![\p{L}\d])CP(?![\p{L}\d])/u, significado: "ataque posicional" },
  { sigla: "CR", patron: /(?<![\p{L}\d])CR(?![\p{L}\d])/u, significado: "contraataque" },
  /* 29/10/2026: a estas tres se les habían caído las barras del patrón ([p{L}d]). */
  { sigla: "MdJ", patron: /(?<![\p{L}\d])MdJ(?![\p{L}\d])/u, significado: "día de partido (MD-1: un día antes)" },
  { sigla: "Z1 / Z2", patron: /(?<![\p{L}\d])Z[123](?![\p{L}\d])/u, significado: "zonas del campo" },
  { sigla: "PTO", patron: /(?<![\p{L}\d])PTO(?![\p{L}\d])/u, significado: "portero" },
  { sigla: "Intervalo", patron: /(?<![\p{L}\d])intervalos?(?![\p{L}\d])/iu, significado: "distancia entre líneas (o entre dos jugadores de la misma línea)" },
  { sigla: "ABP", patron: /(?<![\p{L}\d])ABPs?(?![\p{L}\d])/u, significado: "balón parado" },
];

type FilaEstilo = {
  nombre: string;
  valor: number;
  mediana: number;
  unidad: "porcentaje" | "decimal" | "entero" | "minutos";
};

/*
| Una cifra de Wyscout en lenguaje de vestuario, una por línea (29/10/2026).
| El PPDA son los pases que deja dar el equipo por cada acción defensiva:
| cuantos menos, más arriba aprieta. Se dice así y no con la sigla.
*/
function lineaEstilo(f: FilaEstilo) {
  if (f.nombre !== "PPDA") {
    return `${f.nombre}: ${formatea(f.valor, f.unidad)} (la mediana de la liga es ${formatea(f.mediana, f.unidad)})${/posesi/i.test(f.nombre) ? " · más posesión, más control del juego" : ""}`;
  }

  const uno = (n: number) => n.toFixed(1).replace(".", ",");
  const cerca = Math.abs(f.valor - f.mediana) <= Math.max(Math.abs(f.mediana) * 0.05, 0.0001);
  const lectura = cerca
    ? "aprieta como la mayoría"
    : f.valor < f.mediana
      ? "aprieta más arriba que la mayoría"
      : "espera más abajo que la mayoría";

  return `Presión: ${lectura} (deja ${uno(f.valor)} pases por acción defensiva; la mediana deja ${uno(f.mediana)}) · menos pases, más presión`;
}

/**
 * Plan de partido de este mismo rival.
 *
 * Las dos páginas leen la misma hoja (`action=rivales`), así que el ID basta
 * para que el plan abra el partido que se está scouteando.
 */
function enlacePlanDePartido(rival: Rival | null) {
  const id = String(rival?.ID ?? "").trim();

  return id
    ? `/match-preparation?rival=${encodeURIComponent(id)}`
    : "/match-preparation";
}

/**
 * La pizarra de balón parado de este mismo partido.
 *
 * La pizarra se monta sobre el calendario, no sobre esta hoja: traduce el
 * `ID` a un partido al llegar —por tablero ya atado, por fecha o por nombre—.
 */
function enlacePizarraAbp(rival: Rival | null) {
  const id = String(rival?.ID ?? "").trim();

  return id ? `/abp-pizarra?rival=${encodeURIComponent(id)}` : "/abp-pizarra";
}

export default function ScoutRivalCollective() {
  /* La fecha del partido, la de BeSoccer (29/10/2026, experto de fútbol): la
     hoja trae «…T23:00:00Z» (el 1/11 en Madrid) y se juega el sábado 31/10.
     Sólo cambia lo que se ve; el campo FECHA de la hoja no se toca. */
  const [fechasReales, setFechasReales] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;

    void cargaOrdenRivales().then((orden) => {
      if (!vivo) return;

      const mapa: Record<string, string> = {};

      for (const partido of orden.partidos) {
        if (partido.fecha && partido.jornada) mapa[`${partido.equipo}|${partido.jornada}`] = partido.fecha;
      }

      setFechasReales(mapa);
    });

    return () => {
      vivo = false;
    };
  }, []);

  const [rivales, setRivales] = useState<Rival[]>([]);
  const [rivalActivo, setRivalActivo] = useState<Rival | null>(null);
  const fechaVista = fechasReales[`${rivalActivo?.EQUIPO}|${rivalActivo?.JORNADA}`] ?? rivalActivo?.FECHA;

  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  /* «Reintentar» relanza la carga saltándose la copia del aparato. */
  const [intento, setIntento] = useState(0);
  /* Última jornada que enseña el desplegable: la del próximo partido. */
  const [limiteJornada, setLimiteJornada] = useState<number | null>(null);

  const escudoDe = useEscudos();

  /* El informe y el plan de partido comparten fila: si la hoja no tiene la
     columna, el valor se descarta en silencio. Se verifica tras guardar. */
  const {
    verificar: verificarGuardado,
    dialogo: avisoGuardado,
    columnasPerdidas,
  } = useSaveGuard();

  useEffect(() => {
    let cancelled = false;

    /* Por `/api/rivals` y su caché, no directa al Apps Script: directa eran
       30-70 s en frío cada vez que se abría la pantalla. */
    Promise.all([
      traeJson<unknown>("/api/rivals?action=rivales", { forzar: intento > 0 }).then((respuesta) => {
        /* Si Google falla, la ruta contesta `{ success: false }`. */
        if (!Array.isArray(respuesta)) throw new Error("Sin filas");

        return respuesta as Rival[];
      }),
      /* Hasta qué jornada se ha jugado, según BeSoccer: la hoja fecha los
         partidos como estaban previstos y un adelanto la deja atrás. */
      jornadaJugada(),
    ])
      .then(([data, jugada]: [Rival[], number]) => {
        if (cancelled) return;

        setRivales(data);

        /* Enlace directo desde el plan de partido:
           /scout-rival-collective?rival=<ID>. */
        const enlazado = new URLSearchParams(window.location.search).get(
          "rival"
        );

        /*
        | Sin enlace, la fila del PRÓXIMO partido y no la primera jornada:
        | abrir en Teruel en octubre obligaba a bajar la lista cada vez. Es la
        | misma regla que ordena las plantillas (`proximosEnfrentamientos`), y
        | sólo se fía de ella cuando la fila tiene fecha por delante.
        */
        const jornadas = data.map(aJornada);

        const proximo = proximosEnfrentamientos(jornadas, claveDeHoy(), jugada)[0];

        const filaProxima =
          proximo && proximo.grupo === POR_VENIR
            ? jornadas.find(
                (j) => j.jornada === proximo.jornada && j.equipo === proximo.equipo,
              )?.fila ?? null
            : null;

        if (proximo && proximo.grupo === POR_VENIR) {
          const n = Number(proximo.jornada);

          setLimiteJornada(Number.isFinite(n) ? n : null);
        }

        setRivalActivo(
          data.find((r) => String(r.ID) === String(enlazado)) ??
            filaProxima ??
            (data.length ? data[0] : null)
        );

        if (enlazado)
          window.history.replaceState({}, "", "/scout-rival-collective");

        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [intento]);

  const reintenta = useCallback(() => {
    setCargando(true);
    setError(false);
    setIntento((n) => n + 1);
  }, []);

  /* A los 25 s sin respuesta se avisa y se deja reintentar (24/10/2026). */
  const lento = useLento(cargando);

  /*
  | Contexto del rival (24/10/2026): los nombres de su plantilla, para completar
  | «Ángel, Aleix» con el apellido, y su posesión y presión frente a la liga.
  */
  const [plantillaRival, setPlantillaRival] = useState<Record<string, unknown>[]>([]);
  const [estilo, setEstilo] = useState<{
    equipo: string;
    filas: FilaEstilo[];
    /* Cuántos equipos entran en la mediana, si la respuesta lo trae. */
    equipos?: number;
  }>({ equipo: "", filas: [] });

  useEffect(() => {
    let cancelado = false;

    traeJson<unknown>("/api/rivals?action=rivalesPlantillas")
      .then((filas) => {
        if (!cancelado && Array.isArray(filas)) setPlantillaRival(filas as Record<string, unknown>[]);
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, []);

  const equipoActivo = String(rivalActivo?.EQUIPO ?? "");

  useEffect(() => {
    if (!equipoActivo) return;

    let cancelado = false;

    traeJson<{
      ok?: boolean;
      equipos?: number;
      aspectos?: { filas: FilaEstilo[] }[];
    }>(`/api/data-analisis?abpRival=${encodeURIComponent(equipoActivo)}&ambito=estilo&v=1`)
      .then((r) => {
        if (!cancelado)
          setEstilo({
            equipo: equipoActivo,
            filas: r?.ok ? (r.aspectos ?? []).flatMap((a) => a.filas) : [],
            equipos: r?.ok && typeof r.equipos === "number" && r.equipos > 0 ? r.equipos : undefined,
          });
      })
      .catch(() => {
        if (!cancelado) setEstilo({ equipo: equipoActivo, filas: [] });
      });

    return () => {
      cancelado = true;
    };
  }, [equipoActivo]);

  const nombresRival = useMemo(
    () =>
      plantillaRival
        .filter((f) => mismoClub(String(f.NOMBRE_EQUIPO ?? ""), equipoActivo))
        .map((f) => conTildes(comoNombre(String(f["NOMBRE DEPORTIVO"] ?? "").trim() || String(f.JUGADOR ?? "").trim())))
        .filter(Boolean),
    [plantillaRival, equipoActivo],
  );

  const contexto = estilo.equipo === equipoActivo ? estilo.filas : [];
  const equiposLiga = estilo.equipo === equipoActivo ? estilo.equipos : undefined;

  /* Puente hacia el `flush` del autoguardado: `cambiarRival` se declara antes
     que el hook y necesita poder consolidar lo pendiente. Dice si lo pendiente
     ha llegado a la hoja. */
  const flushPendiente = useRef<() => Promise<boolean>>(async () => true);

  /*
  | El desplegable: el partido que toca y los ya jugados, no las 38 jornadas.
  | Se quedan también el rival abierto y, en edición, todos, por si el
  | analista adelanta trabajo.
  */
  const visibles = useMemo(() => {
    if (modoEdicion || limiteJornada === null) return rivales;

    return rivales.filter((r) => {
      const n = Number(r.JORNADA);

      return (
        !Number.isFinite(n) ||
        n <= limiteJornada ||
        String(r.ID) === String(rivalActivo?.ID)
      );
    });
  }, [rivales, limiteJornada, modoEdicion, rivalActivo]);

  const indice = useMemo(
    () =>
      rivalActivo
        ? visibles.findIndex((r) => String(r.ID) === String(rivalActivo.ID))
        : -1,
    [visibles, rivalActivo]
  );

  /*
  |--------------------------------------------------------------------------
  | LO QUE LA HOJA NO GUARDA
  |--------------------------------------------------------------------------
  |
  | El bloque de transición ofensiva no tiene columnas en la hoja RIVALES, así
  | que vive en Supabase con el `ID` del rival por clave. Se guarda solo, con
  | su propio retardo, y en la pantalla no se distingue de los demás campos:
  | `valorDe` y `setCampo` mandan cada campo a donde le toque.
  */
  const { value: extras, setValue: setExtras } = useRemoteDoc<Extras>({
    key: EXTRA_DOC_KEY,
    kind: EXTRA_DOC_KIND,
    fallback: {},
  });

  const idRival = String(rivalActivo?.ID ?? "");

  const valorDe = useCallback(
    (campo: string) =>
      CAMPOS_REMOTOS.has(campo)
        ? String(extras[idRival]?.[campo] ?? "")
        : String(rivalActivo?.[campo] ?? ""),
    [extras, idRival, rivalActivo]
  );

  /* Cuántos campos del informe están rellenos: da sensación de progreso. */
  const completados = useMemo(() => {
    if (!rivalActivo) return 0;

    return ALL_FIELDS.filter((f) => !esVacio(valorDe(f.campo))).length;
  }, [rivalActivo, valorDe]);

  const tiene = useCallback(
    (f: FieldDef) => !esVacio(valorDe(f.campo)),
    [valorDe]
  );

  /* Una línea de conclusión sin la viñeta del principio. */
  const limpiaLinea = (l: string) => l.replace(/^[\s\-–•*·]+/, "").trim();

  /* La primera línea de las tres conclusiones que más se buscan. */
  const esencial = (() => {
    const campos = ["JUGADORES_CLAVE", "DEBILIDADES_INDIVIDUALES"].map((campo) => ({
      campo,
      titulo: CONCLUSIONES.find((f) => f.campo === campo)?.titulo ?? "",
      lineas: valorDe(campo)
        .split(/\r?\n/)
        .map(limpiaLinea)
        .filter((l) => !esVacio(l)),
    }));
    const corta = (t: string) => {
      const completo = completaNombres(t, nombresRival);

      return completo.length > 180 ? `${completo.slice(0, 177).trimEnd()}…` : completo;
    };
    /* `entera`: la línea cabe sin recortar, así que en «Conclusiones» ya no hace falta repetirla. */
    const idea = (c: (typeof campos)[number], l: string) => ({ campo: c.campo, titulo: c.titulo, texto: corta(l), linea: l, entera: completaNombres(l, nombresRival).length <= 180 });
    /* La primera línea de cada conclusión; si faltan, las siguientes de las que tengan más hasta llegar a tres. */
    const ideas = campos.flatMap((c) => (c.lineas[0] ? [idea(c, c.lineas[0])] : []));

    for (let n = 1; ideas.length < 3 && campos.some((c) => c.lineas[n]); n++) {
      for (const c of campos) {
        if (ideas.length < 3 && c.lineas[n]) ideas.push(idea(c, c.lineas[n]));
      }
    }

    return ideas;
  })();

  /*
  | Lo que queda de cada conclusión tras «Lo esencial» (29/10/2026): las
  | líneas que ya salen enteras arriba no se repiten abajo. En edición se ve
  | el campo entero, que es lo que se escribe.
  */
  const restoConclusion = (campo: string) => {
    const valor = valorDe(campo);

    if (modoEdicion) return valor;

    const arriba = new Set(esencial.filter((e) => e.campo === campo && e.entera).map((e) => e.linea));

    if (!arriba.size) return valor;

    return valor
      .split(/\r?\n/)
      .filter((l) => !arriba.has(limpiaLinea(l)))
      .join("\n");
  };

  /* Estado del equipo y claves emocionales ya están en el Plan de partido (29/10/2026): en lectura no se repiten aquí.
     Tampoco «Claves del partido», que es la misma frase de «Lo lleva el Plan de Partido»: en su sitio, el enlace. */
  const YA_EN_EL_PLAN = ["ESTADO_EQUIPO", "CLAVES_EMOCIONALES", "CLAVES_PARTIDO"];
  const conclusionesVisibles = CONCLUSIONES.filter(
    (f) => modoEdicion || (!YA_EN_EL_PLAN.includes(f.campo) && !esVacio(restoConclusion(f.campo))),
  );

  /* Las siglas que aparecen en lo que ha escrito el analista. */
  const siglasUsadas = (() => {
    const texto = ALL_FIELDS.map((f) => valorDe(f.campo)).join("\n");

    return SIGLAS.filter((s) => s.patron.test(texto));
  })();

  /* ¿Se pinta esta sección? En lectura, sólo si algún campo tiene texto. */
  const seccionVisible = (id: string) => {
    if (modoEdicion) return true;

    if (id === "conclusiones") return conclusionesVisibles.length > 0;

    const seccion = SECTIONS.find((s) => s.id === id);

    return !!seccion?.bloques.some((b) => b.campos.some(tiene));
  };

  /* El rival abierto, al día, para quien lo lea después de un `await`. */
  const rivalActivoRef = useRef<Rival | null>(rivalActivo);

  useEffect(() => {
    rivalActivoRef.current = rivalActivo;
  }, [rivalActivo]);

  /* Hay un archivo subiéndose a los recursos de este rival (ver `RecursosRival`). */
  const subiendoRecursos = useRef(false);

  const cambiarRival = useCallback(
    (rival: Rival | undefined) => {
      if (!rival) return;

      /*
      | A media subida no se cambia (07/10/2026): el archivo llegaría al
      | bucket pero no a la lista del rival, que se desmonta con el cambio.
      */
      if (subiendoRecursos.current) {
        toast.warning("Espera a que termine la subida", {
          description:
            "Se está subiendo un archivo a los recursos de este rival. En cuanto acabe, puedes cambiar.",
        });

        return;
      }

      /* Cambiar de rival con el retardo del autoguardado a medias se llevaría
         por delante lo último escrito: primero se consolida, luego se cambia. */
      void flushPendiente.current().then((guardado) => {
        const actual = rivalActivoRef.current;

        /*
        | Lo escrito se deja también en la lista. Si no, al volver a este rival
        | se abría la fila tal y como se leyó al entrar: lo tecleado desde
        | entonces desaparecía de la pantalla aunque estuviera en la hoja.
        */
        if (actual) {
          setRivales((previo) =>
            previo.map((r) => (String(r.ID) === String(actual.ID) ? actual : r))
          );
        }

        /*
        | Y si no ha llegado a la hoja, no se cambia. Cambiar era darlo por
        | perdido: el autoguardado toma el rival nuevo como base y lo que
        | fallaba del anterior ya no lo reintenta nadie.
        */
        if (!guardado) {
          toast.error("No se ha podido guardar el informe de este rival", {
            description:
              "No se cambia de rival hasta que llegue a la hoja: se sigue reintentando solo. Si no hay conexión, espera a que vuelva.",
          });

          return;
        }

        setRivalActivo(rival);
      });
    },
    []
  );

  const setCampo = useCallback(
    (campo: string, valor: string) => {
      if (CAMPOS_REMOTOS.has(campo)) {
        /* Sin rival elegido no hay dónde colgarlo; tampoco hay formulario. */
        if (!idRival) return;

        setExtras((actual) => ({
          ...actual,
          [idRival]: { ...(actual[idRival] ?? {}), [campo]: valor },
        }));

        return;
      }

      setRivalActivo((prev) => (prev ? { ...prev, [campo]: valor } : prev));
    },
    [idRival, setExtras]
  );

  const empezarEdicion = () => {
    setModoEdicion(true);
  };

  /*
  |--------------------------------------------------------------------------
  | AUTOGUARDADO
  |--------------------------------------------------------------------------
  |
  | En edición ya no hay botón de guardar: el informe sale solo hacia la hoja
  | cada vez que el usuario para de escribir. Y como la hoja escribe por
  | nombre de columna y descarta en silencio lo que no tiene cabecera, cada
  | envío se sigue verificando releyendo la fila.
  |
  | `modoAuto` hace que el aviso a pantalla completa salga sólo la primera vez
  | que aparece una columna perdida; a partir de ahí vive en la banda roja de
  | la cabecera, que no se puede cerrar por error.
  */

  /* Si el último guardado llegó a la hoja. Lo lee `cambiarRival` tras el
     `flush`: el estado del hook todavía no se ha repintado en ese momento. */
  const ultimoGuardadoOk = useRef(true);

  /*
  | La base contra la que se mira qué campos ha tocado el usuario (07/10/2026):
  | la fila tal y como se cargó —o como se ve fuera de edición— y, después,
  | lo último que llegó a la hoja. En edición sólo la mueve un guardado bueno
  | o el cambio de rival (ver el efecto tras `useAutoSave`).
  */
  const baseGuardado = useRef<Rival | null>(rivalActivo);

  const escribirEnLaHoja = useCallback(
    async (rival: Rival) => {
      /*
      |----------------------------------------------------------------------
      | SÓLO LO QUE SE EDITA AQUÍ
      |----------------------------------------------------------------------
      |
      | La fila la comparte el plan de partido (`/match-preparation`), que
      | escribe con la misma acción. Mandar la fila entera tal y como se leyó
      | al abrir devolvía a la hoja el plan de ESE momento: lo que se hubiera
      | escrito en el plan desde entonces desaparecía. Así que justo antes de
      | escribir se relee la fila y encima se ponen sólo los campos de esta
      | pantalla. Sin relectura no se escribe: el autoguardado reintenta.
      */
      const filas = await leeRivales();

      const fresca = filas.find((r) => String(r.ID) === String(rival.ID));

      /*
      | Y de esos, sólo los que han cambiado respecto a la base (07/10/2026):
      | lo cargado o lo último que llegó a la hoja. Los campos sin tocar se
      | mandaban tal y como se leyeron al abrir, encima de lo que otro hubiera
      | escrito en ellos desde entonces.
      */
      const base = baseGuardado.current;
      const mismaBase = String(base?.ID ?? "") === String(rival.ID ?? "");

      const editados: Rival = { ID: String(rival.ID ?? "") };

      for (const campo of CAMPOS_DE_ESTA_PANTALLA) {
        if (!(campo in rival)) continue;

        const valor = String(rival[campo] ?? "");

        if (mismaBase && fresca && valor === String(base?.[campo] ?? "")) continue;

        editados[campo] = valor;
      }

      const aMandar: Rival = fresca
        ? { ...fresca, ...editados, ID: String(rival.ID ?? "") }
        : rival;

      /* En JSON, no como formulario: el `doPost` de la hoja pasa el cuerpo por
         `JSON.parse` y un formulario se estrella antes de guardar nada
         (`lib/hojaRivales.ts`). */
      await guardaEnLaHoja("guardarRival", aMandar);

      const verificacion = await verificarGuardado({
        titulo: `Informe de scouting · ${rival.EQUIPO ?? ""}`,
        /* Se comprueba lo que es de esta pantalla: el resto es de la hoja. */
        enviado: editados,
        registro: rival,
        ignorar: ["FECHA"],
        modoAuto: true,
        releer: async () => {
          try {
            const filas = await leeRivales();

            return filas.find((r) => String(r.ID) === String(rival.ID)) ?? null;
          } catch {
            /* Con autoguardado una relectura fallida no avisa: pasa en
               cualquier corte de red y el siguiente intento lo resuelve. */
            return null;
          }
        },
      });

      /*
      | Una columna que la hoja no tiene no va a aparecer en el intento
      | siguiente: devolver `false` hacía que el autoguardado reescribiera la
      | fila sin fin. Si el envío llegó y sólo faltan columnas, está guardado
      | todo lo que se puede guardar; la pérdida se sigue enseñando en la banda
      | roja de la cabecera (`columnasPerdidas`).
      */
      const soloColumnas =
        !verificacion.ok &&
        verificacion.perdidos.every((p) => p.motivo === "columna-inexistente");

      const bueno = verificacion.ok || soloColumnas;

      if (bueno) {
        /* Lo enviado pasa a ser la base, salvo que mientras volaba se haya
           cambiado de rival. */
        if (String(baseGuardado.current?.ID ?? "") === String(rival.ID ?? "")) {
          baseGuardado.current = rival;
        }

        setRivales((previo) =>
          previo.map((r) => (String(r.ID) === String(rival.ID) ? aMandar : r))
        );
      }

      return bueno;
    },
    [verificarGuardado]
  );

  const guardarEnLaHoja = useCallback(
    async (rival: Rival | null) => {
      if (!rival) return true;

      try {
        const bueno = await escribirEnLaHoja(rival);

        ultimoGuardadoOk.current = bueno;

        return bueno;
      } catch (error) {
        ultimoGuardadoOk.current = false;

        throw error;
      }
    },
    [escribirEnLaHoja]
  );

  const auto = useAutoSave<Rival | null>({
    value: rivalActivo,
    enabled: modoEdicion,
    debounce: 1800,
    save: guardarEnLaHoja,
    /* Una copia por rival, como el plan de partido: lo que no llegue a la
       hoja sobrevive a cerrar la pestaña. Sin `ID` no hay a qué fila
       devolverlo, así que no hay copia. */
    respaldo: rivalActivo?.ID ? `scout-rival:${rivalActivo.ID}` : undefined,
  });

  const { flush: flushAuto, pending: hayPendiente } = auto;

  /* Fuera de edición lo que se ve es la base, salvo que quede algo sin llegar
     a la hoja: entonces la base sigue siendo la de antes y el reintento manda
     lo que falta. */
  useEffect(() => {
    const otroRival =
      String(baseGuardado.current?.ID ?? "") !== String(rivalActivo?.ID ?? "");

    if (otroRival || (!modoEdicion && !hayPendiente)) {
      baseGuardado.current = rivalActivo;
    }
  }, [modoEdicion, rivalActivo, hayPendiente]);

  useEffect(() => {
    flushPendiente.current = async () => {
      /* Si no hay nada pendiente, `flush` no llega a guardar y esto se queda
         en `true`, que es lo que es. */
      ultimoGuardadoOk.current = true;

      await flushAuto();

      return ultimoGuardadoOk.current;
    };
  }, [flushAuto]);

  /* Cambiar de rival no es una edición: se toma como nueva base. */
  const idRivalActivo = String(rivalActivo?.ID ?? "");
  const idAnterior = useRef(idRivalActivo);

  useEffect(() => {
    if (idAnterior.current === idRivalActivo) return;

    idAnterior.current = idRivalActivo;

    auto.sync();
  }, [idRivalActivo, auto]);

  const terminarEdicion = useCallback(async () => {
    setGuardando(true);

    try {
      await auto.flush();
    } finally {
      setGuardando(false);
    }

    setModoEdicion(false);
  }, [auto]);

  /*
  | Lo que no llegó a la hoja en otra visita se ofrece al abrir ese rival,
  | sólo si de verdad dice algo distinto de la fila. Recuperar es ponerlo en
  | pantalla y abrir la edición: el autoguardado lo escribe como cualquier
  | otro cambio, con su verificación.
  */
  const { recuperado, descartaRecuperado } = auto;

  useEffect(() => {
    const copia = recuperado?.valor;

    if (!copia || !rivalActivo || modoEdicion) return;

    if (String(copia.ID ?? "") !== String(rivalActivo.ID ?? "")) return;

    const distinto = Object.keys({ ...rivalActivo, ...copia }).some(
      (campo) =>
        campo !== "FECHA" &&
        String(copia[campo] ?? "") !== String(rivalActivo[campo] ?? "")
    );

    if (!distinto) return;

    toast.info("Hay cambios de este informe que no llegaron a la hoja", {
      id: `scout-recuperado-${rivalActivo.ID}`,
      duration: 30000,
      description: "Se quedaron guardados en este navegador.",
      action: {
        label: "Recuperar",
        onClick: () => {
          /* El aviso dura medio minuto: si entretanto se ha cambiado de
             rival, «Recuperar» devolvía la pantalla al de antes saltándose
             el guardado del nuevo (19/10/2026). */
          if (String(rivalActivoRef.current?.ID ?? "") !== String(rivalActivo.ID ?? "")) {
            toast.message("Vuelve a ese rival para recuperar sus cambios.");
            return;
          }

          setRivalActivo(copia);
          setModoEdicion(true);
          descartaRecuperado();
        },
      },
      cancel: {
        label: "Descartar",
        onClick: () => descartaRecuperado(),
      },
    });
  }, [recuperado, rivalActivo, modoEdicion, descartaRecuperado]);

  /* Columnas de la hoja que se enseñan dentro de la lista de recursos. */
  const recursosFijos = useMemo<RecursoFijo[]>(
    () => [
      {
        campo: "VIDEO",
        nombre: "Vídeo del partido",
        tipo: "video",
        url: String(rivalActivo?.VIDEO ?? ""),
      },
      {
        campo: "HUDL_PLAYLIST",
        nombre: "HUDL Playlist",
        tipo: "video",
        url: String(rivalActivo?.HUDL_PLAYLIST ?? ""),
      },
      {
        campo: "DOC",
        nombre: "Informe del rival",
        tipo: "doc",
        url: String(rivalActivo?.DOC ?? ""),
      },
    ],
    [rivalActivo]
  );

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="px-4 pb-16 pt-6 sm:px-6 lg:px-10">
          {/* ------------------------------------------------ Cabecera */}
          <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                Scouting colectivo
              </p>

              {/* El escudo firma el informe: el desplegable de abajo es un
                  <select> nativo y no puede llevarlo, así que el club se
                  reconoce aquí. */}
              <h1 className="mt-2 flex min-w-0 items-center gap-3 text-4xl font-black tracking-tight sm:text-5xl">
                {rivalActivo?.EQUIPO && (
                  <EscudoEquipo
                    nombre={rivalActivo.EQUIPO}
                    escudo={escudoDe(rivalActivo.EQUIPO)}
                    lado={48}
                  />
                )}

                {cargando ? (
                  <Hueso className="h-10 w-64" />
                ) : (
                  <span className="min-w-0 truncate">{rivalActivo?.EQUIPO || "Sin rival"}</span>
                )}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/45">
                <span>Informe del rival</span>

                {rivalActivo && modoEdicion && (
                  <span className="tabular-nums" data-export-hide>
                    {completados}/{ALL_FIELDS.length} campos completados
                  </span>
                )}

                {/* El dibujo que se nombra en el texto es el que el analista
                    ha visto en vídeo; el más repetido según Wyscout sale en
                    Plantillas. */}
                {rivalActivo && !modoEdicion && (
                  <span className="text-white/35">
                    Dibujos y estructuras: lo que ha visto el analista en vídeo (el dibujo habitual, el más repetido en sus alineaciones, está en el campograma de Plantillas)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3" data-export-hide>
              <Link
                href={enlacePlanDePartido(rivalActivo)}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                <ClipboardList size={16} />
                Plan de partido
              </Link>

              <Link
                href={enlacePizarraAbp(rivalActivo)}
                title="Abrir la pizarra de balón parado de este partido"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/12 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
              >
                <Flame size={16} />
                Pizarra ABP
              </Link>

              {modoEdicion ? (
                <>
                  <AutoSaveStatus
                    estado={auto.status}
                    guardadoEn={auto.lastSavedAt}
                    onReintentar={() => void auto.flush()}
                  />

                  <button
                    disabled={guardando}
                    onClick={terminarEdicion}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-70"
                  >
                    {guardando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    {guardando ? "Guardando…" : "Hecho"}
                  </button>
                </>
              ) : (
                <button
                  disabled={!rivalActivo}
                  onClick={empezarEdicion}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#C8A96B]/40 px-5 py-3 text-sm font-semibold text-[#E4C977] transition hover:border-[#C8A96B] hover:bg-[#C8A96B]/10 disabled:opacity-40"
                >
                  <Pencil size={16} />
                  Editar
                </button>
              )}
            </div>
          </header>

          {/* 29/10/2026: J1…Jn con el resultado de cada jornada del rival. */}
          {rivalActivo?.EQUIPO && <TiraJornadas equipo={rivalActivo.EQUIPO} />}

          {/* --------------------------------------- Navegación interna */}
          {/*
            Pegada arriba (14/10/2026), como las pestañas del resto de
            análisis: se salta de sección desde el fondo del informe. Sigue
            siendo un único documento —se exporta entero—, por eso son anclas
            y no pestañas.
          */}
          <nav
            data-export-hide
            className="sticky top-0 z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-white/10 bg-[#0B0F14] px-4 py-3 scrollbar-none sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
          >
            {NAV.filter((item) => item.id === "datos" || seccionVisible(item.id)).map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="shrink-0 rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-white/60 transition hover:border-[#C8A96B]/40 hover:bg-[#C8A96B]/10 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {lento && !error && <AvisoLento className="mb-6" onReintentar={reintenta} />}

          {error && (
            <EstadoError
              className="mb-6"
              titulo="No se ha podido cargar la lista de rivales"
              error="Comprueba la conexión."
              onReintentar={reintenta}
              reintentando={cargando}
            />
          )}

          <ColumnasPerdidas columnas={columnasPerdidas} />

          {/* Lo esencial antes de recorrer las secciones: la primera línea de tres conclusiones (23/10/2026). */}
          {!modoEdicion && rivalActivo && esencial.length > 0 && (
            <section aria-label="Lo esencial del rival" className="mb-6 rounded-2xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.06] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">{esencial.length === 1 ? "Lo esencial" : `Lo esencial, en ${esencial.length === 2 ? "dos" : "tres"} ideas`}</p>
              <ul className="mt-2 grid gap-3 md:grid-cols-3">
                {esencial
                  .reduce<{ titulo: string; textos: string[] }[]>((grupos, e) => {
                    const g = grupos.find((x) => x.titulo === e.titulo);
                    if (g) g.textos.push(e.texto);
                    else grupos.push({ titulo: e.titulo, textos: [e.texto] });
                    return grupos;
                  }, [])
                  .map((g) => (
                    <li key={g.titulo} className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{g.titulo}</p>
                      {g.textos.length === 1 ? (
                        <p className="mt-0.5 text-sm leading-6 text-white/85">{g.textos[0]}</p>
                      ) : (
                        <ol className="mt-0.5 list-decimal space-y-1 pl-5 text-sm leading-6 text-white/85">
                          {g.textos.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
              </ul>
              {contexto.length > 0 && (
                /* Cada cifra en su línea y dicha como en el vestuario (29/10/2026). */
                <div className="mt-3 border-t border-[#C8A96B]/15 pt-2 text-sm text-white/85">
                  <p className="text-xs text-white/55">Wyscout, frente a la liga{equiposLiga ? ` (sobre ${equiposLiga} equipos)` : ""}</p>
                  <ul className="mt-1 space-y-0.5">
                    {contexto.map((f) => (
                      <li key={f.nombre}>{lineaEstilo(f)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Link href={enlacePlanDePartido(rivalActivo)} className="mt-3 inline-block text-sm font-semibold text-[#C8A96B] hover:underline">
                Ver Plan de partido →
              </Link>
              <p className="mt-2 text-[11px] text-white/40">
                Fuente: las conclusiones que ha escrito el analista tras ver los partidos del rival
                {conclusionesVisibles.length > 0 ? "; el resto está abajo, en «Conclusiones»" : ""}.
              </p>
            </section>
          )}

          {modoEdicion && (
            <div
              data-export-hide
              className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-5 py-3 text-sm text-amber-200"
            >
              <Pencil size={15} className="shrink-0" />
              Modo edición activo. Los cambios se guardan solos unos segundos
              después de dejar de escribir.
            </div>
          )}

          {/* ----------------------------------- Selector + datos clave */}
          <section id="datos" className="scroll-mt-20">
            {/* En el móvil, flechas y desplegable en una sola fila (29/10/2026). */}
            <div className="mb-6 flex flex-nowrap items-center gap-2 sm:gap-3" data-export-hide>
              <button
                aria-label="Rival anterior"
                disabled={indice <= 0}
                onClick={() => cambiarRival(visibles[indice - 1])}
                className="flex h-[56px] w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#111827] text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>

              {rivales.length === 0 && cargando ? (
                <Hueso className="h-[56px] min-w-0 flex-1 rounded-2xl" />
              ) : (
              <select
                aria-label="Seleccionar rival"
                value={rivalActivo?.ID ?? ""}
                onChange={(e) =>
                  cambiarRival(
                    rivales.find((r) => String(r.ID) === e.target.value)
                  )
                }
                className="h-[56px] min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#111827] px-3 text-base sm:px-4 font-semibold text-white shadow-lg outline-none transition focus:border-[#C8A96B]/60"
              >
                {rivales.length === 0 && <option value="">Sin rivales</option>}

                {visibles.map((r) => (
                  <option key={r.ID} value={r.ID}>
                    J{r.JORNADA} · {r.EQUIPO}
                  </option>
                ))}
              </select>
              )}

              <button
                aria-label="Rival siguiente"
                disabled={indice < 0 || indice >= visibles.length - 1}
                onClick={() => cambiarRival(visibles[indice + 1])}
                className="flex h-[56px] w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#111827] text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* En el móvil, en lectura, los tres datos en una línea: «J10 · 01 nov · Local» (29/10/2026). */}
            {!modoEdicion && (() => {
              const jornada = String(rivalActivo?.JORNADA ?? "").trim();
              const lado = String(rivalActivo?.LOCAL_VISITANTE ?? "").trim();
              const partes = [
                jornada ? (/^\d+$/.test(jornada) ? `J${jornada}` : jornada) : "",
                formatDate(fechaVista, true),
                lado ? lado.charAt(0).toUpperCase() + lado.slice(1).toLowerCase() : "",
              ].filter(Boolean);

              return partes.length > 0 ? (
                <p className="flex items-center gap-2 rounded-2xl border border-white/5 bg-[#111827] px-4 py-3 text-base font-bold sm:hidden">
                  <CalendarDays size={14} className="shrink-0 text-white/40" />
                  {partes.join(" · ")}
                </p>
              ) : null;
            })()}

            <div className={`grid-cols-1 gap-4 sm:grid-cols-3 ${modoEdicion ? "grid" : "hidden sm:grid"}`}>
              <DatoClave
                icon={CalendarDays}
                label="Jornada"
                valor={rivalActivo?.JORNADA}
                editando={modoEdicion}
                onChange={(v) => setCampo("JORNADA", v)}
              />

              <DatoClave
                icon={CalendarDays}
                label="Fecha"
                valor={rivalActivo?.FECHA}
                mostrar={formatDate(fechaVista)}
                editando={modoEdicion}
                onChange={(v) => setCampo("FECHA", v)}
              />

              <DatoClave
                icon={MapPin}
                label="Local / Visitante"
                valor={rivalActivo?.LOCAL_VISITANTE}
                editando={modoEdicion}
                onChange={(v) => setCampo("LOCAL_VISITANTE", v)}
              />
            </div>

            {/* Recursos */}
            <div className="mt-4 hidden rounded-3xl border border-[#C8A96B]/15 bg-[#111827] p-5 has-[[data-recursos-con-datos]]:block">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#C8A96B]">
                  Recursos
                </h2>

                <Link
                  href={enlacePlanDePartido(rivalActivo)}
                  data-export-hide
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-4 py-2 text-sm font-semibold text-[#E4C977] transition hover:border-[#C8A96B] hover:bg-[#C8A96B]/20"
                >
                  <ClipboardList size={14} />
                  Abrir plan de partido
                </Link>
              </div>

              {/* Los vídeos y documentos nuevos van a Supabase; las columnas de
                  la hoja se pintan aquí mismo para no partir la lista en dos. */}
              <RecursosRival
                key={String(rivalActivo?.ID ?? "")}
                idRival={String(rivalActivo?.ID ?? "")}
                editando={modoEdicion}
                fijos={recursosFijos}
                onCampoFijo={setCampo}
                onSubiendo={(si) => {
                  subiendoRecursos.current = si;
                }}
              />
            </div>
          </section>

          {/* ------------------------------------------ Bases de juego */}
          {/* En lectura sólo sale lo escrito: ni campos vacíos, ni bloques o
              secciones enteras sin texto. En edición salen todos. */}
          {SECTIONS.filter((section) => seccionVisible(section.id)).map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="mt-12 scroll-mt-20"
            >
              <div
                className="flex flex-col gap-1 rounded-2xl border-l-4 bg-white/[0.03] px-5 py-4"
                style={{
                  borderLeftColor: section.accent,
                  background: `linear-gradient(90deg, ${section.accent}22, transparent 60%)`,
                }}
              >
                <h2 className="text-2xl font-bold tracking-tight">
                  {section.titulo}
                </h2>

                <p className="text-sm text-white/50">{section.subtitulo}</p>
              </div>

              <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                {section.bloques
                  .filter((bloque) => modoEdicion || bloque.campos.some(tiene))
                  .map((bloque) => (
                  <div
                    key={bloque.titulo}
                    className="rounded-3xl border border-white/5 bg-[#0E141C] p-4 sm:p-5"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: section.accent }}
                      />

                      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white/85">
                        {bloque.titulo}
                      </h3>

                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                      {(() => {
                        const visibles = bloque.campos.filter((f) => modoEdicion || tiene(f));

                        /* Con un número impar, el último ocupa todo el ancho: sin columna vacía al lado. */
                        return visibles.map((field, i) => (
                          <div
                            key={field.campo}
                            className={`min-w-0 ${visibles.length % 2 === 1 && i === visibles.length - 1 ? "sm:col-span-2" : ""}`}
                          >
                            <Campo
                              field={field}
                              valor={valorDe(field.campo)}
                              editando={modoEdicion}
                              accent={section.accent}
                              nombres={nombresRival}
                              onChange={(v) => setCampo(field.campo, v)}
                            />
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* ------------------------------------------- Conclusiones */}
          {conclusionesVisibles.length > 0 && (
          <section id="conclusiones" className="mt-12 scroll-mt-20">
            <div
              className="flex flex-col gap-1 rounded-2xl border-l-4 bg-white/[0.03] px-5 py-4"
              style={{
                borderLeftColor: "#C8A96B",
                background: "linear-gradient(90deg, #C8A96B22, transparent 60%)",
              }}
            >
              <h2 className="text-2xl font-bold tracking-tight">
                Conclusiones y plan
              </h2>

              <p className="text-sm text-white/50">
                Lectura individual y plan
                {!modoEdicion && (
                  <>
                    {" · "}
                    <Link href={enlacePlanDePartido(rivalActivo)} data-export-hide className="font-semibold text-[#C8A96B] hover:underline">
                      las claves del partido, en el Plan de partido →
                    </Link>
                  </>
                )}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {conclusionesVisibles.map((field) => (
                <Campo
                  key={field.campo}
                  field={field}
                  valor={restoConclusion(field.campo)}
                  editando={modoEdicion}
                  accent="#C8A96B"
                  destacado
                  nombres={nombresRival}
                  onChange={(v) => setCampo(field.campo, v)}
                />
              ))}
            </div>
          </section>
          )}

          {/* Las siglas del texto del analista, sólo las que salen (29/10/2026). */}
          {!modoEdicion && siglasUsadas.length > 0 && (
            <details open data-export-hide className="mt-10 rounded-2xl border border-white/10 bg-[#111827] px-5 py-3 text-sm text-white/70">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Siglas</summary>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {siglasUsadas.map((s) => (
                  <div key={s.sigla} className="flex gap-2">
                    <dt className="w-20 shrink-0 font-semibold text-white/85">{s.sigla}</dt>
                    <dd>{s.significado}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>
        {avisoGuardado}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DatoClave({
  icon: Icon,
  label,
  valor,
  mostrar,
  editando,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  valor?: string;
  mostrar?: string;
  editando: boolean;
  onChange: (value: string) => void;
}) {
  /* Sin dato y sin editar, la tarjeta no sale. */
  if (!editando && !String(mostrar ?? valor ?? "").trim()) return null;

  return (
    <div className="rounded-3xl border border-white/5 bg-[#111827] p-5 shadow-lg transition-colors hover:border-[#C8A96B]/30">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
        <Icon size={13} />
        {label}
      </p>

      {editando ? (
        <input
          aria-label={label}
          value={valor ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-xl border border-amber-400/30 bg-[#0B0F14] p-2 text-white outline-none focus:border-amber-400"
        />
      ) : (
        <p className="mt-2 text-xl font-bold">{mostrar ?? valor ?? "—"}</p>
      )}
    </div>
  );
}

function Campo({
  field,
  valor,
  editando,
  accent,
  destacado = false,
  nombres = [],
  onChange,
}: {
  field: FieldDef;
  valor?: string;
  editando: boolean;
  accent: string;
  destacado?: boolean;
  nombres?: string[];
  onChange: (value: string) => void;
}) {
  const contenido = String(valor ?? "").trim();
  const vacio = contenido.length === 0;

  return (
    <div
      className={`rounded-2xl border bg-[#111827] p-4 transition-colors ${
        field.ancho ? "sm:col-span-2" : ""
      } ${editando ? (destacado ? "min-h-[190px]" : "min-h-[120px]") : ""} ${
        editando
          ? "border-amber-400/60"
          : vacio
            ? "border-white/5"
            : "border-white/10"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: chipInk(editando ? "#FBBF24" : accent) }}
        >
          {field.titulo}
        </p>

      </div>

      {/* El nombre de la columna de la hoja (SALIDA_BALON…) no le dice nada
          al cuerpo técnico: queda sólo al pasar el ratón (19/10/2026). */}
      {editando && field.ayuda && (
        <div className="mb-2 flex flex-wrap items-center gap-2" data-export-hide>
          <span className="text-[11px] text-white/35" title={`Columna de la hoja: ${field.campo}`}>
            {field.ayuda}
          </span>
        </div>
      )}

      {editando ? (
        <textarea
          aria-label={field.titulo}
          rows={field.rows ?? 4}
          value={valor ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-xl border border-amber-400/30 bg-black/40 p-3 text-sm leading-6 text-white outline-none focus:border-amber-400"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-6 text-white/80">
          {completaNombres(contenido, nombres)}
        </p>
      )}
    </div>
  );
}
