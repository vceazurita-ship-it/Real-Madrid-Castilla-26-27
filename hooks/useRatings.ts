"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { compareMatches, fetchMatches } from "@/lib/ratings/matches";
import {
  MatchMeta,
  PlayerRating,
  RatingsSeason,
  emptySeason,
} from "@/lib/ratings/types";

type Status = "loading" | "ready" | "error";

/**
 * Sólo el histórico, sin el calendario de partidos.
 *
 * Es lo que necesita la ficha individual: leer las notas de un jugador sin
 * cargar el CSV de la temporada.
 */
export function useRatingsSeason() {
  const [season, setSeason] = useState<RatingsSeason>(emptySeason());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ratings/load", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success) setSeason(payload.season as RatingsSeason);

        setLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        console.error("No se pudo cargar el histórico de valoraciones", error);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { season, loading };
}

/**
 * Histórico de valoraciones + calendario de partidos.
 *
 * El calendario se lee del CSV de la temporada y se completa con los partidos
 * creados a mano, que sólo existen dentro del propio histórico.
 */
export function useRatings() {
  const [season, setSeason] = useState<RatingsSeason>(emptySeason());
  const [calendar, setCalendar] = useState<MatchMeta[]>([]);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      setError("");

      const [ratings, matches] = await Promise.allSettled([
        fetch("/api/ratings/load", {
          cache: "no-store",
          signal: controller.signal,
        }).then((response) => response.json()),
        fetchMatches(controller.signal),
      ]);

      if (controller.signal.aborted) return;

      if (ratings.status === "fulfilled" && ratings.value?.success) {
        setSeason(ratings.value.season as RatingsSeason);
      } else if (ratings.status === "rejected") {
        setError("No se ha podido cargar el histórico de valoraciones.");
      }

      setCalendar(matches.status === "fulfilled" ? matches.value : []);

      if (matches.status === "rejected") {
        setError((previous) =>
          previous || "No se ha podido cargar el calendario de partidos."
        );
      }

      setStatus(ratings.status === "rejected" ? "error" : "ready");
    }

    load();

    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const saveMatch = useCallback(
    async (match: MatchMeta, players: Record<string, PlayerRating>) => {
      setSaving(true);

      try {
        const response = await fetch("/api/ratings/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match, players }),
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "Error guardando");
        }

        setSeason(payload.season as RatingsSeason);

        return true;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const deleteMatch = useCallback(async (matchId: string) => {
    setSaving(true);

    try {
      const response = await fetch("/api/ratings/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Error borrando");
      }

      setSeason(payload.season as RatingsSeason);

      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  /* Calendario + partidos manuales, sin duplicar los que ya vienen del CSV. */
  const matches = useMemo<MatchMeta[]>(() => {
    const byId = new Map<string, MatchMeta>();

    calendar.forEach((match) => byId.set(match.id, match));

    Object.values(season.matches).forEach((record) => {
      /* El CSV manda en resultado y microciclo; lo manual sólo se añade. */
      if (!byId.has(record.match.id)) byId.set(record.match.id, record.match);
    });

    return [...byId.values()].sort(compareMatches);
  }, [calendar, season]);

  return {
    season,
    matches,
    status,
    error,
    saving,
    reload,
    saveMatch,
    deleteMatch,
  };
}
