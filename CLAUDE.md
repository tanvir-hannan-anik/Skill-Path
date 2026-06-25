# CLAUDE.md

Guidance for working in this repository.

## What this is

**SkillPath** — a personalized, AI-powered learning tracker. A user picks a skill
("workspace"), and the app schedules daily learning content (videos, docs, notes,
quizzes, tasks), tracks progress and streaks, generates AI study material, and
includes soft-skills modules and an interactive code visualizer.

It is a **client-side SPA** — there is no custom application backend server. All
"backend" work is done directly from the browser against managed services
(Firebase, Supabase) and third-party AI/search APIs.

## Tech stack

- **Build:** Vite 6 (dev server on port **3000**, host `0.0.0.0`)
- **UI:** React 19 + TypeScript (`type: module`)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`), class-based dark mode
- **Animation:** `motion` (Framer Motion's successor)
- **Icons:** `lucide-react`
- **Auth + realtime data:** Firebase (Auth + Firestore)
- **Secondary data / push tokens:** Supabase (`@supabase/supabase-js`)
- **AI:** Groq (LLaMA 3.3 70B) over the OpenAI-compatible REST API — called
  directly from the browser via `fetch`. (`@google/genai` / `src/lib/gemini.ts`
  is **legacy and currently unused**; do not build on it.)
- **PDF / export:** `jspdf`, `jszip`, plus a PPTX→PDF helper
- **E2E:** Playwright (test scripts live at repo root, e.g. `test_features.mjs`)

## Commands

```bash
npm run dev      # Vite dev server → http://localhost:3000
npm run build    # production bundle → dist/
npm run preview  # preview the production bundle
npm run lint     # TypeScript type-check (tsc --noEmit)
```

> `npm run lint` currently reports pre-existing errors only in
> `supabase/functions/daily-reminder/index.ts` (a Deno edge function that
> references Deno globals / remote imports unknown to the app's tsconfig).
> These are **not** part of the app build and can be ignored.

## Architecture

### Entry & providers
`src/main.tsx` mounts `<App>` wrapped in nested providers (outer→inner):
`ThemeProvider` → `ToastProvider` → `AuthProvider`.

### Top-level routing (`src/App.tsx`)
A simple state machine with three routes: `onboarding` | `auth` | `dashboard`
(no router library). Boot logic decides where to send the user based on auth
state and whether a returning guest already has local workspaces. On sign-in,
guest data (schedule + chat) is migrated from `localStore` into Firestore.

### In-app navigation (`src/components/Dashboard.tsx`)
The dashboard is the real "app shell." It does **not** use URL routes — it
switches between feature pages via an `activeTab` state of type `NavItem`
(see `src/types.ts`). Heavy pages are `React.lazy`-loaded inside `<Suspense>`.

`NavItem` =
`dashboard | learn | plan | tasks | calendar | insights | code-tutor | profile | communication | vocabulary`

**To add a new tab:** (1) add the id to `NavItem` in `types.ts`, (2) add a nav
entry in `src/components/Sidebar.tsx` (`NAV_ITEMS` or `SOFT_SKILLS_ITEMS`),
(3) render it in `Dashboard.tsx`'s `activeTab === '…'` block (lazy-load if heavy).
There is also a separate `MOBILE_NAV` array in `Dashboard.tsx` for the mobile
bottom bar.

### Workspaces
A "workspace" is one skill/learning track. `useWorkspaces` manages them; the
active workspace scopes the schedule, insights, etc. Guests get a default
workspace created in `localStore`; signed-in users' workspaces live in Firestore.

### State & data flow
- `useSchedule(uid, wsId)` — subscribes to the schedule in real time and writes
  back through a debounce so editing feels instant without hammering the DB.
- `AuthContext` — exposes `signIn / signUp / signInWithGoogle / resetPassword /
  logout` + an auth-loading flag; routes are gated on `user`.
- Guests (no auth) persist to `localStore` (localStorage); signed-in users
  persist to Firestore. Local files (notes blobs) are stored in IndexedDB via
  `fileStore.ts`, **not** in the schedule object.
- `useToast()` (from `ToastProvider`) is available app-wide.

## Directory map

```
src/
  App.tsx                 Top-level route state machine
  main.tsx                Root render + providers
  types.ts                Shared types incl. NavItem, Schedule, DayContent, StudyPack…
  index.css               Tailwind import + @theme tokens + dark-mode overrides
  components/
    Dashboard.tsx         App shell, tab switching, mobile nav
    Sidebar.tsx           Desktop sidebar nav (NAV_ITEMS / SOFT_SKILLS_ITEMS)
    Onboarding.tsx        First-run skill picker
    AuthPage.tsx          Sign in / up / reset
    LearnContentView.tsx  "Learn" tab — daily content
    PlanPage.tsx          "Plan" tab — schedule builder
    TasksPage.tsx         "Tasks" tab
    CalendarView.tsx      "Calendar" tab
    InsightsPage.tsx      "Insights" tab — AI chat (Groq) + weekly project + trackers
    CodeTutorPage.tsx     "Code Tutor" tab — Python-Tutor-style code visualizer
    CommunicationPage.tsx Soft skill — communication practice
    VocabularyPage.tsx    Soft skill — English vocabulary
    ProfilePage.tsx       Profile & achievements
    VideoMode.tsx / VideoPortionScheduler.tsx / useYouTubePlayer  Video scheduling
    NotesMode.tsx / NoteViewerModal.tsx   Notes (Drive + local files)
    DocsMode.tsx / SearchPage.tsx / Inline*Search.tsx   Docs & search
    StudyPackView.tsx     AI study-pack viewer
    WorkspaceSwitcher.tsx Workspace dropdown
    ThemeToggle.tsx       Light/dark toggle
    ui/                   FullPageLoader, Skeleton, ConfigBanner
  hooks/                  useSchedule, useWorkspaces, useStreak, useStudyPack,
                          useVideoPlan, useYouTubePlayer
  lib/
    AuthContext.tsx       Firebase auth context
    firebase.ts / firestore.ts   Firebase init + per-user CRUD
    supabase.ts / supabaseDb.ts  Supabase client + queries
    localStore.ts         Guest persistence (localStorage)
    fileStore.ts          Local note blobs in IndexedDB
    groq.ts               Groq AI calls (chat, quiz, tasks, study pack, code trace)
    gemini.ts             LEGACY / unused
    studyPack.ts / softSkills.ts / search.ts / youtube.ts   Feature logic
    dates.ts              Date-key helpers (YYYY-MM-DD)
    theme.tsx / toast.tsx Providers
    notifications.ts      FCM push token registration → Supabase
    pptxToPdf.ts          PPTX→PDF conversion for note previews
