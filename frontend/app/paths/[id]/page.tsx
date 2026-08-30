"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
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
  const [remediationLoadingId, setRemediationLoadingId] = useState<number | null>(null);
  const [remediationError, setRemediationError] = useState<string | null>(null);

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

  async function handleCreateRemediation(moduleId: number) {
    if (!token) return;
    setRemediationLoadingId(moduleId);
    setRemediationError(null);
    try {
      const updatedPath = await api.createRemediationModule(token, pathId, moduleId);
      setPath(updatedPath);
    } catch (err) {
      setRemediationError(err instanceof ApiError ? err.message : "Nie udało się utworzyć modułu powtórkowego.");
    } finally {
      setRemediationLoadingId(null);
    }
  }

  if (loading || !token) return <LoadingState />;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
        {!path && <LoadingState />}
        {path && (
          <>
            <div>
              <Badge tone="brand" className="uppercase tracking-wide">
                {path.technology}
              </Badge>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{path.title}</h1>
              <p className="mt-2 text-slate-600">{path.description}</p>
            </div>

            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path
                        d="M12 2 14.6 8.6 21.5 9.4 16.3 14 17.8 21 12 17.4 6.2 21 7.7 14 2.5 9.4 9.4 8.6 12 2Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <h2 className="font-semibold text-slate-900">Rekomendacja AI</h2>
                </div>
                <Button onClick={handleGenerateRecommendation} disabled={recommendationLoading} size="sm">
                  {recommendationLoading && <Spinner />}
                  {recommendationLoading ? "Analizuję…" : "Wygeneruj rekomendację"}
                </Button>
              </div>

              {recommendationError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{recommendationError}</p>
              )}
              {remediationError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{remediationError}</p>
              )}

              {recommendation ? (
                <dl className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="font-medium text-slate-700">Tempo nauki:</dt>
                    <dd>
                      <Badge tone={recommendation.pace_assessment === "slower" ? "amber" : recommendation.pace_assessment === "faster" ? "green" : "slate"}>
                        {PACE_LABELS[recommendation.pace_assessment]}
                      </Badge>
                    </dd>
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
                  {recommendation.needs_remediation && recommendation.remediation_module_id && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2.5">
                      <p className="text-red-700">
                        Agent AI wykrył trudności w module „{recommendation.remediation_module_title}” —
                        warto go przećwiczyć przed dalszą nauką.
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={remediationLoadingId === recommendation.remediation_module_id}
                        onClick={() => handleCreateRemediation(recommendation.remediation_module_id!)}
                      >
                        {remediationLoadingId === recommendation.remediation_module_id && <Spinner />}
                        Potrenuj słabości
                      </Button>
                    </div>
                  )}
                </dl>
              ) : (
                !recommendationLoading && (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500">
                    Brak rekomendacji — wygeneruj ją, aby otrzymać ocenę tempa nauki i sugestię kolejnego kroku.
                  </p>
                )
              )}
            </Card>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Moduły ({path.modules.filter((m) => m.completed).length}/{path.modules.length})
              </h2>
              <ol className="flex flex-col gap-3">
                {path.modules.map((module, index) => (
                  <li key={module.id} className="animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
                    <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-card">
                      <Link href={`/paths/${path.id}/modules/${module.id}`} className="group flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold",
                            module.completed ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {module.completed ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="block font-medium text-slate-900 transition group-hover:text-brand-700">
                              {module.title}
                            </span>
                            {module.is_remediation && <Badge tone="brand">Powtórka</Badge>}
                            {module.is_weak && <Badge tone="red">Wymaga powtórki</Badge>}
                          </span>
                          <span className="block text-sm text-slate-500">{module.summary}</span>
                        </span>
                      </Link>
                      {module.is_weak && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <p className="text-xs text-slate-500">
                            Agent AI monitorujący postępy wykrył trudności: {module.weak_reason}.
                          </p>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={remediationLoadingId === module.id}
                            onClick={() => handleCreateRemediation(module.id)}
                          >
                            {remediationLoadingId === module.id && <Spinner />}
                            {remediationLoadingId === module.id ? "Generuję…" : "Potrenuj słabości"}
                          </Button>
                        </div>
                      )}
                    </Card>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </main>
    </>
  );
}
