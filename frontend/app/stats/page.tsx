"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/spinner";
import type { PaceAssessment, PathStats, Stats } from "@/lib/types";

const PACE_BADGE: Record<PaceAssessment, { label: string; tone: BadgeTone }> = {
  faster: { label: "Szybciej niż zakładano", tone: "green" },
  on_track: { label: "Zgodnie z planem", tone: "slate" },
  slower: { label: "Wolniej niż zakładano", tone: "amber" },
};

const TILE_ICONS: Record<string, ReactElement> = {
  paths: (
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V6a2 2 0 0 1 2-2h14v13.5" strokeLinecap="round" strokeLinejoin="round" />
  ),
  modules: <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />,
  rating: (
    <path
      d="M12 2 14.6 8.6 21.5 9.4 16.3 14 17.8 21 12 17.4 6.2 21 7.7 14 2.5 9.4 9.4 8.6 12 2Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  pass: <path d="M9 12.5 11.5 15 16 9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" strokeLinecap="round" strokeLinejoin="round" />,
};

function StatTile({ label, value, icon }: { label: string; value: string; icon: keyof typeof TILE_ICONS }) {
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {TILE_ICONS[icon]}
        </svg>
      </span>
      <span className="text-2xl font-semibold text-slate-900">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </Card>
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
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {sorted.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((row) => (
            <div key={row.id} className="flex items-center gap-3">
              <span className="w-16 flex-none truncate text-xs text-slate-600" title={row.fullLabel}>
                {row.label}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-4 rounded-full bg-brand-gradient transition-all duration-500"
                  style={{ width: `${(row.value / max) * 100}%` }}
                  title={`${row.fullLabel}: ${formatValue(row.value)}`}
                />
              </div>
              <span className="w-12 flex-none text-right text-xs font-medium tabular-nums text-slate-700">
                {formatValue(row.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function StatsPage() {
  const { token, loading } = useRequireAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getStats(token).then(setStats);
  }, [token]);

  if (loading || !token) return <LoadingState />;

  const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
  const ratingFmt = (v: number) => `${v.toFixed(1)}/5`;

  const pathsWithPace = (stats?.paths || []).filter(
    (p): p is PathStats & { pace_assessment: PaceAssessment } => p.pace_assessment !== null
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Statystyki nauki</h1>
          <p className="mt-1 text-sm text-slate-500">Twoje postępy w liczbach.</p>
        </div>

        {!stats && <LoadingState />}

        {stats && stats.overview.total_paths === 0 && (
          <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-slate-600">
              Brak danych —{" "}
              <Link href="/paths/new" className="font-medium text-brand-600 hover:text-brand-700">
                wygeneruj pierwszą ścieżkę
              </Link>
              , aby zobaczyć statystyki.
            </p>
          </Card>
        )}

        {stats && stats.overview.total_paths > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile icon="paths" label="Liczba ścieżek" value={String(stats.overview.total_paths)} />
              <StatTile
                icon="modules"
                label="Ukończone moduły"
                value={`${stats.overview.completed_modules}/${stats.overview.total_modules}`}
              />
              <StatTile
                icon="rating"
                label="Średnia ocena materiałów"
                value={stats.overview.feedback_count > 0 ? ratingFmt(stats.overview.avg_feedback_rating) : "Brak danych"}
              />
              <StatTile
                icon="pass"
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

              <Card className="flex flex-col gap-3 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Tempo nauki (wg agenta rekomendacji)</h2>
                {pathsWithPace.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Brak jeszcze żadnej rekomendacji AI — wygeneruj ją na stronie ścieżki.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {pathsWithPace.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-600" title={p.title}>
                          {p.technology} — {p.title}
                        </span>
                        <Badge tone={PACE_BADGE[p.pace_assessment].tone} className="flex-none">
                          {PACE_BADGE[p.pace_assessment].label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