supabase/functions/daily-reminder/   Deno edge function (push reminders) — not in app build
functions/                           Firebase Functions (index.js)
```

## AI integration (`src/lib/groq.ts`)

All AI runs through Groq's OpenAI-compatible endpoint, called directly from the
browser with `VITE_GROQ_API_KEY` (Study Pack uses a second key,
`VITE_GROQ_STUDYPACK_API_KEY`). Model: `llama-3.3-70b-versatile`.

Key exports:
- `isGroqConfigured` — boolean gate used by UI to show "not configured" states.
- `streamGroqReply(...)` — streaming SkillPath tutor chat (Insights tab).
- `streamGroqChat({ system, history, userMessage, onDelta, signal })` — generic
  streaming chat with a caller-supplied system prompt (Code Tutor uses this).
- `generateQuiz`, `generateTasks`, `generateWeeklyProject`, `generateStudyPackViaGroq`.
- `traceCode(code, language)` — Code Tutor: asks the model to simulate execution
  and return a JSON array of `TraceStep`s (frames, heap, stdout per step, ≤40
  steps). Uses `LANG_NAMES` to tell the model the language (Python/JS/C/C++/Java).
- `runViaPiston(code, language)` — best-effort real execution via the public
  Piston API (`emkc.org/api/v2/piston`) to capture true stdout; returns `null` on
  failure. Holds the language→runtime version map for all five languages.

Trace types: `TraceStep`, `TraceFrame`, `HeapObject`.

## Code Tutor (`src/components/CodeTutorPage.tsx`)

A full-screen "IDE" page inspired by Python Tutor's display mode. Three panels:
- **Left:** editor (textarea), language selector, examples menu, and
  Visualize / Share / Clear buttons.
- **Center:** code display with active-line highlight + red `→` gutter arrow,
  step controls (first/prev/auto-play/next/last + slider), and the streaming
  **AI Tutor** chat (supports Bengali; "Ask about this step").
- **Right:** the **Frames & Objects** memory map and the Output (terminal) panel.

**Languages:** Python, JavaScript, C, C++, Java. The selected language drives
both the AI-generated trace (`traceCode`) and the real-output compiler run
(`runViaPiston`). Language display names live in `LANG_NAMES` in `groq.ts`;
Piston runtimes are mapped inside `runViaPiston`. (Java: keep the public class
named `Main` or the Piston run fails — the AI visualization still works.)

**Frames & Objects memory map** (`MemoryMap` + `FrameBox` / `ObjectBox` /
`ValueCell`): a Python-Tutor-style diagram with a Frames column (global at top →
most recent at bottom; current frame highlighted) and an Objects/heap column
(lists as indexed cells, dicts/objects as `field → value` rows). Pointer values
render as colored dots, and **curved SVG connector arrows** are drawn from each
dot to its target heap object — remeasured from the live DOM on every
step/frames/heap change (via `useLayoutEffect` + `ResizeObserver`) and animated
(arrows draw in, boxes fade). It is **theme-aware**: a `Palette` (see
`makePalette`, supplied through `PaletteCtx` and `useTheme()`) gives a light
Python-Tutor palette in light mode and a dark palette in dark mode.

Extras: shareable links (`?code=<base64>&lang=…`, restored on mount), keyboard
shortcuts (←/→ step, Space auto-play), and a mobile tabbed layout. It does **not**
use Monaco — a lightweight custom editor/display is used to stay consistent with
the rest of the hand-built UI.

## Styling conventions

- Tailwind v4 with theme tokens defined in `src/index.css` under `@theme`
  (`bg-canvas`, `bg-surface`, `text-primary`, `text-text-secondary`,
  `text-text-muted`, `border-border-strong`, `border-border-subtle`, `accent`).
  **Prefer these tokens** over raw colors so light/dark both work.
- Dark mode is class-based (`.dark` on `<html>`); `index.css` contains explicit
  `.dark .<utility>` overrides for the many inline colored utilities used in
  components. If you introduce a new colored utility that must adapt to dark
  mode, add a matching `.dark` override there.
- `bg-primary` is dual-purpose (body text color *and* brand surface); dark mode
  re-pins branded surfaces — see the comment block in `index.css`.
- Fonts: `Inter` (sans) and `Outfit` (display), loaded via Google Fonts in `index.css`.
- AI message markdown is rendered by small in-file helpers (e.g. `RichText` /
  `WeeklyProjectMarkdown` in `InsightsPage.tsx`, `RichText` in `CodeTutorPage.tsx`)
  — `**bold**` + line breaks only. The Groq system prompts deliberately forbid
  `#` headings and code fences.

