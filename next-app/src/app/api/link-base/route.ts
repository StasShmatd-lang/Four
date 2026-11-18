import { json } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const base = `${proto}://${host}`.replace(/\/$/, "");
  return json({ base });
}
