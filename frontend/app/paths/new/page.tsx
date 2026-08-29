"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import type { ExperienceLevel } from "@/lib/types";

const SUGGESTED_TECHNOLOGIES = ["Java (Spring Boot)", "React", "Python", "JavaScript (Full Stack)"];

export default function NewPathPage() {
  const { token, loading } = useRequireAuth();
  const router = useRouter();

  const [technology, setTechnology] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("beginner");
  const [learningGoal, setLearningGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const path = await api.generatePath(token, {
        technology,
        experience_level: experienceLevel,
        learning_goal: learningGoal || undefined,
      });
      router.push(`/paths/${path.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nie udało się wygenerować ścieżki. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) return <LoadingState />;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Wygeneruj nową ścieżkę edukacyjną</h1>
          <p className="mt-1 text-sm text-slate-500">
            Opisz czego chcesz się nauczyć — AI zbuduje kompletny plan z materiałami i zadaniami.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Technologia / język programowania">
              <Input
                required
                list="technology-suggestions"
                value={technology}
                onChange={(e) => setTechnology(e.target.value)}
                placeholder="np. React, Java, Spring Boot, Python"
              />
              <datalist id="technology-suggestions">
                {SUGGESTED_TECHNOLOGIES.map((tech) => (
                  <option key={tech} value={tech} />
                ))}
              </datalist>
            </Field>

            <Field label="Poziom zaawansowania">
              <Select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}>
                <option value="beginner">Początkujący</option>
                <option value="intermediate">Średniozaawansowany</option>
                <option value="advanced">Zaawansowany</option>
              </Select>
            </Field>

            <Field label="Cel nauki (opcjonalnie)">
              <Textarea
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value)}
                placeholder="np. przygotowanie do pierwszej pracy jako backend developer"
                rows={3}
              />
            </Field>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting} size="lg" className="mt-1">
              {submitting && <Spinner />}
              {submitting ? "Generowanie ścieżki (może potrwać kilka-kilkanaście sekund)…" : "Generuj ścieżkę"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
