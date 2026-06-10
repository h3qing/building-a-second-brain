import { NextRequest, NextResponse } from "next/server";
import { recapAuth, sample } from "@/lib/recap";
import { getTensions } from "@/lib/tensions";

export const dynamic = "force-dynamic";

// GET /api/recap/tensions?n=3
//   Concepts where your sources disagree — for a "pick a side this week" prompt.
//   Auth: Authorization: Bearer <RECAP_TOKEN>  (or ?token=<RECAP_TOKEN>)
//   ?n=N selects N at random (omit for all). ?format=json (default) | text | md
export async function GET(req: NextRequest) {
  const auth = recapAuth(
    req.headers.get("authorization"),
    req.nextUrl.searchParams.get("token")
  );
  if (auth === "unconfigured") {
    return NextResponse.json(
      { error: "RECAP_TOKEN is not configured on the server" },
      { status: 503 }
    );
  }
  if (auth === "denied") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const all = await getTensions();
  const nRaw = params.get("n");
  const picked = nRaw
    ? sample(all, Math.min(20, Math.max(1, parseInt(nRaw, 10) || 3)))
    : all;

  const format = params.get("format");
  if (format === "text" || format === "md") {
    const md = format === "md";
    const origin = req.nextUrl.origin;
    const lines: string[] = [md ? "# Tensions" : "TENSIONS", ""];
    for (const t of picked) {
      lines.push(md ? `## ${t.concept}` : `${t.concept}:`);
      lines.push(t.text);
      lines.push(`${origin}${t.url}`, "");
    }
    if (lines.at(-1) === "") lines.pop();
    return new NextResponse(lines.join("\n") + "\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: picked.length,
    tensions: picked,
  });
}
