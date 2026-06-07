"use client";

export function AIInsightsPanel() {
  return (
    <div className="mt-6 rounded-xl border bg-card p-4">
      <h3 className="text-lg font-semibold">
        ✨ Análisis IA
      </h3>

      <p className="mt-2 text-sm text-muted-foreground">
        Aquí aparecerán los análisis automáticos.
      </p>

      <div className="mt-4">
        <textarea
          placeholder="Pregunta sobre esta página..."
          className="w-full rounded-md border p-3"
          rows={3}
        />
      </div>

      <button className="mt-3 rounded-md border px-4 py-2">
        Preguntar
      </button>
    </div>
  );
}