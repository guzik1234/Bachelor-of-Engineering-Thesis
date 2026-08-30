"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import type { ChatMessage, Material, MaterialType, Submission } from "@/lib/types";

const TYPE_LABELS: Record<MaterialType, string> = {
  text: "Wyjaśnienie",
  code_example: "Przykład kodu",
  exercise: "Zadanie praktyczne",
  quiz: "Quiz",
};

const TYPE_ICONS: Record<MaterialType, string> = {
  text: "M4 6h16M4 12h16M4 18h10",
  code_example: "m8 6-6 6 6 6M16 6l6 6-6 6",
  exercise: "M9 12.5 11.5 15 16 9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  quiz: "M9.1 9a2.9 2.9 0 1 1 3.9 2.7c-.9.4-1.5 1.2-1.5 2.3M12 17.5h.01",
};

function MaterialIcon({ type }: { type: MaterialType }) {
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-600">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d={TYPE_ICONS[type]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function MaterialCard({
  material,
  onRegenerate,
  onFeedback,
  onSubmitCode,
  onListSubmissions,
}: {
  material: Material;
  onRegenerate: (type: MaterialType) => Promise<void>;
  onFeedback: (materialId: number, rating: number, comment: string) => void;
  onSubmitCode: (materialId: number, code: string) => Promise<Submission>;
  onListSubmissions: (materialId: number) => Promise<Submission[]>;
}) {
  const [showSolution, setShowSolution] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    if (material.material_type !== "exercise") return;
    onListSubmissions(material.id).then(setSubmissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id, material.material_type]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate(material.material_type);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCheckCode() {
    setChecking(true);
    setCheckError(null);
    try {
      const result = await onSubmitCode(material.id, code);
      setSubmissions((prev) => [result, ...prev]);
    } catch (err) {
      setCheckError(err instanceof ApiError ? err.message : "Nie udało się sprawdzić rozwiązania.");
    } finally {
      setChecking(false);
    }
  }

  function submitFeedback(rating: number) {
    onFeedback(material.id, rating, feedbackComment);
    setFeedbackSent(true);
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MaterialIcon type={material.material_type} />
          <div>
            <h2 className="font-semibold text-slate-900">{TYPE_LABELS[material.material_type]}</h2>
            {material.critique_passed && (
              <span
                className="inline-flex items-center gap-1 text-xs text-green-600"
                title="Zweryfikowane przez agenta AI (generator + krytyk)"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                zweryfikowane przez AI
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          {regenerating && <Spinner className="h-3 w-3" />}
          {regenerating ? "Generowanie…" : "Wygeneruj ponownie"}
        </button>
      </div>

      {material.critique_notes && (
        <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <summary className="cursor-pointer select-none font-medium">Ocena agenta-krytyka</summary>
          <p className="mt-1">{material.critique_notes}</p>
        </details>
      )}

      {material.material_type === "text" && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{material.content.explanation}</p>
      )}

      {material.material_type === "code_example" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-slate-700">{material.content.explanation}</p>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 shadow-inner">
            <code>{material.content.code}</code>
          </pre>
        </div>
      )}

      {material.material_type === "exercise" && (
        <div className="flex flex-col gap-3 text-sm text-slate-700">
          <p className="whitespace-pre-wrap leading-relaxed">{material.content.instructions}</p>
          {material.content.hints && material.content.hints.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-slate-600">
              {material.content.hints.map((hint, i) => (
                <li key={i}>{hint}</li>
              ))}
            </ul>
          )}
          {material.content.solution && (
            <div>
              <button
                onClick={() => setShowSolution((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {showSolution ? "Ukryj rozwiązanie" : "Pokaż przykładowe rozwiązanie"}
              </button>
              {showSolution && (
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 shadow-inner">
                  <code>{material.content.solution}</code>
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500">Wklej swoje rozwiązanie do sprawdzenia przez AI</p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Wklej tutaj swój kod…"
              rows={8}
              spellCheck={false}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
            />
            {checkError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{checkError}</p>}
            <Button onClick={handleCheckCode} disabled={checking || code.trim().length === 0} size="sm" className="self-start">
              {checking && <Spinner className="h-3.5 w-3.5" />}
              {checking ? "Sprawdzanie…" : "Sprawdź rozwiązanie"}
            </Button>

            {submissions.length > 0 && (
              <div className="mt-1 flex flex-col gap-3">
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-xl border p-3.5 text-sm",
                      s.passed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                    )}
                  >
                    <p className={cn("flex items-center gap-1.5 font-medium", s.passed ? "text-green-700" : "text-amber-700")}>
                      {s.passed ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {s.passed ? "Zaliczone" : "Wymaga poprawy"}
                    </p>
                    <p className="mt-1.5 text-slate-700">{s.feedback}</p>
                    {s.strengths.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-slate-500">Mocne strony:</p>
                        <ul className="list-inside list-disc text-xs text-slate-600">
                          {s.strengths.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.improvements.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-slate-500">Do poprawy:</p>
                        <ul className="list-inside list-disc text-xs text-slate-600">
                          {s.improvements.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {material.material_type === "quiz" && material.content.questions && (
        <div className="flex flex-col gap-5">
          {material.content.questions.map((q, qIndex) => {
            const selected = selectedAnswers[qIndex];
            const showResult = selected !== undefined;
            return (
              <div key={qIndex} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {qIndex + 1}. {q.question}
                </p>
                <div className="flex flex-col gap-1.5">
                  {q.options.map((option, oIndex) => {
                    const isSelected = selected === oIndex;
                    const isCorrect = oIndex === q.correct_index;
                    return (
                      <button
                        key={oIndex}
                        onClick={() => setSelectedAnswers((prev) => ({ ...prev, [qIndex]: oIndex }))}
                        disabled={showResult}
                        className={cn(
                          "rounded-xl border px-3.5 py-2 text-left text-sm transition",
                          showResult && isCorrect
                            ? "border-green-400 bg-green-50 text-green-800"
                            : showResult && isSelected
                              ? "border-red-400 bg-red-50 text-red-800"
                              : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40"
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {showResult && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{q.explanation}</p>}
              </div>
            );
          })}
        </div>
      )}

      {!feedbackSent ? (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">Jak oceniasz ten materiał?</p>
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => submitFeedback(rating)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              >
                {rating}
              </button>
            ))}
            <Input
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Komentarz (opcjonalnie)"
              className="flex-1 py-1.5 text-sm"
            />
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs font-medium text-green-600">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dziękujemy za opinię!
        </p>
      )}
    </Card>
  );
}

function TutorChat({ moduleId, token }: { moduleId: number; token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTutorMessages(token, moduleId).then(setMessages);
  }, [token, moduleId]);

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const optimisticUserMessage: ChatMessage = {
      id: -Date.now(),
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setQuestion("");
    setLoading(true);
    setError(null);

    try {
      const answer = await api.askTutor(token, moduleId, trimmed);
      setMessages((prev) => [...prev, answer]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nie udało się uzyskać odpowiedzi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1.2-3.6a8.38 8.38 0 0 1-1-4A8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 8.5 8.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">Zapytaj tutora AI</h2>
          <p className="text-xs text-slate-500">Tutor odpowiada na podstawie materiałów całej ścieżki.</p>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex flex-col gap-2 py-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                m.role === "user"
                  ? "self-end rounded-br-sm bg-brand-gradient text-white"
                  : "self-start rounded-bl-sm bg-slate-100 text-slate-800"
              )}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2 border-t border-slate-100 pt-3.5">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="Zadaj pytanie o tę ścieżkę…"
          className="flex-1 py-2"
        />
        <Button onClick={handleAsk} disabled={loading || question.trim().length === 0} size="sm">
          {loading && <Spinner className="h-3.5 w-3.5" />}
          {loading ? "Myślę…" : "Wyślij"}
        </Button>
      </div>
    </Card>
  );
}

export default function ModuleDetailPage() {
  const { token, loading } = useRequireAuth();
  const params = useParams<{ id: string; moduleId: string }>();
  const router = useRouter();
  const pathId = Number(params.id);
  const moduleId = Number(params.moduleId);

  const [moduleInfo, setModuleInfo] = useState<{
    title: string;
    completed: boolean;
    is_remediation: boolean;
  } | null>(null);
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getPath(token, pathId).then((path) => {
      const found = path.modules.find((m) => m.id === moduleId);
      if (found) setModuleInfo({ title: found.title, completed: found.completed, is_remediation: found.is_remediation });
    });
    api
      .getModuleMaterials(token, moduleId)
      .then(setMaterials)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Nie udało się wczytać materiałów."));
  }, [token, pathId, moduleId]);

  async function handleRegenerate(materialType: MaterialType) {
    if (!token) return;
    const updated = await api.regenerateMaterial(token, moduleId, materialType);
    setMaterials((prev) => (prev || []).map((m) => (m.material_type === materialType ? updated : m)));
  }

  function handleFeedback(materialId: number, rating: number, comment: string) {
    if (!token) return;
    api.submitFeedback(token, materialId, rating, comment || undefined);
  }

  function handleSubmitCode(materialId: number, code: string) {
    if (!token) return Promise.reject(new Error("Brak autoryzacji."));
    return api.submitSolution(token, materialId, code);
  }

  function handleListSubmissions(materialId: number) {
    if (!token) return Promise.resolve([]);
    return api.listSubmissions(token, materialId);
  }

  async function handleToggleComplete() {
    if (!token || !moduleInfo) return;
    const next = !moduleInfo.completed;
    setModuleInfo({ ...moduleInfo, completed: next });
    await api.setProgress(token, moduleId, next);
  }

  if (loading || !token) return <LoadingState />;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
        <button
          onClick={() => router.push(`/paths/${pathId}`)}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-slate-500 transition hover:text-brand-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Wróć do ścieżki
        </button>

        {moduleInfo && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{moduleInfo.title}</h1>
            <div className="flex items-center gap-2">
              {moduleInfo.is_remediation && <Badge tone="brand">Powtórka wygenerowana przez agenta AI</Badge>}
              {moduleInfo.completed && <Badge tone="green">Ukończony</Badge>}
            </div>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {!materials && !error && <LoadingState label="Generowanie materiałów…" />}

        {materials && (
          <>
            <div className="flex flex-col gap-4">
              {materials.map((material) => (
                <MaterialCard
                  key={material.material_type}
                  material={material}
                  onRegenerate={handleRegenerate}
                  onFeedback={handleFeedback}
                  onSubmitCode={handleSubmitCode}
                  onListSubmissions={handleListSubmissions}
                />
              ))}
            </div>

            <Button
              onClick={handleToggleComplete}
              variant={moduleInfo?.completed ? "secondary" : "primary"}
              size="lg"
              className="self-start"
            >
              {moduleInfo?.completed && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {moduleInfo?.completed ? "Moduł ukończony" : "Oznacz jako ukończony"}
            </Button>

            <TutorChat moduleId={moduleId} token={token} />
          </>
        )}
      </main>
    </>
  );
}
