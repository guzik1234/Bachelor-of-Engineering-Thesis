"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import type { PaceAssessment, PathStats, Stats } from "@/lib/types";

const PACE_BADGE: Record<PaceAssessment, { label: string; className: string }> = {
  faster: { label: "Szybciej niż zakładano", className: "bg-green-50 text-green-700 border-green-300" },
  on_track: { label: "Zgodnie z planem", className: "bg-slate-50 text-slate-700 border-slate-300" },
  slower: { label: "Wolniej niż zakładano", className: "bg-amber-50 text-amber-700 border-amber-300" },
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-2xl font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function BarList({
  title,
  rows,
  formatValue,
  emptyMessage,
}: {
  title: string;
  rows: { id: number; label: string; fullLabel: string; value: number }[];
  formatValue: (value: number) => string;
  emptyMessage: string;
}) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((r) => r.value));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {sorted.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((row) => (
            <div key={row.id} className="flex items-center gap-3">
              <span className="w-16 flex-none truncate text-xs text-slate-600" title={row.fullLabel}>
                {row.label}
              </span>
              <div className="h-4 flex-1 rounded-full bg-slate-100">
                <div
                  className="h-4 rounded-full bg-slate-900"
                  style={{ width: `${(row.value / max) * 100}%` }}
                  title={`${row.fullLabel}: ${formatValue(row.value)}`}
                />
              </div>
              <span className="w-12 flex-none text-right text-xs tabular-nums text-slate-700">
                {formatValue(row.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatsPage() {
  const { token, loading } = useRequireAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getStats(token).then(setStats);
  }, [token]);

  if (loading || !token) return null;

  const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
  const ratingFmt = (v: number) => `${v.toFixed(1)}/5`;

  const pathsWithPace = (stats?.paths || []).filter(
    (p): p is PathStats & { pace_assessment: PaceAssessment } => p.pace_assessment !== null
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">Statystyki nauki</h1>

        {!stats && <p className="text-slate-600">Wczytywanie…</p>}

        {stats && stats.overview.total_paths === 0 && (
          <p className="text-slate-600">
            Brak danych — <Link href="/paths/new" className="underline">wygeneruj pierwszą ścieżkę</Link>, aby
            zobaczyć statystyki.
          </p>
        )}

        {stats && stats.overview.total_paths > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Liczba ścieżek" value={String(stats.overview.total_paths)} />
              <StatTile
                label="Ukończone moduły"
                value={`${stats.overview.completed_modules}/${stats.overview.total_modules}`}
              />
              <StatTile
                label="Średnia ocena materiałów"
                value={stats.overview.feedback_count > 0 ? ratingFmt(stats.overview.avg_feedback_rating) : "Brak danych"}
              />
              <StatTile
                label="Zdawalność zadań"
                value={stats.overview.exercise_attempts > 0 ? pctFmt(stats.overview.exercise_pass_rate) : "Brak danych"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <BarList
                title="Ukończenie ścieżki"
                rows={stats.paths.map((p) => ({
                  id: p.id,
                  label: p.technology,
                  fullLabel: p.title,
                  value: p.completion_ratio,
                }))}
                formatValue={pctFmt}
                emptyMessage="Brak ścieżek."
              />
              <BarList
                title="Średnia ocena materiałów"
                rows={stats.paths
                  .filter((p) => p.feedback_count > 0)
                  .map((p) => ({ id: p.id, label: p.technology, fullLabel: p.title, value: p.avg_feedback_rating }))}
                formatValue={ratingFmt}
                emptyMessage="Brak jeszcze ocen materiałów — oceń materiał na stronie modułu."
              />
              <BarList
                title="Zdawalność zadań praktycznych"
                rows={stats.paths
                  .filter((p) => p.exercise_attempts > 0)
                  .map((p) => ({ id: p.id, label: p.technology, fullLabel: p.title, value: p.exercise_pass_rate }))}
                formatValue={pctFmt}
                emptyMessage="Brak jeszcze zgłoszonych rozwiązań zadań praktycznych."
              />

              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-900">Tempo nauki (wg agenta rekomendacji)</h2>
                {pathsWithPace.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Brak jeszcze żadnej rekomendacji AI — wygeneruj ją na stronie ścieżki.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pathsWithPace.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-600" title={p.title}>
                          {p.technology} — {p.title}
                        </span>
                        <span
                          className={`flex-none rounded-full border px-2 py-0.5 text-xs ${PACE_BADGE[p.pace_assessment].className}`}
                        >
                          {PACE_BADGE[p.pace_assessment].label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
