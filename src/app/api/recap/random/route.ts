import { NextRequest, NextResponse } from "next/server";
import {
  getRecallItems,
  sample,
  recapAuth,
  renderDigest,
  type RecallItem,
} from "@/lib/recap";

export const dynamic = "force-dynamic";

// GET /api/recap/random?n=3&type=concept|idea
//   N random reviewed items for serendipitous recall.
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

  const params = req.nextUrl.searchParams;
  const n = Math.min(20, Math.max(1, parseInt(params.get("n") || "3", 10) || 3));
  const typeParam = params.get("type");
  const type =
    typeParam === "idea" || typeParam === "concept" ? typeParam : null;

  const items = await getRecallItems();
  const pool = items.filter(
    (i: RecallItem) => i.status === "reviewed" && (!type || i.type === type)
  );
  const picked = sample(pool, n);

  const format = params.get("format");
  if (format === "text" || format === "md") {
    const body = renderDigest(
      "Random recall",
      [{ label: type ? `${type}s` : "Items", items: picked }],
      req.nextUrl.origin,
      format
    );
    return new NextResponse(body, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: picked.length,
    items: picked,
  });
}
