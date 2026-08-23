"use client";

/**
 * Registro de ABP del rival: la parte editable de `/scout-rival-abp`.
 *
 * Las cuatro hojas de ABP sólo cubren los partidos del Castilla, así que de un
 * rival de liga al que todavía no hemos jugado no hay ni una acción. Esto es lo
 * que permite empezar: se ve el vídeo del rival y se registra aquí.
 *
 * Cada acción se guarda con el mismo contrato de columnas que la hoja de
 * scouting (`lib/abp/rivalScout.ts`), de modo que alimenta exactamente los
 * mismos agregados que alimentaría esa hoja.
 */

import { useMemo, useState } from "react";
import { Download, ListPlus, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Button,
  Dialog,
  EmptyState,
  Field,
  Panel,
  SaveState,
  Segmented,
  Select,
  TextArea,
} from "@/components/abp/ui";
import { AbpFamily, FAMILY_LABEL } from "@/lib/abp/model";
import { AbpSide } from "@/lib/abp/rival";
import {
  CALIDAD_ENVIO,
  FAMILY_OPTIONS,
  PERFIL_FALTA,
  PERFIL_GOLPEO,
  REMATE,
  RESULTADO,
  RivalScoutAction,
  SEGUNDO_BALON,
  TIEMPO,
  TIPO_CARRERA,
  TIPO_ENVIO,
  TIPO_REMATE,
  ZONA_FALTA,
  ZONA_REMATE,
  ZONA_SAQUE,
  actionsToCsv,
  composeTipoAccion,
  newAction,
  resultadoOwnerLabel,
  zonaCaidaOptions,
} from "@/lib/abp/rivalScout";
import type { DocStatus } from "@/hooks/useRemoteDoc";

const SIDE_OPTIONS: { key: AbpSide; label: string }[] = [
  { key: "ofensivo", label: "Ataca él" },
  { key: "defensivo", label: "Defiende él" },
];

/** Un hueco explícito: un select vacío no debe parecer un valor elegido. */
const SIN = "—";

const withBlank = (options: string[]) => [SIN, ...options];

const toStored = (value: string) => (value === SIN ? "" : value);
const toField = (value: string) => value || SIN;

