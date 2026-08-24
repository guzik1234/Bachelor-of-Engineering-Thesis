"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import type { LearningPathSummary } from "@/lib/types";

export default function DashboardPage() {
  const { token, loading } = useRequireAuth();
  const [paths, setPaths] = useState<LearningPathSummary[] | null>(null);

  useEffect(() => {
    if (!token) return;
    api.listPaths(token).then(setPaths);
  }, [token]);

  if (loading || !token) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Twoje ścieżki edukacyjne</h1>
          <Link href="/paths/new" className="rounded-md bg-slate-900 px-4 py-2 text-white">
            + Nowa ścieżka
          </Link>
        </div>

        {paths === null && <p className="text-slate-600">Wczytywanie…</p>}
        {paths !== null && paths.length === 0 && (
          <p className="text-slate-600">
            Nie masz jeszcze żadnej ścieżki edukacyjnej. Wygeneruj pierwszą, aby zacząć naukę.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {paths?.map((path) => (
            <Link
              key={path.id}
              href={`/paths/${path.id}`}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
            >
              <span className="text-xs font-medium uppercase text-slate-500">{path.technology}</span>
              <h2 className="font-semibold text-slate-900">{path.title}</h2>
              <p className="line-clamp-2 text-sm text-slate-600">{path.description}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{
                    width: `${
                      path.module_count === 0
                        ? 0
                        : Math.round((path.completed_module_count / path.module_count) * 100)
                    }%`,
                  }}
                />
              </div>
              <span className="text-xs text-slate-500">
                {path.completed_module_count}/{path.module_count} modułów ukończonych
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
