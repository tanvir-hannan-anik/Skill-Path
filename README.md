# SkillPath

A personalized AI-powered learning tracker and curriculum management platform.

Built with **React 19 + TypeScript + Vite + Tailwind CSS**, backed by **Firebase Auth + Firestore**, with a **Google Gemini** AI tutor.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
#   Fill in Firebase keys (Console → Project Settings → Web app config)
#   Fill in Gemini API key (https://aistudio.google.com/app/apikey)

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> If env vars are missing the app still boots, but you'll see a banner warning that auth/persistence are disabled. The AI tab will say "Offline — API key missing".

---

## Firebase setup (one-time)

1. Create a project at <https://console.firebase.google.com>.
2. Enable **Authentication → Email/Password** and **Google** sign-in methods.
3. Enable **Cloud Firestore** in production mode.
4. Copy the **Firestore security rules** below into the Rules tab and publish.
5. Project Settings → "Your apps" → add a Web app → copy the config into `.env.local`.

### Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Every doc lives under /users/{uid}/...
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This enforces that every user can only read and write their own data.

---

## Data model

All data is namespaced per-user under `users/{uid}`:

| Path | Shape | Purpose |
|------|-------|---------|
| `users/{uid}` | `{ skill, level, hoursPerDay, updatedAt }` | User profile |
| `users/{uid}/data/schedule` | `{ days: { "YYYY-MM-DD": DayContent } }` | All scheduled learning content per day |
| `users/{uid}/chat/{messageId}` | `{ role, text, createdAt }` | AI assistant chat history |

`DayContent` holds `videos[]`, `docs[]`, `tasks[]`, and an editable `topicTitle`.

---

## Architecture notes

- **State**: `useSchedule` subscribes to Firestore in real time and pipes writes back through a 400 ms debounce so the topic-title input feels instant without hammering the DB.
- **Auth**: `AuthContext` exposes `signIn / signUp / signInWithGoogle / resetPassword / logout` and an auth-loading state. App routes are gated on `user`.
- **Toasts**: `useToast()` is available app-wide via `ToastProvider`.
- **Code-splitting**: `InsightsPage` and `CalendarView` lazy-load through `React.lazy` to keep the initial bundle small.
- **Reusable primitives**: shared loaders and skeletons in `src/components/ui/`.

---

## Security — Gemini API key

This Phase 1 scaffold uses `VITE_GEMINI_API_KEY`, which **ships to the browser**. That is fine for development and personal use, but if you deploy publicly the key is exposed and can be stolen.

**Production migration path:**

1. Move `src/lib/gemini.ts` behind a **Firebase Cloud Function** (or any backend you host).
2. Replace `streamChatReply` with a `fetch('/api/chat', ...)` call that streams the response back.
3. Read `GEMINI_API_KEY` (no `VITE_` prefix) from the server's environment only.
4. Delete `VITE_GEMINI_API_KEY` from `.env.local` and `.env.example`.

The streaming contract in `src/components/InsightsPage.tsx` is provider-agnostic — only the transport changes.

---

## Scripts

- `npm run dev` — Vite dev server on port 3000
- `npm run build` — production bundle to `dist/`
- `npm run preview` — preview the production bundle
- `npm run lint` — TypeScript type-check (`tsc --noEmit`)
