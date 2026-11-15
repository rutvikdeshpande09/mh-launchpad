#!/usr/bin/env node
// Smoke test for MH Launchpad. No dependencies (Node 18+).
//
//   npm run smoke                              # checks http://localhost:3000 (start `npm run dev` first)
//   npm run smoke -- https://mh-launchpad.vercel.app
//   npm run smoke -- http://localhost:3000 --ai   # also runs the full AI flow (needs GEMINI_API_KEY on the server)
//
// Without --ai it only reads pages and probes access rules, so it is free and safe to run anywhere.
// With --ai it creates a clearly-labelled DEMO site through judge demo access.

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const WITH_AI = args.includes("--ai");

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : `  (${detail})`}`);
};

async function call(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, text, json };
}

console.log(`Smoke testing ${BASE}${WITH_AI ? " (with AI flow)" : ""}\n`);

// ---------- pages ----------
for (const page of ["/", "/ambassador", "/owner", "/interview", "/creations", "/organizer"]) {
  const r = await call(page);
  check(`page ${page} loads`, r.status === 200, `HTTP ${r.status}`);
}
const home = await call("/");
check("landing page shows the pilot strip", home.text.includes("Our pilot in Mountain House"));
check("unknown site returns 404", (await call("/sites/this-site-does-not-exist")).status === 404);

// ---------- access rules: everything private must refuse anonymous callers ----------
const guarded = [
  ["GET", "/api/organizer"],
  ["GET", "/api/creations"],
  ["GET", "/api/ambassador"],
  ["GET", "/api/owner/requests"],
  ["GET", "/api/site?slug=nope"],
  ["GET", "/api/manage?slug=nope"],
];
for (const [method, path] of guarded) {
  const r = await call(path, { method });
  check(`${method} ${path} refuses anonymous callers`, r.status === 401 || r.status === 404, `HTTP ${r.status}`);
}
check("POST /api/publish refuses anonymous callers", [401, 404].includes((await call("/api/publish", { method: "POST", body: { slug: "nope", published: true } })).status));
check("POST /api/upload refuses anonymous callers", (await call("/api/upload", { method: "POST", body: { dataUrl: "x" } })).status === 401);
check("a forged ambassador token is rejected", (await call("/api/ambassador", { headers: { "x-ambassador-token": "forged.token" } })).status === 401);

// ---------- public directory never leaks contact details ----------
const dir = await call("/api/ambassadors");
check("ambassador directory returns a list", Array.isArray(dir.json?.ambassadors));
check("ambassador directory exposes no emails", !/"email"/.test(dir.text) && !/@/.test(dir.text));

// ---------- optional: full flow with real AI ----------
if (WITH_AI) {
  console.log("\nAI flow (creates a demo site):");
  const demo = await call("/api/grade-skill", { method: "POST", body: { action: "demo" } });
  const token = demo.json?.token;
  check("judge demo ambassador created", Boolean(token));
  if (token) {
    const AH = { "x-ambassador-token": token };
    const OH = { "x-demo-owner": "1" };
    check("profile saved", (await call("/api/ambassador", { method: "POST", headers: AH, body: { action: "profile", languages: ["en", "es"], bio: "Smoke test", accepting: true } })).status === 200);
    const pool = (await call("/api/ambassadors?demo=1")).json?.ambassadors ?? [];
    const me = pool.find((a) => a.bio === "Smoke test");
    check("demo ambassador is listed to demo owners only", Boolean(me) && !((await call("/api/ambassadors")).text.includes("Smoke test")));
    const reqRes = await call("/api/owner/requests", { method: "POST", headers: OH, body: { businessName: "Smoke Test Bakery", ownerLanguage: "en", note: "", contact: "", ambassadorId: me?.id ?? "x" } });
    const requestId = reqRes.json?.request?.id;
    check("demo owner sends an interview request", reqRes.status === 200 && Boolean(requestId), `HTTP ${reqRes.status}`);
    check("owner's email is not visible to the ambassador", !JSON.stringify((await call("/api/ambassador", { headers: AH })).json).includes("demo-owner@"));
    check("ambassador accepts", (await call("/api/ambassador", { method: "POST", headers: AH, body: { action: "respond", requestId, decision: "accept" } })).status === 200);
    const answers = ["Smoke Test Bakery, we bake cakes", "Started in my kitchen", "Cakes $20", "Weekends in Mountain House", "Fresh and local"].map((text) => ({ text }));
    const gen = await call("/api/generate-site", { method: "POST", body: { token, language: "en", altLanguage: "es", consent: true, photos: [], answers, requestId, customRequest: "Keep it short and friendly." } });
    check("AI generates a site from the interview", gen.status === 200 && Boolean(gen.json?.slug), `HTTP ${gen.status} ${gen.json?.error ?? ""}`);
    if (gen.json?.slug) {
      const { slug, draftToken } = gen.json;
      check("new site is a private draft (404 to the public)", (await call(`/sites/${slug}`)).status === 404);
      check("draft opens with the private link", (await call(`/sites/${slug}?preview=${draftToken}`)).status === 200);
      check("draft link can publish it", (await call("/api/publish", { method: "POST", headers: { "x-draft-token": draftToken }, body: { slug, published: true } })).status === 200);
      check("published site is public", (await call(`/sites/${slug}`)).status === 200);
      const bad = await call("/api/site", { method: "POST", headers: OH, body: { slug, content: { ...(await call(`/api/site?slug=${slug}`, { headers: OH })).json?.content, about: { en: "Call 209-555-0100", alt: "x" } } } });
      check("manual edits cannot publish a phone number", bad.status === 400, `HTTP ${bad.status}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
