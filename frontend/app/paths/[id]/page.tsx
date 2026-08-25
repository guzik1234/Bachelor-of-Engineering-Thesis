"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import type { LearningPath, Recommendation } from "@/lib/types";

const PACE_LABELS: Record<Recommendation["pace_assessment"], string> = {
  slower: "wolniej niż zakładano",
  on_track: "zgodnie z założonym tempem",
  faster: "szybciej niż zakładano",
};

const LEVEL_LABELS: Record<Recommendation["recommended_experience_level"], string> = {
  beginner: "początkujący",
  intermediate: "średniozaawansowany",
  advanced: "zaawansowany",
};

export default function PathDetailPage() {
  const { token, loading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const pathId = Number(params.id);

  const [path, setPath] = useState<LearningPath | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getPath(token, pathId).then(setPath);
    api.getRecommendation(token, pathId).then(setRecommendation);
  }, [token, pathId]);

  async function handleGenerateRecommendation() {
    if (!token) return;
    setRecommendationLoading(true);
    setRecommendationError(null);
    try {
      const result = await api.generateRecommendation(token, pathId);
      setRecommendation(result);
    } catch (err) {
      setRecommendationError(err instanceof ApiError ? err.message : "Nie udało się wygenerować rekomendacji.");
    } finally {
      setRecommendationLoading(false);
    }
  }

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

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium text-slate-900">Rekomendacja AI</h2>
                <button
                  onClick={handleGenerateRecommendation}
                  disabled={recommendationLoading}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {recommendationLoading ? "Analizuję…" : "Wygeneruj rekomendację"}
                </button>
              </div>

              {recommendationError && <p className="mt-2 text-sm text-red-600">{recommendationError}</p>}

              {recommendation ? (
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <div>
                    <dt className="inline font-medium text-slate-700">Tempo nauki: </dt>
                    <dd className="inline text-slate-600">{PACE_LABELS[recommendation.pace_assessment]}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-slate-700">Rekomendowany poziom trudności: </dt>
                    <dd className="inline text-slate-600">
                      {LEVEL_LABELS[recommendation.recommended_experience_level]}
                    </dd>
                  </div>
                  {recommendation.recommended_module_title && (
                    <div>
                      <dt className="inline font-medium text-slate-700">Skup się dalej na: </dt>
                      <dd className="inline text-slate-600">{recommendation.recommended_module_title}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-medium text-slate-700">Uzasadnienie:</dt>
                    <dd className="text-slate-600">{recommendation.rationale}</dd>
                  </div>
                </dl>
              ) : (
                !recommendationLoading && (
                  <p className="mt-2 text-sm text-slate-500">
                    Brak rekomendacji — wygeneruj ją, aby otrzymać ocenę tempa nauki i sugestię kolejnego kroku.
                  </p>
                )
              )}
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
