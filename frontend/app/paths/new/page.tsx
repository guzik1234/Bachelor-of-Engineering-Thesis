"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
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

  if (loading || !token) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">Wygeneruj nową ścieżkę edukacyjną</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Technologia / język programowania
            <input
              required
              list="technology-suggestions"
              value={technology}
              onChange={(e) => setTechnology(e.target.value)}
              placeholder="np. React, Java, Spring Boot, Python"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <datalist id="technology-suggestions">
              {SUGGESTED_TECHNOLOGIES.map((tech) => (
                <option key={tech} value={tech} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Poziom zaawansowania
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="beginner">Początkujący</option>
              <option value="intermediate">Średniozaawansowany</option>
              <option value="advanced">Zaawansowany</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Cel nauki (opcjonalnie)
            <textarea
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              placeholder="np. przygotowanie do pierwszej pracy jako backend developer"
              className="rounded-md border border-slate-300 px-3 py-2"
              rows={3}
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Generowanie ścieżki (może potrwać kilka-kilkanaście sekund)…" : "Generuj ścieżkę"}
          </button>
        </form>
      </main>
    </>
  );
}
