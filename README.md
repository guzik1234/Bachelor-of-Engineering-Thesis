# Wykorzystanie systemu generatywnej AI do budowania ścieżki edukacyjnej dla programistów

> Generative AI model to build learning materials for programmers — praca inżynierska.

Aplikacja webowa, która wykorzystuje model LLM (Groq) do generowania spersonalizowanych
ścieżek edukacyjnych dla programistów — dopasowanych do wybranej technologii, poziomu
zaawansowania, dostępnego czasu na naukę i preferowanego stylu nauki. System zbiera opinie
kursanta o wygenerowanych materiałach i wykorzystuje je przy kolejnych generacjach.

Pełna specyfikacja wymagań funkcjonalnych i niefunkcjonalnych, analiza konkurencji oraz
uzasadnienie doboru technologii znajdują się w [`wymagania/`](wymagania/).

## Architektura

| Warstwa | Technologia |
|---|---|
| Frontend | React + Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |
| Baza danych | PostgreSQL (SQLAlchemy 2.0 ORM) |
| Model LLM | Groq API (domyślnie `openai/gpt-oss-120b`) |
| Agent AI | LangGraph + `langchain-groq` (3 agenty, patrz niżej) |
| Retrieval (RAG) | `rank-bm25` — leksykalny retrieval bez dodatkowej infrastruktury |
| Autoryzacja | JWT (bcrypt + python-jose) |
| Konteneryzacja | Docker + Docker Compose |
| Testy backendu | Pytest |

Stack jest celowo uproszczony względem pierwotnej propozycji z `wymagania/1 (3).pdf` — na
start pominięto Keycloak/Auth0 (zastąpione prostym JWT) oraz pgvector. Potrzebę wyszukiwania
semantycznego dla agenta-tutora (patrz niżej) zaspokaja lżejszy mechanizm — leksykalny retrieval
BM25 w Pythonie — więc pgvector/embeddingi wciąż nie są potrzebne; można je dołożyć w kolejnych
iteracjach bez przebudowy architektury, gdyby korpus materiałów znacząco urósł.

Framework agentowy (LangGraph) został świadomie dołożony punktowo — tylko tam, gdzie zadanie
faktycznie wymaga wieloetapowego działania ze stanem (agent rekomendacji, agent generator+krytyk,
agent-tutor z RAG — patrz sekcja niżej). Pozostałe funkcje AI (generowanie ścieżki, ocena zadań)
to celowo proste, pojedyncze wywołania SDK Groq przez `llm_client.py` — nie ma potrzeby
przepisywania ich na framework, skoro nie wymagają wielu kroków ani pętli.

## Struktura repozytorium

```
backend/            FastAPI — API, modele danych, integracja z LLM, testy
  app/
    core/            konfiguracja, baza danych, bezpieczeństwo (JWT, hashowanie haseł)
    models/          modele SQLAlchemy (User, LearningPath, Module, Material, Progress, Feedback...)
    schemas/         schematy Pydantic (walidacja request/response)
    services/        klient Groq, budowanie promptów, generowanie ścieżek i materiałów
    api/routes/      endpointy REST
  tests/             testy Pytest (auth, generowanie ścieżek)
frontend/            Next.js — interfejs kursanta
  app/               strony (App Router): logowanie, rejestracja, onboarding, dashboard, ścieżki, moduły
  lib/               klient API, kontekst autoryzacji, typy TS
  components/        komponenty współdzielone
wymagania/           dokumentacja wymagań (PDF) — punkt wyjścia projektu
docker-compose.yml   uruchomienie całości: PostgreSQL + backend + frontend
```

## Uruchomienie

### 1. Docker Compose (zalecane)

1. `backend/.env` i `frontend/.env` są już przygotowane (kopie `.env.example`).
2. Ustaw w `backend/.env` swój `GROQ_API_KEY` — darmowy klucz można wygenerować na
   https://console.groq.com/keys.
3. `docker compose up --build`
4. Frontend: http://localhost:3000, backend (Swagger): http://localhost:8000/docs

> Projekt nie używa Alembic — schemat bazy powstaje przez `Base.metadata.create_all` przy
> starcie (`backend/app/main.py`), co tworzy brakujące TABELE, ale nie dokłada nowych KOLUMN do
> tabel, które już istnieją w wolumenie Postgresa. Jeśli baza z wcześniejszego uruchomienia już
> istnieje, po aktualizacji kodu zrób `docker compose down -v` (usuwa wolumen — tylko dane
> deweloperskie/testowe) albo ręczny `ALTER TABLE`.

### 2. Uruchomienie lokalne (bez Dockera)

