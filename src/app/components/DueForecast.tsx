import { formatDate } from "@/lib/time";

const TRACK_PX = 48; // tallest bar

function weekday(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

// How many reviewed ideas come due on each of the next few days — so the load
// a session creates is visible before it lands. One series, one hue: columns
// grow from a shared baseline, values sit on the caps, hover gives the date.
export function DueForecast({
  days,
}: {
  days: Array<{ date: string; count: number }>;
}) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const summary = days
    .map((d) => `${weekday(d.date)} ${d.count}`)
    .join(", ");

  return (
    <section className="forecast-panel">
      <div className="flex items-baseline justify-between">
        <h2 className="label">Coming up</h2>
        <span className="text-xs text-muted font-mono">
          {total} {total === 1 ? "review" : "reviews"} · next {days.length} days
        </span>
      </div>
      <div
        className="forecast"
        role="img"
        aria-label={`Reviews due per day: ${summary}`}
      >
        {days.map((d) => {
          const h = d.count ? Math.max(3, Math.round((d.count / max) * TRACK_PX)) : 0;
          return (
            <div
              key={d.date}
              className="forecast-col"
              title={`${formatDate(d.date)}: ${d.count} due`}
            >
              <div className="forecast-track" style={{ height: TRACK_PX + 16 }}>
                {d.count > 0 && <span className="forecast-value">{d.count}</span>}
                <div className="forecast-bar" style={{ height: h }} />
              </div>
              <span className="forecast-day">{weekday(d.date)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
