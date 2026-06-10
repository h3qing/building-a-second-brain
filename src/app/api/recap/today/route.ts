import { NextRequest, NextResponse } from "next/server";
import {
  getRecallItems,
  dueItems,
  sample,
  recapAuth,
  renderDigest,
} from "@/lib/recap";

export const dynamic = "force-dynamic";

// GET /api/recap/today
//   Today's recall set: items due for spaced-repetition review + a couple of
//   random reviewed concepts to rediscover. Plug into a cron/email/Slack/CLI.
//   Auth: Authorization: Bearer <RECAP_TOKEN>  (or ?token=<RECAP_TOKEN>)
//   ?format=json (default) | text | md
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

  const items = await getRecallItems();
  const today = new Date().toISOString().split("T")[0];
  const due = dueItems(items, today);

  // Rediscover: reviewed items you've internalized but that aren't due today.
  // Prefer concepts (the synthesis layer); fall back to any reviewed item so
  // this is never empty when there's something to resurface.
  const reviewed = items.filter((i) => i.status === "reviewed");
  const dueUrls = new Set(due.map((i) => i.url));
  const notDue = reviewed.filter((i) => !dueUrls.has(i.url));
  const concepts = notDue.filter((i) => i.type === "concept");
  const pool = concepts.length ? concepts : notDue.length ? notDue : reviewed;
  const discover = sample(pool, 2);

  const format = req.nextUrl.searchParams.get("format");
  if (format === "text" || format === "md") {
    const body = renderDigest(
      `Recall — ${today}`,
      [
        { label: "Due for review", items: due },
        { label: "Rediscover", items: discover },
      ],
      req.nextUrl.origin,
      format
    );
    return new NextResponse(body, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    date: today,
    dueCount: due.length,
    due,
    discover,
  });
}
