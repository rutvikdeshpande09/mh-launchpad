import { listPublicAmbassadors } from "@/lib/store";

// Public directory of ambassadors who are accepting requests. Contains first name + last
// initial, languages and a short bio only. Never emails. Judge-demo ambassadors are a
// separate pool, shown only to demo owners (?demo=1).
export async function GET(req: Request) {
  const demo = new URL(req.url).searchParams.get("demo") === "1";
  return Response.json({ ambassadors: await listPublicAmbassadors(demo) });
}
