"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import type { LearningStyle, MaterialType } from "@/lib/types";

const MATERIAL_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: "text", label: "Wyjaśnienia teoretyczne" },
  { value: "code_example", label: "Przykłady kodu" },
  { value: "exercise", label: "Zadania praktyczne" },
  { value: "quiz", label: "Quizy sprawdzające wiedzę" },
];

const STYLE_OPTIONS: { value: LearningStyle; label: string; description: string }[] = [
  { value: "theory", label: "Teoria", description: "Skup się na wyjaśnieniach i koncepcjach" },
  { value: "practice", label: "Praktyka", description: "Ucz się głównie przez zadania i kod" },
  { value: "mixed", label: "Mieszany", description: "Zrównoważona mieszanka obu podejść" },
];

function OptionPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
        selected
          ? "border-brand-400 bg-brand-50 text-brand-700 ring-4 ring-brand-500/10"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 flex-none items-center justify-center rounded-full border transition",
          selected ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300"
        )}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

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

  if (loading || !token) return <LoadingState />;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Twoje preferencje nauki</h1>
          <p className="mt-1 text-slate-600">
            Te informacje pomagają modelowi AI dopasować generowane ścieżki i materiały do Ciebie.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3 p-5">
            <span className="font-semibold text-slate-900">Preferowany rodzaj materiałów</span>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {MATERIAL_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  selected={materialTypes.includes(opt.value)}
                  onClick={() => toggleMaterialType(opt.value)}
                >
                  {opt.label}
                </OptionPill>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <span className="font-semibold text-slate-900">Dostępny czas na naukę</span>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={40}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-100 accent-brand-600"
              />
              <Input
                type="number"
                min={1}
                max={60}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-24 flex-none text-center"
              />
            </div>
            <span className="text-xs text-slate-400">godzin tygodniowo</span>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <span className="font-semibold text-slate-900">Preferowany styl nauki</span>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLearningStyle(opt.value)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition",
                    learningStyle === opt.value
                      ? "border-brand-400 bg-brand-50 ring-4 ring-brand-500/10"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      learningStyle === opt.value ? "text-brand-700" : "text-slate-800"
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="text-xs text-slate-500">{opt.description}</span>
                </button>
              ))}
            </div>
          </Card>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting} size="lg" className="self-start">
            {submitting ? "Zapisywanie..." : "Zapisz i przejdź do panelu"}
          </Button>
        </form>
      </main>
    </>
  );
}
