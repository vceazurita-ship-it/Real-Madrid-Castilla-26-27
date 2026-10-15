"use client";

import { useCallback } from "react";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { normalizaTelefono } from "@/lib/correo/whatsapp";

/**
 * La agenda de los informes (15/10/2026): cada correo y cada teléfono al que
 * se ha mandado un informe (del partido o de ABP), con cuántas veces y cuándo.
 * Es un solo documento para todo el cuerpo técnico; los campos de destinatarios
 * la usan para proponer, los más usados primero.
 */

export type ContactoAgenda = { tipo: "correo" | "whatsapp"; valor: string; usos: number; ultimo: string };

type Agenda = { contactos: ContactoAgenda[] };

const VACIA: Agenda = { contactos: [] };

const clave = (tipo: ContactoAgenda["tipo"], valor: string) => (tipo === "correo" ? valor.trim().toLowerCase() : normalizaTelefono(valor));

export function useAgendaEnvios() {
  const { value, setValue } = useRemoteDoc<Agenda>({ key: "informes:agenda", kind: "informe-agenda", fallback: VACIA });

  /** Apunta que se ha mandado a estos: suben en la lista de propuestas. */
  const apunta = useCallback(
    (tipo: ContactoAgenda["tipo"], valores: string[]) => {
      const ahora = new Date().toISOString();

      setValue((agenda) => {
        const lista = [...(agenda?.contactos ?? [])];

        for (const v of valores) {
          const k = clave(tipo, v);

          if (!k) continue;

          const i = lista.findIndex((c) => c.tipo === tipo && clave(c.tipo, c.valor) === k);

          if (i >= 0) lista[i] = { ...lista[i], usos: lista[i].usos + 1, ultimo: ahora };
          else lista.push({ tipo, valor: k, usos: 1, ultimo: ahora });
        }

        return { contactos: lista };
      });
    },
    [setValue],
  );

  /** Quita uno de las propuestas (una dirección mal escrita que se coló, alguien que ya no está). */
  const olvida = useCallback(
    (tipo: ContactoAgenda["tipo"], valor: string) => setValue((agenda) => ({ contactos: (agenda?.contactos ?? []).filter((c) => !(c.tipo === tipo && clave(c.tipo, c.valor) === clave(tipo, valor))) })),
    [setValue],
  );

  const contactos = [...(value?.contactos ?? [])].sort((a, b) => b.usos - a.usos || b.ultimo.localeCompare(a.ultimo));

  return { contactos, apunta, olvida };
}