export function RivalScoutEditor({
  equipo,
  actions,
  onChange,
  status,
  localOnly,
  savedAt,
  squadNames,
}: {
  equipo: string;
  actions: RivalScoutAction[];
  onChange: (next: RivalScoutAction[]) => void;
  status: DocStatus;
  localOnly: boolean;
  savedAt: string | null;
  /** Nombres de su plantilla, para sugerir sacador y rematador. */
  squadNames: string[];
}) {
  const [draft, setDraft] = useState<RivalScoutAction | null>(null);
  const [isNew, setIsNew] = useState(false);

  /* La jornada y el oponente se repiten acción tras acción del mismo partido:
     el alta hereda los del último registro para no reescribirlos cada vez. */
  const last = actions[actions.length - 1];

  const openNew = () => {
    setDraft(
      newAction({
        jornada: last?.jornada ?? "",
        oponente: last?.oponente ?? "",
        condicion: last?.condicion ?? "ofensivo",
      }),
    );
    setIsNew(true);
  };

  const openEdit = (action: RivalScoutAction) => {
    setDraft({ ...action });
    setIsNew(false);
  };

  const close = () => setDraft(null);

  /**
   * `again` guarda y deja el formulario abierto con los datos del partido.
   * Registrar los ocho córners de un vídeo no debe costar ocho aperturas del
   * diálogo ni reescribir ocho veces la jornada.
   */
  const save = (again = false) => {
    if (!draft) return;

    onChange(
      isNew
        ? [...actions, draft]
        : actions.map((action) => (action.id === draft.id ? draft : action)),
    );

    if (!again || !isNew) {
      close();
      return;
    }

    setDraft(
      newAction({
        jornada: draft.jornada,
        oponente: draft.oponente,
        condicion: draft.condicion,
        tiempo: draft.tiempo,
        family: draft.family,
      }),
    );
  };

  const remove = (id: string) => {
    const action = actions.find((item) => item.id === id);

    const confirmed = window.confirm(
      `¿Eliminar esta acción${action ? ` (${composeTipoAccion(action)})` : ""}?`,
    );

    if (!confirmed) return;

    onChange(actions.filter((item) => item.id !== id));
  };

  const exportCsv = () => {
    const blob = new Blob([actionsToCsv(equipo, actions)], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `abp-rival-${equipo.toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  /* Se muestran por partido y en el orden en que ocurrieron. */
  const ordered = useMemo(
    () =>
      [...actions].sort(
        (a, b) =>
          a.jornada.localeCompare(b.jornada, "es", { numeric: true }) ||
          Number(a.minuto || 0) - Number(b.minuto || 0),
      ),
    [actions],
  );

  return (
    <>
      <Panel
        title={`Acciones registradas del ${equipo}`}
        subtitle={
          actions.length
            ? `${actions.length} ${actions.length === 1 ? "acción" : "acciones"} de scouting propio`
            : "Todavía sin registrar: lo que añadas aquí manda sobre lo deducido"
        }
        icon={ListPlus}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SaveState status={status} localOnly={localOnly} savedAt={savedAt} />

            {actions.length > 0 && (
              <Button icon={Download} onClick={exportCsv} title="Descargar CSV">
                CSV
              </Button>
            )}

            <Button tone="primary" icon={Plus} onClick={openNew}>
              Añadir acción
            </Button>
          </div>
        }
        bodyClassName={ordered.length ? "p-0" : "p-4 sm:p-5"}
      >
        {ordered.length === 0 ? (
          <EmptyState
            title={`Sin acciones de ABP registradas para el ${equipo}`}
            description="Ve su último partido y registra cada córner, falta, penalti o saque de banda. En cuanto haya una acción, las tablas y los rankings de arriba pasan a leer de aquí."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <th className="px-4 py-2.5 font-medium sm:px-5">Partido</th>
                  <th className="px-4 py-2.5 font-medium">Min.</th>
                  <th className="px-4 py-2.5 font-medium">Acción</th>
                  <th className="px-4 py-2.5 font-medium">Lado</th>
                  <th className="px-4 py-2.5 font-medium">Saca</th>
                  <th className="px-4 py-2.5 font-medium">Remata</th>
                  <th className="px-4 py-2.5 font-medium">Resultado</th>
                  <th className="w-24 px-4 py-2.5 font-medium sm:px-5" />
                </tr>
              </thead>

              <tbody>
                {ordered.map((action) => (
                  <tr
                    key={action.id}
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <span className="block truncate text-white/85">
                        {action.jornada || "—"}
                      </span>

                      {action.oponente && (
                        <span className="block truncate text-[11px] text-white/35">
                          vs {action.oponente}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 tabular-nums text-white/55">
                      {action.minuto ? `${action.minuto}'` : "—"}
                      <span className="ml-1 text-[11px] text-white/30">
                        {action.tiempo}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-white/85">
                      {composeTipoAccion(action)}
                    </td>

                    <td className="px-4 py-3 text-[12px] text-white/50">
                      {action.condicion === "ofensivo" ? "Ataca" : "Defiende"}
                    </td>

                    <td className="px-4 py-3 text-[12px] text-white/55">
                      {action.sacador || "—"}
                    </td>

                    <td className="px-4 py-3 text-[12px] text-white/55">
                      {action.rematador || (action.remate === "Sí" ? "Sí" : "—")}
                    </td>

                    <td className="px-4 py-3 text-[12px] text-white/70">
                      {action.resultado || "—"}
                    </td>

                    <td className="px-4 py-3 sm:px-5">
                      <span className="flex justify-end gap-1.5">
                        <Button
                          icon={Pencil}
                          onClick={() => openEdit(action)}
                          title="Editar"
                        />
                        <Button
                          tone="danger"
                          icon={Trash2}
                          onClick={() => remove(action.id)}
                          title="Eliminar"
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {draft && (
        <ActionDialog
          equipo={equipo}
          draft={draft}
          isNew={isNew}
          squadNames={squadNames}
          onChange={setDraft}
          onClose={close}
          onSave={save}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  FORMULARIO                                                         */
/* ------------------------------------------------------------------ */

function ActionDialog({
  equipo,
  draft,
  isNew,
  squadNames,
  onChange,
  onClose,
  onSave,
}: {
  equipo: string;
  draft: RivalScoutAction;
  isNew: boolean;
  squadNames: string[];
  onChange: (action: RivalScoutAction) => void;
  onClose: () => void;
  onSave: (again?: boolean) => void;
}) {
  const set = <K extends keyof RivalScoutAction>(
    field: K,
    value: RivalScoutAction[K],
  ) => onChange({ ...draft, [field]: value });

  const esFalta =
    draft.family === "falta-lateral" || draft.family === "falta-directa";
  const esBanda = draft.family === "banda";
  const esPenalti = draft.family === "penalti";

  /* Un penalti no tiene envío ni zona de caída: pedirlos sólo estorba. */
  const conEnvio = !esPenalti;

  return (
    <Dialog
      title={isNew ? "Nueva acción de ABP" : "Editar acción"}
      subtitle={`${equipo} · ${composeTipoAccion(draft)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>

          {isNew && (
            <Button icon={Plus} onClick={() => onSave(true)}>
              Añadir y seguir
            </Button>
          )}

          <Button tone="primary" onClick={() => onSave(false)}>
            {isNew ? "Añadir y cerrar" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Group title="Partido">
          <Field
            label="Jornada"
            value={draft.jornada}
            onChange={(value) => set("jornada", value)}
            placeholder="J1"
          />

          <Field
            label="Su oponente"
            value={draft.oponente}
            onChange={(value) => set("oponente", value)}
            placeholder="Contra quién jugaba"
          />

          <Select
            label="Tiempo"
            value={draft.tiempo}
            options={TIEMPO}
            onChange={(value) => set("tiempo", value)}
          />

          <Field
            label="Minuto"
            type="number"
            value={draft.minuto}
            onChange={(value) => set("minuto", value)}
            placeholder="34"
          />

          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
              Lado
            </span>

            <Segmented
              options={SIDE_OPTIONS}
              value={draft.condicion}
              onChange={(value) => set("condicion", value)}
              ariaLabel="Lado de la acción"
            />

            <p className="mt-1.5 text-[10px] text-white/30">
              {draft.condicion === "ofensivo"
                ? `El ABP lo saca el ${equipo}.`
                : `El ABP se lo sacan al ${equipo}.`}
            </p>
          </div>
        </Group>

        <Group title="La acción">
          <Select
            label="Tipo"
            value={FAMILY_LABEL[draft.family]}
            options={FAMILY_OPTIONS.map((family) => FAMILY_LABEL[family])}
            onChange={(label) => {
              const family =
                FAMILY_OPTIONS.find((key) => FAMILY_LABEL[key] === label) ??
                ("corner" as AbpFamily);

              /* Al cambiar de familia se limpian los campos que dejan de
                 aplicar: si no, un córner conserva la zona de una falta. */
              onChange({
                ...draft,
                family,
                perfilFalta: "",
                zonaFalta: "",
                zonaSaque: "",
                zonaCaida: "",
              });
            }}
          />

          {esFalta && (
            <>
              <Select
                label="Perfil de la falta"
                value={toField(draft.perfilFalta)}
                options={withBlank(PERFIL_FALTA)}
                onChange={(value) => set("perfilFalta", toStored(value))}
              />

              <Select
                label="Zona de la falta"
                value={toField(draft.zonaFalta)}
                options={withBlank(ZONA_FALTA)}
                onChange={(value) => set("zonaFalta", toStored(value))}
              />
            </>
          )}

          {esBanda && (
            <Select
              label="Zona de saque"
              value={toField(draft.zonaSaque)}
              options={withBlank(ZONA_SAQUE)}
              onChange={(value) => set("zonaSaque", toStored(value))}
            />
          )}

          <Field
            label="Sacador"
            value={draft.sacador}
            onChange={(value) => set("sacador", value)}
            suggestions={squadNames}
            placeholder="Quién ejecuta"
          />

          {conEnvio && (
            <Select
              label="Perfil de golpeo"
              value={toField(draft.perfilGolpeo)}
              options={withBlank(PERFIL_GOLPEO)}
              onChange={(value) => set("perfilGolpeo", toStored(value))}
            />
          )}
        </Group>

        {conEnvio && (
          <Group title="El envío">
            <Select
              label="Tipo de envío"
              value={toField(draft.tipoEnvio)}
              options={withBlank(TIPO_ENVIO)}
              onChange={(value) => set("tipoEnvio", toStored(value))}
            />

            <Select
              label="Zona de caída"
              value={toField(draft.zonaCaida)}
              options={withBlank(zonaCaidaOptions(draft.family))}
              onChange={(value) => set("zonaCaida", toStored(value))}
            />

            <Select
              label="Calidad del envío"
              value={toField(draft.calidadEnvio)}
              options={withBlank(CALIDAD_ENVIO)}
              onChange={(value) => set("calidadEnvio", toStored(value))}
            />

            <Select
              label="Tipo de carrera"
              value={toField(draft.tipoCarrera)}
              options={withBlank(TIPO_CARRERA)}
              onChange={(value) => set("tipoCarrera", toStored(value))}
            />

            <Field
              label="Nº atacantes"
              type="number"
              value={draft.nAtacantes}
              onChange={(value) => set("nAtacantes", value)}
            />

            <Field
              label="Nº bloqueadores"
              type="number"
              value={draft.nBloqueadores}
              onChange={(value) => set("nBloqueadores", value)}
            />
          </Group>
        )}

        <Group title="El remate">
          <Select
            label="¿Hubo remate?"
            value={draft.remate}
            options={REMATE}
            onChange={(value) => set("remate", value)}
          />

          <Field
            label="Rematador"
            value={draft.rematador}
            onChange={(value) => set("rematador", value)}
            suggestions={squadNames}
            placeholder="Quién remata"
          />

          <Select
            label="Tipo de remate"
            value={toField(draft.tipoRemate)}
            options={withBlank(TIPO_REMATE)}
            onChange={(value) => set("tipoRemate", toStored(value))}
          />

          <Select
            label="Zona de remate"
            value={toField(draft.zonaRemate)}
            options={withBlank(ZONA_REMATE)}
            onChange={(value) => set("zonaRemate", toStored(value))}
          />

          <Field
            label="xG"
            value={draft.xg}
            onChange={(value) => set("xg", value)}
            placeholder="0,08"
            hint="Vale con coma o con punto"
          />
        </Group>

        <Group title="Cómo acabó">
          <Select
            label={resultadoOwnerLabel(draft.condicion, equipo)}
            value={draft.resultado}
            options={RESULTADO}
            onChange={(value) => set("resultado", value)}
          />

          <Select
            label="Segundo balón"
            value={toField(draft.segundoBalon)}
            options={withBlank(SEGUNDO_BALON)}
            onChange={(value) => set("segundoBalon", toStored(value))}
          />

          <div className="sm:col-span-2">
            <TextArea
              label="Observaciones"
              value={draft.observaciones}
              onChange={(value) => set("observaciones", value)}
              placeholder="Rutina, bloqueo, quién arrastra marca…"
              rows={2}
            />
          </div>
        </Group>
      </div>
    </Dialog>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">
        {title}
      </legend>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}
