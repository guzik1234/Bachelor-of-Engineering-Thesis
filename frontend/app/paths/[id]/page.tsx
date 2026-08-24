"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import type { LearningPath } from "@/lib/types";

export default function PathDetailPage() {
  const { token, loading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const pathId = Number(params.id);

  const [path, setPath] = useState<LearningPath | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getPath(token, pathId).then(setPath);
  }, [token, pathId]);

  if (loading || !token) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
        {!path && <p className="text-slate-600">Wczytywanie…</p>}
        {path && (
          <>
            <div>
              <span className="text-xs font-medium uppercase text-slate-500">{path.technology}</span>
              <h1 className="text-2xl font-bold">{path.title}</h1>
              <p className="mt-2 text-slate-600">{path.description}</p>
            </div>

            <ol className="flex flex-col gap-3">
              {path.modules.map((module, index) => (
                <li key={module.id}>
                  <Link
                    href={`/paths/${path.id}/modules/${module.id}`}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-medium ${
                        module.completed ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {module.completed ? "✓" : index + 1}
                    </span>
                    <span>
                      <span className="block font-medium text-slate-900">{module.title}</span>
                      <span className="block text-sm text-slate-600">{module.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </>
  );
}
