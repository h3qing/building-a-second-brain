import { getReviewStats, type HeatmapCell } from "@/lib/review-stats";

const CELL_SIZE = 10;
const CELL_GAP = 2;
const WEEK_GAP = 2;
const WEEKS = 52;
const DAYS = 7;

// Opacity by intensity level (0 = empty, 4 = hottest).
const LEVEL_OPACITY = [0.06, 0.3, 0.55, 0.8, 1] as const;

function monthLabelColumns(
  weeks: HeatmapCell[][]
): Array<{ x: number; label: string }> {
  const labels: Array<{ x: number; label: string }> = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const firstDay = weeks[w][0];
    const monthIdx = parseInt(firstDay.date.slice(5, 7), 10) - 1;
    if (monthIdx !== lastMonth) {
      const x = w * (CELL_SIZE + WEEK_GAP);
      const label = new Date(firstDay.date + "T00:00:00Z").toLocaleString(
        "en-US",
        { month: "short", timeZone: "UTC" }
      );
      if (labels.length === 0 || x - labels[labels.length - 1].x >= 30) {
        labels.push({ x, label });
      }
      lastMonth = monthIdx;
    }
  }
  return labels;
}

export async function ReviewStats() {
  const stats = await getReviewStats();
  const { heatmap, streak, totalUnique, approves, contests, reviewsThisWeek } =
    stats;

  const gridWidth = WEEKS * (CELL_SIZE + WEEK_GAP) - WEEK_GAP;
  const gridHeight = DAYS * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const svgHeight = gridHeight + 16; // room for month labels
  const months = monthLabelColumns(heatmap.weeks);

  return (
    <section
      className="space-y-4"
      style={{
        border: "1px solid var(--ink-border)",
        borderRadius: "8px",
        padding: "1.25rem 1.25rem 1rem",
        background:
          "color-mix(in srgb, var(--ink-accent) 3%, var(--ink-paper))",
      }}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="label">Review Activity</h2>
        <span className="text-xs text-muted font-mono">
          last 52 weeks · unique ideas/day
        </span>
      </div>

      <div className="flex flex-wrap items-baseline" style={{ gap: "2rem" }}>
        <div>
          <div
            className="font-heading leading-none"
            style={{ fontSize: "2.25rem", color: "var(--ink-accent)" }}
          >
            {streak.current}
          </div>
          <div className="label mt-1.5">day streak</div>
        </div>
        <div>
          <div
            className="font-heading leading-none"
            style={{ fontSize: "1.5rem" }}
          >
            {streak.longest}
          </div>
          <div className="label mt-1.5">longest</div>
        </div>
        <div>
          <div
            className="font-heading leading-none"
            style={{ fontSize: "1.5rem" }}
          >
            {reviewsThisWeek}
          </div>
          <div className="label mt-1.5">this week</div>
        </div>
        <div>
          <div
            className="font-heading leading-none"
            style={{ fontSize: "1.5rem" }}
          >
            {totalUnique}
          </div>
          <div className="label mt-1.5">ideas · 52 wk</div>
        </div>
      </div>

      <div style={{ overflowX: "auto", paddingTop: "0.25rem" }}>
        <svg
          width={gridWidth}
          height={svgHeight}
          style={{ display: "block" }}
          role="img"
          aria-label="Review activity heatmap"
        >
          {months.map((m) => (
            <text
              key={`${m.x}-${m.label}`}
              x={m.x}
              y={10}
              fontSize="9"
              fontFamily="var(--font-mono)"
              fill="var(--ink-muted)"
            >
              {m.label}
            </text>
          ))}
          <g transform="translate(0, 16)">
            {heatmap.weeks.map((week, w) =>
              week.map((cell, d) => {
                const x = w * (CELL_SIZE + WEEK_GAP);
                const y = d * (CELL_SIZE + CELL_GAP);
                return (
                  <rect
                    key={`${w}-${d}`}
                    x={x}
                    y={y}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={2}
                    ry={2}
                    fill="var(--ink-accent)"
                    fillOpacity={LEVEL_OPACITY[cell.level]}
                  >
                    <title>
                      {cell.date}: {cell.count}{" "}
                      {cell.count === 1 ? "idea" : "ideas"}
                    </title>
                  </rect>
                );
              })
            )}
          </g>
        </svg>
      </div>

      <div
        className="flex items-center justify-between"
        style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}
      >
        <span>
          {approves} approved · {contests} contested
        </span>
        <span
          className="flex items-center"
          style={{ gap: "0.4rem", fontFamily: "var(--font-mono)" }}
        >
          less
          {LEVEL_OPACITY.map((op, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: 2,
                background: "var(--ink-accent)",
                opacity: op,
              }}
            />
          ))}
          more
        </span>
      </div>
    </section>
  );
}
