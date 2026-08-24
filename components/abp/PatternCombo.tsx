"use client";

/**
 * El combo de patrones del registro de ABP, con su catálogo editable.
 *
 * Antes las sugerencias se deducían solas de lo ya escrito más una lista fija
 * de fábrica: servía para no repetir texto, pero no había forma de corregir un
 * patrón mal redactado ni de quitar los que no usa este cuerpo técnico.
 *
 * Aquí el vocabulario se mantiene a mano —se añade, se renombra y se quita— y
 * se guarda con el resto del scouting. Dos detalles que no son cosméticos:
 *
 * - Renombrar reescribe también las acciones que ya usaban ese texto, para que
 *   el panel de patrones no parta el grupo en dos.
 * - Quitar sólo saca la entrada del combo; lo escrito en cada acción es la
 *   observación de un partido y se queda donde está.
 */

import { useId, useMemo, useState } from "react";
import { Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";

import { Button } from "@/components/abp/ui";
import { norm } from "@/lib/abp/model";

export interface PatternCatalog {
  /** Patrones que ofrece el combo, en el orden que decide quien lo mantiene. */
  lista: string[];
  /** Acciones que usan cada entrada, para avisar antes de quitarla. */
  usos: Record<string, number>;
  onAdd: (patron: string) => void;
  onRename: (from: string, to: string) => void;
  onRemove: (patron: string) => void;
}

export function PatternCombo({
  value,
  onChange,
  patrones,
}: {
  value: string;
  onChange: (value: string) => void;
  patrones: PatternCatalog;
}) {
  const id = useId();
  const listId = `${id}-list`;

  const [gestionando, setGestionando] = useState(false);

  /*
   * Renombrar reescribe las acciones ya guardadas, pero la que se está
   * editando todavía no lo está: si usaba ese patrón hay que corregirla aquí
   * o al guardar volvería a escribir el texto viejo.
   */
  const patronesLocal = useMemo<PatternCatalog>(
    () => ({
      ...patrones,
      onRename: (from, to) => {
        patrones.onRename(from, to);

        if (norm(value) === norm(from)) onChange(to.trim());
      },
    }),
    [patrones, value, onChange],
  );

  /* Lo tecleado todavía no está en el catálogo: se ofrece guardarlo. */
  const esNuevo = useMemo(() => {
    const limpio = value.trim();

    if (!limpio) return false;

    return !patrones.lista.some((item) => norm(item) === norm(limpio));
  }, [value, patrones.lista]);

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[10px] uppercase tracking-[0.16em] text-white/40"
        >
          Patrón
        </label>

        <button
          type="button"
          onClick={() => setGestionando((abierto) => !abierto)}
          className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] transition ${
            gestionando
              ? "text-[#C8A96B]"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          <Settings2 size={11} />
          {gestionando ? "Cerrar catálogo" : "Gestionar patrones"}
        </button>
      </div>

      <input
        id={id}
        value={value}
        list={patrones.lista.length ? listId : undefined}
        placeholder="Bloqueo doble al primer palo"
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
      />

      {patrones.lista.length > 0 && (
        <datalist id={listId}>
          {patrones.lista.map((patron) => (
            <option key={patron} value={patron} />
          ))}
        </datalist>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-white/30">
          Déjalo vacío si la acción no aporta nada. Lo que escribas aquí sube al
          panel de patrones, y las que repitan el mismo texto se agrupan.
        </span>

        {esNuevo && (
          <button
            type="button"
            onClick={() => patrones.onAdd(value)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#C8A96B]/40 px-2 py-0.5 text-[10px] text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
          >
            <Plus size={10} />
            Añadir al catálogo
          </button>
        )}
      </div>

      {gestionando && (
        <CatalogEditor patrones={patronesLocal} onUse={onChange} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CATÁLOGO                                                           */
/* ------------------------------------------------------------------ */

function CatalogEditor({
  patrones,
  onUse,
}: {
  patrones: PatternCatalog;
  onUse: (patron: string) => void;
}) {
  const [nuevo, setNuevo] = useState("");

  const añadir = () => {
    if (!nuevo.trim()) return;

    patrones.onAdd(nuevo);
    setNuevo("");
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#C8A96B]">
        Catálogo de patrones
      </p>

      <div className="flex gap-2">
        <input
          value={nuevo}
          placeholder="Nuevo patrón…"
          onChange={(event) => setNuevo(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;

            /* Enter aquí no debe cerrar ni enviar el diálogo de la acción. */
            event.preventDefault();
            añadir();
          }}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
        />

        <Button icon={Plus} onClick={añadir} disabled={!nuevo.trim()}>
          Añadir
        </Button>
      </div>

      {patrones.lista.length === 0 ? (
        <p className="mt-3 text-[11px] text-white/35">
          El catálogo está vacío: escribe arriba los patrones con los que
          trabajáis y aparecerán en el combo.
        </p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
          {patrones.lista.map((patron) => (
            <CatalogRow
              key={patron}
              patron={patron}
              usos={patrones.usos[patron] ?? 0}
              onUse={() => onUse(patron)}
              onRename={(texto) => patrones.onRename(patron, texto)}
              onRemove={() => patrones.onRemove(patron)}
            />
          ))}
        </ul>
      )}

      <p className="mt-2.5 border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-white/30">
        Al renombrar se corrige también el texto de las acciones ya registradas,
        para que no se parta el grupo del panel de patrones. Al quitar sólo
        desaparece del combo: lo escrito en cada acción se queda.
      </p>
    </div>
  );
}

function CatalogRow({
  patron,
  usos,
  onUse,
  onRename,
  onRemove,
}: {
  patron: string;
  usos: number;
  onUse: () => void;
  onRename: (texto: string) => void;
  onRemove: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  if (editando !== null) {
    return (
      <li className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] p-1.5">
        <input
          autoFocus
          value={editando}
          onChange={(event) => setEditando(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onRename(editando);
              setEditando(null);
            }

            if (event.key === "Escape") {
              /* El diálogo de la acción también escucha Escape: que no cierre
                 el registro entero por cancelar el renombrado. */
              event.stopPropagation();
              setEditando(null);
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-[#C8A96B]/40 bg-black/30 px-2 py-1 text-xs text-white outline-none"
        />

        <IconButton
          icon={Check}
          label="Guardar"
          onClick={() => {
            onRename(editando);
            setEditando(null);
          }}
          disabled={!editando.trim()}
          tone="gold"
        />

        <IconButton
          icon={X}
          label="Cancelar"
          onClick={() => setEditando(null)}
        />
      </li>
    );
  }

  if (confirmando) {
    return (
      <li className="flex flex-wrap items-center gap-2 rounded-lg border border-red-400/25 bg-red-500/[0.06] p-1.5 pl-2.5">
        <span className="min-w-0 flex-1 truncate text-xs text-white/70">
          {usos > 0
            ? `Quitar «${patron}» del combo (${usos} ${usos === 1 ? "acción lo usa" : "acciones lo usan"})`
            : `Quitar «${patron}» del combo`}
        </span>

        <Button
          tone="danger"
          onClick={() => {
            onRemove();
            setConfirmando(false);
          }}
        >
          Quitar
        </Button>

        <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-1.5 rounded-lg py-0.5 pl-2.5 transition hover:bg-white/[0.04]">
      <button
        type="button"
        onClick={onUse}
        title="Usar en esta acción"
        className="min-w-0 flex-1 truncate py-1 text-left text-xs text-white/70 transition hover:text-white"
      >
        {patron}
      </button>

      {usos > 0 && (
        <span className="shrink-0 tabular-nums text-[10px] text-white/25">
          {usos}
        </span>
      )}

      <IconButton
        icon={Pencil}
        label="Renombrar"
        onClick={() => setEditando(patron)}
      />

      <IconButton
        icon={Trash2}
        label="Quitar del combo"
        onClick={() => setConfirmando(true)}
        tone="danger"
      />
    </li>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "ghost",
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "ghost" | "gold" | "danger";
}) {
  const styles = {
    ghost: "text-white/35 hover:bg-white/[0.08] hover:text-white",
    gold: "text-[#C8A96B] hover:bg-[#C8A96B]/15",
    danger: "text-white/35 hover:bg-red-500/15 hover:text-red-300",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`shrink-0 rounded-md p-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
    >
      <Icon size={12} />
    </button>
  );
}
