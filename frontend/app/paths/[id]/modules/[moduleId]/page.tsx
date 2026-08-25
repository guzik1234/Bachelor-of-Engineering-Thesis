"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import type { ChatMessage, Material, MaterialType, Submission } from "@/lib/types";

const TYPE_LABELS: Record<MaterialType, string> = {
  text: "Wyjaśnienie",
  code_example: "Przykład kodu",
  exercise: "Zadanie praktyczne",
  quiz: "Quiz",
};

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
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-900">{TYPE_LABELS[material.material_type]}</h2>
          {material.critique_passed && (
            <span className="text-xs text-green-600" title="Zweryfikowane przez agenta AI (generator + krytyk)">
              ✓ zweryfikowane przez AI
            </span>
          )}
        </div>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="text-xs text-slate-500 underline hover:text-slate-900 disabled:opacity-50"
        >
          {regenerating ? "Generowanie…" : "Wygeneruj ponownie"}
        </button>
      </div>

      {material.critique_notes && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Ocena agenta-krytyka</summary>
          <p className="mt-1">{material.critique_notes}</p>
        </details>
      )}

      {material.material_type === "text" && (
        <p className="whitespace-pre-wrap text-sm text-slate-700">{material.content.explanation}</p>
      )}

      {material.material_type === "code_example" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-700">{material.content.explanation}</p>
          <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
            <code>{material.content.code}</code>
          </pre>
        </div>
      )}

      {material.material_type === "exercise" && (
        <div className="flex flex-col gap-3 text-sm text-slate-700">
          <p className="whitespace-pre-wrap">{material.content.instructions}</p>
          {material.content.hints && material.content.hints.length > 0 && (
            <ul className="list-inside list-disc text-slate-600">
              {material.content.hints.map((hint, i) => (
                <li key={i}>{hint}</li>
              ))}
            </ul>
          )}
          {material.content.solution && (
            <div>
              <button onClick={() => setShowSolution((v) => !v)} className="text-xs text-slate-500 underline">
                {showSolution ? "Ukryj rozwiązanie" : "Pokaż przykładowe rozwiązanie"}
              </button>
              {showSolution && (
                <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                  <code>{material.content.solution}</code>
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500">Wklej swoje rozwiązanie do sprawdzenia przez AI</p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Wklej tutaj swój kod…"
              rows={8}
              spellCheck={false}
              className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
            />
            {checkError && <p className="text-sm text-red-600">{checkError}</p>}
            <button
              onClick={handleCheckCode}
              disabled={checking || code.trim().length === 0}
              className="self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {checking ? "Sprawdzanie…" : "Sprawdź rozwiązanie"}
            </button>

            {submissions.length > 0 && (
              <div className="mt-2 flex flex-col gap-3">
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-md border p-3 text-sm ${
                      s.passed ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"
                    }`}
                  >
                    <p className={`font-medium ${s.passed ? "text-green-700" : "text-amber-700"}`}>
                      {s.passed ? "✓ Zaliczone" : "Wymaga poprawy"}
                    </p>
                    <p className="mt-1 text-slate-700">{s.feedback}</p>
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
        <div className="flex flex-col gap-4">
          {material.content.questions.map((q, qIndex) => {
            const selected = selectedAnswers[qIndex];
            const showResult = selected !== undefined;
            return (
              <div key={qIndex} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {qIndex + 1}. {q.question}
                </p>
                <div className="flex flex-col gap-1">
                  {q.options.map((option, oIndex) => {
                    const isSelected = selected === oIndex;
                    const isCorrect = oIndex === q.correct_index;
                    return (
                      <button
                        key={oIndex}
                        onClick={() => setSelectedAnswers((prev) => ({ ...prev, [qIndex]: oIndex }))}
                        disabled={showResult}
                        className={`rounded-md border px-3 py-1.5 text-left text-sm ${
                          showResult && isCorrect
                            ? "border-green-500 bg-green-50"
                            : showResult && isSelected
                              ? "border-red-500 bg-red-50"
                              : "border-slate-200"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {showResult && <p className="text-xs text-slate-600">{q.explanation}</p>}
              </div>
            );
          })}
        </div>
      )}

      {!feedbackSent ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">Jak oceniasz ten materiał?</p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => submitFeedback(rating)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-sm hover:border-slate-400"
              >
                {rating}
              </button>
            ))}
            <input
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Komentarz (opcjonalnie)"
              className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
          </div>
        </div>
      ) : (
        <p className="border-t border-slate-100 pt-3 text-xs text-green-600">Dziękujemy za opinię!</p>
      )}
    </section>
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
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Zapytaj tutora AI</h2>
      <p className="text-xs text-slate-500">
        Tutor odpowiada na podstawie materiałów całej ścieżki — możesz pytać też o wcześniejsze lekcje.
      </p>

      {messages.length > 0 && (
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "self-end bg-slate-900 text-white" : "self-start bg-slate-100 text-slate-800"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="Zadaj pytanie o tę ścieżkę…"
          className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />
        <button
          onClick={handleAsk}
          disabled={loading || question.trim().length === 0}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Myślę…" : "Wyślij"}
        </button>
      </div>
    </section>
  );
}

export default function ModuleDetailPage() {
  const { token, loading } = useRequireAuth();
  const params = useParams<{ id: string; moduleId: string }>();
  const router = useRouter();
  const pathId = Number(params.id);
  const moduleId = Number(params.moduleId);

  const [moduleInfo, setModuleInfo] = useState<{ title: string; completed: boolean } | null>(null);
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.getPath(token, pathId).then((path) => {
      const found = path.modules.find((m) => m.id === moduleId);
      if (found) setModuleInfo({ title: found.title, completed: found.completed });
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

  if (loading || !token) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
        <button
          onClick={() => router.push(`/paths/${pathId}`)}
          className="self-start text-sm text-slate-500 underline"
        >
          ← Wróć do ścieżki
        </button>

        {moduleInfo && <h1 className="text-2xl font-bold">{moduleInfo.title}</h1>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!materials && !error && <p className="text-slate-600">Generowanie materiałów…</p>}

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

            <button
              onClick={handleToggleComplete}
              className={`self-start rounded-md px-4 py-2 text-sm font-medium ${
                moduleInfo?.completed ? "bg-green-600 text-white" : "bg-slate-900 text-white"
              }`}
            >
              {moduleInfo?.completed ? "✓ Moduł ukończony" : "Oznacz jako ukończony"}
            </button>

            <TutorChat moduleId={moduleId} token={token} />
          </>
        )}
      </main>
    </>
  );
}