## Environment variables

Copy `.env.example` → `.env.local`. All `VITE_*` vars are exposed to the browser
(dev/personal-use scaffold). Groups:
- **Firebase:** `VITE_FIREBASE_*` (auth + Firestore)
- **Groq:** `VITE_GROQ_API_KEY`, `VITE_GROQ_STUDYPACK_API_KEY` (AI features)
- **Supabase:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Google APIs (optional):** `VITE_YOUTUBE_API_KEY`, `VITE_GOOGLE_DRIVE_API_KEY`,
  `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CSE_ID`
- **Legacy/unused:** `VITE_GEMINI_API_KEY`

If keys are missing the app still boots; affected features show a config banner
or "not configured" state instead of crashing.

## Gotchas / conventions

- **No URL router** — navigation is `activeTab` state in `Dashboard.tsx`. Don't
  reach for React Router; follow the existing tab pattern.
- **Guest vs. signed-in** — most data paths branch on `user`. When adding
  persistence, handle both the `localStore` (guest) and Firestore (auth) cases,
  mirroring `useSchedule` / `App.tsx` migration logic.
- **Dates** are keyed `YYYY-MM-DD`; use helpers in `src/lib/dates.ts`.
- **Don't commit secrets** — `.env.local` is gitignored; keep it that way.
- **Platform:** development is on Windows (PowerShell + Git Bash both available).
- The repo root contains many `ss_*.png` screenshots and scratch `*.mjs` test
  files; these are not part of the app source.
