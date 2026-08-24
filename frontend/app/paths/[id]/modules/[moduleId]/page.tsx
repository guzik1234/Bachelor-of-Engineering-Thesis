"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import type { Material, MaterialType } from "@/lib/types";

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
}: {
  material: Material;
  onRegenerate: (type: MaterialType) => Promise<void>;
  onFeedback: (materialId: number, rating: number, comment: string) => void;
}) {
  const [showSolution, setShowSolution] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate(material.material_type);
    } finally {
      setRegenerating(false);
    }
  }

  function submitFeedback(rating: number) {
    onFeedback(material.id, rating, feedbackComment);
    setFeedbackSent(true);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{TYPE_LABELS[material.material_type]}</h2>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="text-xs text-slate-500 underline hover:text-slate-900 disabled:opacity-50"
        >
          {regenerating ? "Generowanie…" : "Wygeneruj ponownie"}
        </button>
      </div>

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
          </>
        )}
      </main>
    </>
  );
}
