"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/spinner";
import type { LearningPathSummary } from "@/lib/types";

export default function DashboardPage() {
  const { token, loading } = useRequireAuth();
  const [paths, setPaths] = useState<LearningPathSummary[] | null>(null);

  useEffect(() => {
    if (!token) return;
    api.listPaths(token).then(setPaths);
  }, [token]);

  if (loading || !token) return <LoadingState />;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Twoje ścieżki edukacyjne</h1>
            <p className="mt-1 text-sm text-slate-500">Kontynuuj naukę lub wygeneruj nową ścieżkę.</p>
          </div>
          <Link href="/paths/new" className={buttonStyles("primary", "md")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nowa ścieżka
          </Link>
        </div>

        {paths === null && <LoadingState />}

        {paths !== null && paths.length === 0 && (
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V6a2 2 0 0 1 2-2h14v13.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="font-semibold text-slate-900">Brak ścieżek edukacyjnych</h2>
            <p className="max-w-sm text-sm text-slate-500">
              Nie masz jeszcze żadnej ścieżki edukacyjnej. Wygeneruj pierwszą, aby zacząć naukę.
            </p>
            <Link href="/paths/new" className={buttonStyles("primary", "md", "mt-2")}>
              Wygeneruj pierwszą ścieżkę
            </Link>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {paths?.map((path, i) => {
            const pct = path.module_count === 0 ? 0 : Math.round((path.completed_module_count / path.module_count) * 100);
            return (
              <Link
                key={path.id}
                href={`/paths/${path.id}`}
                className="group animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Card className="flex h-full flex-col gap-3 p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-brand-700">
                      {path.technology}
                    </span>
                    {pct === 100 && (
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-green-100 text-green-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <h2 className="font-semibold text-slate-900 transition group-hover:text-brand-700">{path.title}</h2>
                  <p className="line-clamp-2 flex-1 text-sm text-slate-500">{path.description}</p>
                  <div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-brand-gradient transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="mt-1.5 block text-xs text-slate-500">
                      {path.completed_module_count}/{path.module_count} modułów ukończonych
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
