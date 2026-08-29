"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo-mark";

const FEATURES = [
  {
    title: "Ścieżka dopasowana do Ciebie",
    description: "AI buduje plan nauki na podstawie Twojego poziomu, celu i dostępnego czasu.",
    icon: (
      <path d="M4 12h16M4 6h16M4 18h10" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Materiały, zadania i quizy",
    description: "Teoria, przykłady kodu i praktyczne ćwiczenia generowane i weryfikowane przez agentów AI.",
    icon: (
      <path
        d="M9 3h6a2 2 0 0 1 2 2v14l-5-3-5 3V5a2 2 0 0 1 2-2Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Tutor AI i rekomendacje",
    description: "Zadawaj pytania tutorowi i otrzymuj rekomendacje tempa nauki na podstawie Twoich postępów.",
    icon: (
      <path
        d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1.2-3.6a8.38 8.38 0 0 1-1-4A8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 8.5 8.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-brand-radial" />

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-16 pt-24 text-center sm:pt-32">
        <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-medium text-brand-700">
          <LogoMark className="h-5 w-5" />
          Nauka programowania napędzana przez AI
        </div>
        <h1 className="animate-fade-up text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl [animation-delay:80ms]">
          Spersonalizowane ścieżki edukacyjne{" "}
          <span className="bg-brand-gradient bg-clip-text text-transparent">dla programistów</span>
        </h1>
        <p className="animate-fade-up max-w-xl text-balance text-lg text-slate-600 [animation-delay:160ms]">
          Wybierz technologię, określ swój poziom i dostępny czas — model AI zbuduje dla Ciebie
          dopasowaną ścieżkę nauki wraz z materiałami, zadaniami i quizami.
        </p>
        {!loading && (
          <div className="animate-fade-up flex flex-wrap items-center justify-center gap-3 [animation-delay:240ms]">
            {user ? (
              <Link href="/dashboard" className={buttonStyles("primary", "lg")}>
                Przejdź do panelu
              </Link>
            ) : (
              <>
                <Link href="/register" className={buttonStyles("primary", "lg")}>
                  Zacznij naukę
                </Link>
                <Link href="/login" className={buttonStyles("outline", "lg")}>
                  Zaloguj się
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-4xl gap-4 px-4 pb-24 sm:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Card
            key={feature.title}
            className="animate-fade-up flex flex-col gap-3 p-5"
            style={{ animationDelay: `${300 + i * 100}ms` }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {feature.icon}
              </svg>
            </span>
            <h2 className="font-semibold text-slate-900">{feature.title}</h2>
            <p className="text-sm text-slate-600">{feature.description}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