Backend (wymaga lokalnego PostgreSQL zgodnego z `DATABASE_URL` w `backend/.env`):
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Testy backendu (nie wymagają PostgreSQL — używają bazy SQLite w pamięci):
```bash
cd backend && .venv/Scripts/python -m pytest -v
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

## Zaimplementowane funkcjonalności

Zgodnie z `wymagania/Wymagania Funkcjonalne I Niefunkcjonalne Ai Sciezka Edukacyjna.pdf`:

- Rejestracja, logowanie, JWT, edycja profilu (w.f. 1–4)
- Zapis preferencji nauki: rodzaj materiałów, dostępny czas, styl nauki (w.f. 4, 7, 8, 1.2.3)
- Wybór technologii i poziomu zaawansowania, generowanie spersonalizowanej ścieżki przez LLM (w.f. 5, 6, 9)
- Wiele niezależnych ścieżek na konto — spełnia wymóg 3–4 różnych ścieżek (w.f. 12)
- Generowanie materiałów: wyjaśnienia tekstowe, przykłady kodu, zadania praktyczne, quizy (w.f. 13–16)
- Ponowne generowanie materiału (w.f. 17)
- Oznaczanie ukończonych modułów, prezentacja postępu (w.f. 18–19)
- Ocena materiałów (1–5) i komentarze, wykorzystywane przy kolejnej generacji tego typu materiału (w.f. 21–23)
- Integracja z LLM przez API + obsługa niedostępności modelu (HTTP 503 zamiast błędu krytycznego) (w.f. 24–26)
- Sprawdzanie kodu w zadaniach praktycznych: kursant wkleja rozwiązanie, model AI ocenia je
  względem treści zadania (bez wykonywania kodu) i zwraca werdykt zaliczone/niezaliczone wraz
  z mocnymi stronami i konkretnymi wskazówkami do poprawy; historia prób jest zapisywana
  (rozszerzenie w.f. 15, inspirowane automatyczną oceną kodu w Codecademy z `wymagania/1 1.pdf`)
- Dostosowywanie poziomu trudności materiałów do postępów kursanta (w.f. 10) oraz rekomendacja
  kolejnego tematu i ocena tempa nauki (w.f. 1.2.1–1.2.2) — realizowane przez **agenta AI**
  zbudowanego na LangGraph (`backend/app/services/recommendation_agent.py`), w odróżnieniu od
  pozostałych funkcji AI w projekcie (pojedyncze wywołanie `llm_client.generate_json`). Agent to
  wieloetapowy graf stanu: zbiera sygnały o postępach (ukończone moduły, tempo, oceny, zdawalność
  zadań) → wywołuje model → waliduje odpowiedź względem schematu → w razie niepowodzenia wraca do
  modelu z komunikatem korygującym (pętla samokorekty, maks. 3 próby). Wynik jest zapisywany
  (`PathRecommendation`) i używany przy kolejnej generacji materiałów w danym module.
- **Agent generator + krytyk** (`backend/app/services/material_critic_agent.py`) — rozszerza
  w.f. 21–23: po wygenerowaniu materiału drugi krok LLM ocenia go (poprawność merytoryczna,
  dopasowanie do poziomu, zgodność z wcześniejszymi opiniami kursantów) i w razie odrzucenia
  wymusza jedną regenerację z uwzględnieniem uwag krytyka, zanim treść trafi do kursanta. Wynik
  oceny (`critique_passed`, `critique_notes`) jest zapisywany przy materiale i widoczny w UI.
- **Agent-tutor (chatbot Q&A) z RAG** (`backend/app/services/tutor_agent.py`, w.f. 1.2.10) —
  architektura retrieve→generate: leksykalny retrieval (BM25, `rank-bm25`) po materiałach całej
  ścieżki (nie tylko bieżącego modułu, więc kursant może pytać też o wcześniejsze lekcje),
  odpowiedź LLM ugruntowana w pobranych fragmentach, z podaniem modułu źródłowego. Historia
  rozmowy per moduł jest zapisywana (`ChatMessage`).
- Statystyki nauki i porównanie ścieżek (w.f. 1.2.14, 1.2.16) — strona `/stats`
  (`backend/app/api/routes/stats.py`, `frontend/app/stats/page.tsx`): zbiorcze KPI (ukończenie,
  średnia ocena, zdawalność zadań) oraz wykresy słupkowe porównujące poszczególne ścieżki, plus
  zestawienie tempa nauki z agenta rekomendacji. Reużywa `collect_signals` z agenta rekomendacji
  (ważona agregacja po wszystkich ścieżkach użytkownika) zamiast duplikować logikę. Ścieżki bez
  żadnych ocen/zgłoszonych zadań są pomijane w odpowiednim wykresie zamiast pokazywać mylące 0%.

Nie zaimplementowane jeszcze (lista „powinien”, `wymagania/...pdf` §1.2) — naturalne kolejne
kroki: eksport do PDF, wersja wielojęzyczna, powiadomienia.

## Rejestrowanie 3–4 ścieżek edukacyjnych

Wymaganie z tematu pracy („Należy przygotować i zarejestrować 3–4 różne ścieżki
edukacyjne”) realizuje się przez wygenerowanie w działającej aplikacji np.:

1. Java Backend Developer (Spring Boot)
2. Frontend Developer (React)
3. Fullstack JavaScript Developer
4. AI for Developers (Python + LLM)

— każda ścieżka to osobne wywołanie `POST /api/learning-paths/generate` z innymi
parametrami `technology` / `experience_level`, zapisywane trwale w bazie danych na potrzeby
ewaluacji pracy.
