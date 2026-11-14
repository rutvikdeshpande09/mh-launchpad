# 🚀 MH Launchpad

**Local businesses, launched by local students.**

Home-based entrepreneurs in Mountain House (bakers, tutors, tailors, notary services) rarely have a website or a printed menu.
MH Launchpad lets high-school **Tech Ambassadors** run a short multilingual interview with an owner and, with AI, instantly
publish:

- a bilingual, interactive **3D website** for the business,
- a flip-able, downloadable **3D digital business card** with a QR code,
- a printable, QR-linked **volunteer service certificate** for the student.

Owners keep control afterward: they can say *"Sold out of chicken tamales this weekend, add Atole for $5"* and the live site updates.

> **Live app:** https://mh-launchpad.vercel.app · **Code:** https://github.com/rutvikdeshpande09/mh-launchpad · **Demo video:** _add your Google Drive link here_

---

## ⚡ Try it in 2 minutes (for judges)

**Business owners choose their own ambassador. Try both sides:**
- *As a student:* go to **Ambassadors → Judge demo access**, then save a public profile (languages and a short bio).
- *As an owner:* open **For businesses → Demo owner access**, enter a business name, pick that ambassador, and send the request.
- *Back as the student:* accept the request and press **Start the interview**. The owner's account is linked automatically, and a private draft site is created for them to approve.

Or explore the finished result first:

1. Open the live app and click the **demo business** (Tamales La Abuela, in English + Spanish). Try the language toggle, tilt the cards, and flip the business card.
2. Go to **Ambassador → "Judge demo access"** (skips the school-email check).
3. Open **Start interview**, choose a language, type short answers (or record your voice), tick the consent box, and press **Generate**. In about 30 seconds you get a private **draft** website and a service certificate; press **Approve & publish** to make it public.
4. Open `/manage/tamales-la-abuela` → **Demo owner access**. Upload a profile photo (watch the card update) and try the AI updater: *"Sold out of chicken tamales this weekend, add Atole for $5."*

The seeded business is a **fictional demo**, so the app works on first boot with no setup.

## 🧭 Routes

| Route | What it does |
|---|---|
| `/` | Landing page and directory of businesses |
| `/ambassador` | Student sign-up (`@lammersvilleusd.net`) with a passcode and a 60-second AI-graded skill check. Then a public profile (languages, bio), the inbox of interview requests, and sign-in on any device. Judge demo toggle included |
| `/owner` | Business-owner sign-up/sign-in by email link: enter your business name, pick the ambassador who will interview you, and track your requests |
| `/interview` | 5-question interview (text or in-browser voice recording in 7 languages) + photo upload → generates the site |
| `/sites/[slug]` | Public 3D business website, bilingual toggle, masked inquiry form |
| `/manage/[slug]` | Owner portal: magic-link login (or demo access), profile photo cropper, live card, colour schemes (presets or custom, auto-adjusted for readability), AI site updater, show/hide the site, private inbox |
| `/certificate/[id]` | Printable service certificate with a verification QR code |

## 🛠 Run it locally

Requires Node 20+.

```bash
git clone https://github.com/rutvikdeshpande09/mh-launchpad.git
cd mh-launchpad
npm install
cp .env.example .env.local     # then add your GEMINI_API_KEY
npm run dev                    # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** (for AI features) | Free at <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | No | Defaults to `gemini-3-flash-preview` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | No | Enables persistence, photo storage and email magic-link login |
| `APP_SECRET` | No (recommended in production) | Signs ambassador tokens |

**Without Supabase** the app still runs end to end. Data is kept in memory and resets when the server restarts, and owner login is demo-only.
**Without a Gemini key** the seeded demo sites still work, but generating or updating sites shows a clear "key not set" error.
(In local dev only, a clearly-marked mock stands in for the AI so the UI can be tested.)

### Optional: set up Supabase (free tier)

1. Create a project at <https://supabase.com>.
2. SQL Editor → paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, row-level-security policies and the `business-assets` storage bucket.
3. Authentication → URL Configuration → add your site URL (and `http://localhost:3000`) to the allowed redirect URLs.
4. Copy the project URL, anon key and service-role key into `.env.local`.

### Deploy to Vercel

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
```

Add the same environment variables in the Vercel dashboard (Project → Settings → Environment Variables).

## 🧱 Tech stack (all free tiers)

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion (3D tilt, flip, parallax) · Google Gemini via `@google/genai`
(multimodal audio transcription + strict JSON-schema output) · Supabase (Postgres, Storage, Auth) · Vercel.

## 🔒 Privacy and safety by design

- **Owners choose, nobody is assigned.** Businesses pick their own ambassador. Ambassadors appear only by first name + last initial, languages and a short bio. The owner's login email is never shown to the ambassador; only the contact detail the owner chooses to share with that one student. Demo and real accounts are kept in separate pools.
- **Drafts and an off switch.** New sites are private drafts until someone with the draft link approves them, and owners can hide their site at any time from the owner portal.
- **Consent first.** The interview can't start without confirming the owner agreed to be interviewed, to AI processing, and to a public page.
- **No private details published.** The AI is told never to output street addresses, phone numbers, emails or children's names; the public area is only "Mountain House, CA".
- **Masked inquiries.** Visitors write through the site; owners read messages only in their private portal. A honeypot field and rate limiting reduce spam.
- **Owner emails** are stored in a separate table with no public access. Students appear publicly only as *First L.*
- **No invented facts.** The AI may only use what the owner said ("Ask for details" when unknown), and all model output is validated against a strict schema and clamped before it is saved or shown.
- **Prompt-injection aware.** Interview text and audio are treated as data, never as instructions.
- **Abuse limits.** Per-IP and per-ambassador rate limits protect the free AI quota; uploads accept only small JPG/PNG/WebP images (no SVG).

## ⚠️ Honest limitations

- The service certificate is **not an official document**. Hours are an estimate and the certificate says it is *pending advisor confirmation*; a supervising adult must confirm them.
- Student email domain is checked by format only (no email verification); ambassadors sign back in with a passcode they set. The judge-demo toggle exists for evaluation.
- AI translations can contain mistakes; owners should have a fluent speaker review their site.
- In-memory mode (no Supabase) loses data on restart, and the in-memory rate limiter is per server instance.
- Demo businesses can be edited by anyone through demo owner access, by design, so judges can try the portal. Real businesses require the owner's email login when Supabase is configured.

## 📁 Project layout

```
src/app/            pages + API routes (grade-skill, generate-site, update-site, upload, inquiry, manage)
src/components/     SiteView, BusinessCard3D, Tilt, AudioRecorder, ManageClient
src/lib/            schemas (zod), gemini helper, store (Supabase/in-memory), auth, seed data
supabase/schema.sql database schema + RLS + storage bucket
```
