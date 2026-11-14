"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import AmbassadorDashboard from "@/components/AmbassadorDashboard";
import { SCENARIO } from "@/lib/content";
import { postJson, saveAmbassador, useAmbassador } from "@/lib/client";

type Step = "details" | "rewrite" | "followup";

interface GradeResult {
  passed: boolean;
  feedback: string;
  token?: string;
  ambassador?: { id: string; name: string; demo: boolean };
}

export default function AmbassadorPage() {
  const { session, ready } = useAmbassador();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function accept(res: GradeResult) {
    if (res.token && res.ambassador) saveAmbassador({ token: res.token, name: res.ambassador.name, demo: res.ambassador.demo });
  }

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      if (msg.includes("already has an ambassador account")) {
        setMode("signin"); // they registered before: send them to sign-in
        setStep("details");
      }
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function getFollowUp() {
    const res = await run(() => postJson<{ question: string }>("/api/grade-skill", { action: "followup", rewrite, email }));
    if (res) {
      setQuestion(res.question);
      setStep("followup");
    }
  }

  async function submitAnswer() {
    const res = await run(() => postJson<GradeResult>("/api/grade-skill", { action: "grade", rewrite, question, answer, name, email, passcode }));
    if (!res) return;
    if (res.passed) accept(res);
    else {
      setFeedback(res.feedback);
      setStep("rewrite"); // let them improve and retry
    }
  }

  async function demoAccess() {
    const res = await run(() => postJson<GradeResult>("/api/grade-skill", { action: "demo", name: name.trim() || undefined }));
    if (res) accept(res);
  }

  async function signIn() {
    const res = await run(() => postJson<GradeResult>("/api/ambassador", { action: "signin", email, passcode }));
    if (res) accept(res);
  }

  if (!ready) return null;
  if (session) return <AmbassadorDashboard session={session} />;

  const wrap = "mx-auto max-w-2xl px-4 py-12";

  return (
    <div className={wrap}>
      <h1 className="text-3xl font-extrabold">Tech Ambassador {mode === "signup" ? "sign-up" : "sign-in"}</h1>
      <p className="mt-2 text-muted">
        {mode === "signup"
          ? "Pass a quick 60-second skill check to unlock interviews. Then set up a public profile so businesses can choose you."
          : "Welcome back. Sign in with your school email and passcode."}
      </p>

      {step === "details" && mode === "signup" && (
        <form
          className="card mt-8 space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setStep("rewrite");
          }}
        >
          <label className="block text-sm font-semibold">
            Your full name
            <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
            <span className="mt-1 block text-xs font-normal text-muted">Only your first name and last initial are shown publicly.</span>
          </label>
          <label className="block text-sm font-semibold">
            School email
            <input
              type="email"
              className="field mt-1"
              placeholder="name@lammersvilleusd.net"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              pattern="[^@\s]+@lammersvilleusd\.net"
              title="Please use your @lammersvilleusd.net email"
            />
          </label>
          <label className="block text-sm font-semibold">
            Create a passcode
            <input type="password" className="field mt-1" value={passcode} onChange={(e) => setPasscode(e.target.value)} required minLength={6} maxLength={64} autoComplete="new-password" />
            <span className="mt-1 block text-xs font-normal text-muted">At least 6 characters. You&apos;ll use it with your email to sign back in on any device.</span>
          </label>
          <button type="submit" className="btn btn-primary w-full">Continue to the skill check</button>
          <p className="text-center text-sm">
            Already registered?{" "}
            <button type="button" className="font-semibold text-brand underline" onClick={() => { setMode("signin"); setError(""); }}>
              Sign in
            </button>
          </p>
          <div className="border-t border-line pt-4 text-center">
            <p className="text-sm text-muted">Judging or just exploring?</p>
            <button type="button" className="btn btn-ghost mt-2" onClick={demoAccess} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : "🎟️"} Judge demo access
            </button>
          </div>
        </form>
      )}

      {mode === "signin" && (
        <form
          className="card mt-8 space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            signIn();
          }}
        >
          <label className="block text-sm font-semibold">
            School email
            <input type="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-sm font-semibold">
            Passcode
            <input type="password" className="field mt-1" value={passcode} onChange={(e) => setPasscode(e.target.value)} required autoComplete="current-password" />
          </label>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Sign in
          </button>
          <p className="text-center text-sm">
            New here?{" "}
            <button type="button" className="font-semibold text-brand underline" onClick={() => { setMode("signup"); setError(""); }}>
              Create an ambassador account
            </button>
          </p>
        </form>
      )}

      {mode === "signup" && (step === "rewrite" || step === "followup") && (
        <div className="card mt-8 space-y-4 p-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-brand">Challenge 1 of 2</p>
            <p className="mt-2 text-sm">A home baker sent you this note. Rewrite it as 2–3 clear, friendly, professional sentences for a website:</p>
            <blockquote className="mt-2 rounded-lg bg-amber-50 p-3 text-sm italic">“{SCENARIO}”</blockquote>
          </div>
          {feedback && step === "rewrite" && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              Not quite yet: {feedback} Improve your rewrite and try again.
            </p>
          )}
          <textarea
            className="field"
            rows={4}
            value={rewrite}
            onChange={(e) => setRewrite(e.target.value)}
            disabled={step === "followup"}
            placeholder="Write your version here…"
            maxLength={1200}
          />
          {step === "rewrite" && (
            <button type="button" className="btn btn-primary" disabled={busy || rewrite.trim().length < 30} onClick={getFollowUp}>
              {busy && <Loader2 className="animate-spin" size={16} />} Next
            </button>
          )}

          {step === "followup" && (
            <div className="space-y-3 border-t border-line pt-4">
              <p className="text-sm font-bold uppercase tracking-widest text-brand">Challenge 2 of 2</p>
              <p className="font-semibold">{question}</p>
              <textarea className="field" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer in one sentence…" maxLength={800} />
              <button type="button" className="btn btn-primary" disabled={busy || answer.trim().length < 8} onClick={submitAnswer}>
                {busy && <Loader2 className="animate-spin" size={16} />} Submit for grading
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
