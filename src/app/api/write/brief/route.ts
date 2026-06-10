import { NextRequest, NextResponse } from "next/server";
import { recapAuth } from "@/lib/recap";
import { getWritingBrief, renderBriefMarkdown } from "@/lib/write";

export const dynamic = "force-dynamic";

// GET /api/write/brief?concept=<slug>
//   A writing brief for one concept: definition, tension, prompt, and every
//   reviewed idea (insight + source quote). Pipe it to an LLM or write from it.
//   Auth: Authorization: Bearer <RECAP_TOKEN>  (or ?token=<RECAP_TOKEN>)
//   ?format=json (default) | md | text
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

  const slug = req.nextUrl.searchParams.get("concept");
  if (!slug) {
    return NextResponse.json(
      { error: "Missing ?concept=<slug>" },
      { status: 400 }
    );
  }

  const brief = await getWritingBrief(slug);
  if (!brief) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const format = req.nextUrl.searchParams.get("format");
  if (format === "md" || format === "text") {
    return new NextResponse(renderBriefMarkdown(brief), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json(brief);
}
