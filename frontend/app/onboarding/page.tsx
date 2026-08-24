"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import type { LearningStyle, MaterialType } from "@/lib/types";

const MATERIAL_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: "text", label: "Wyjaśnienia teoretyczne" },
  { value: "code_example", label: "Przykłady kodu" },
  { value: "exercise", label: "Zadania praktyczne" },
  { value: "quiz", label: "Quizy sprawdzające wiedzę" },
];

const STYLE_OPTIONS: { value: LearningStyle; label: string }[] = [
  { value: "theory", label: "Teoria" },
  { value: "practice", label: "Praktyka" },
  { value: "mixed", label: "Mieszany" },
];

export default function OnboardingPage() {
  const { token, loading } = useRequireAuth();
  const router = useRouter();

  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>(["text", "exercise"]);
  const [hoursPerWeek, setHoursPerWeek] = useState(5);
  const [learningStyle, setLearningStyle] = useState<LearningStyle>("mixed");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getPreferences(token).then((existing) => {
      if (existing) {
        setMaterialTypes(existing.preferred_material_types);
        setHoursPerWeek(existing.available_hours_per_week);
        setLearningStyle(existing.learning_style);
      }
    });
  }, [token]);

  function toggleMaterialType(value: MaterialType) {
    setMaterialTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.updatePreferences(token, {
        preferred_material_types: materialTypes,
        available_hours_per_week: hoursPerWeek,
        learning_style: learningStyle,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nie udało się zapisać preferencji.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">Twoje preferencje nauki</h1>
        <p className="text-slate-600">
          Te informacje pomagają modelowi AI dopasować generowane ścieżki i materiały do Ciebie.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">Preferowany rodzaj materiałów</legend>
            {MATERIAL_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={materialTypes.includes(opt.value)}
                  onChange={() => toggleMaterialType(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            Dostępny czas na naukę (godzin/tydzień)
            <input
              type="number"
              min={1}
              max={60}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(Number(e.target.value))}
              className="w-32 rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">Preferowany styl nauki</legend>
            {STYLE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="learningStyle"
                  checked={learningStyle === opt.value}
                  onChange={() => setLearningStyle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Zapisywanie..." : "Zapisz i przejdź do panelu"}
          </button>
        </form>
      </main>
    </>
  );
}
