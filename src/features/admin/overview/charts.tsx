import Link from "next/link";
import styles from "./overview.module.css";

// Small, dependency-free SVG/CSS charts. Every chart repeats its numbers as
// text (legend or row values) so nothing is conveyed by color alone.

export type Segment = { label: string; value: number; color: string };

const numberFormat = new Intl.NumberFormat("pt-BR");
export const formatNumber = (value: number) => numberFormat.format(value);

export function Legend({ segments }: { segments: Segment[] }) {
  return (
    <ul className={styles.legend}>
      {segments.map((segment) => (
        <li key={segment.label}>
          <span
            className={styles.swatch}
            style={{ background: segment.color }}
            aria-hidden="true"
          />
          <span>{segment.label}</span>
          <strong>{formatNumber(segment.value)}</strong>
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  segments,
  centerLabel,
  label,
}: {
  segments: Segment[];
  centerLabel: string;
  label: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className={styles.donutWrap}>
      <svg
        viewBox="0 0 140 140"
        className={styles.donut}
        role="img"
        aria-label={`${label}: ${segments
          .map((segment) => `${segment.label} ${segment.value}`)
          .join(", ")}`}
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#ebe7df"
          strokeWidth="18"
        />
        {total > 0 &&
          segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const circle = (
              <circle
                key={segment.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="18"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += length;
            return circle;
          })}
        <text x="70" y="68" textAnchor="middle" className={styles.donutValue}>
          {formatNumber(total)}
        </text>
        <text x="70" y="86" textAnchor="middle" className={styles.donutLabel}>
          {centerLabel}
        </text>
      </svg>
      <Legend segments={segments} />
    </div>
  );
}

export function SegmentBar({
  segments,
  label,
}: {
  segments: Segment[];
  label: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div>
      <div
        className={styles.segmentBar}
        role="img"
        aria-label={`${label}: ${segments
          .map((segment) => `${segment.label} ${segment.value}`)
          .join(", ")}`}
      >
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.label}
                style={{
                  width: `${(segment.value / total) * 100}%`,
                  background: segment.color,
                }}
              />
            ))}
      </div>
      <Legend segments={segments} />
    </div>
  );
}

export type BarRow = {
  key: string;
  label: string;
  value: number;
  note?: string;
  href?: string;
};

export function BarList({
  rows,
  color = "#c79a2e",
  unit,
}: {
  rows: BarRow[];
  color?: string;
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className={styles.barList}>
      {rows.map((row) => {
        const name = row.href ? (
          <Link href={row.href}>{row.label}</Link>
        ) : (
          <span>{row.label}</span>
        );
        return (
          <li key={row.key}>
            <div className={styles.barTop}>
              {name}
              <strong>
                {formatNumber(row.value)}
                {unit ? ` ${unit}` : ""}
              </strong>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div
                style={{
                  width: `${(row.value / max) * 100}%`,
                  background: color,
                }}
              />
            </div>
            {row.note && <small>{row.note}</small>}
          </li>
        );
      })}
    </ul>
  );
}

export type StackRow = {
  key: string;
  label: string;
  total: number;
  parts: Segment[];
};

export function StackedBars({ rows }: { rows: StackRow[] }) {
  return (
    <ul className={styles.barList}>
      {rows.map((row) => (
        <li key={row.key}>
          <div className={styles.barTop}>
            <span>{row.label}</span>
            <strong>
              {formatNumber(row.total)}{" "}
              {row.total === 1 ? "variação ativa" : "variações ativas"}
            </strong>
          </div>
          <div
            className={styles.segmentBar}
            role="img"
            aria-label={`${row.label}: ${row.parts
              .map((part) => `${part.label} ${part.value}`)
              .join(", ")}`}
          >
            {row.total > 0 &&
              row.parts
                .filter((part) => part.value > 0)
                .map((part) => (
                  <span
                    key={part.label}
                    style={{
                      width: `${(part.value / row.total) * 100}%`,
                      background: part.color,
                    }}
                  />
                ))}
          </div>
          <small>
            {row.parts
              .filter((part) => part.value > 0)
              .map(
                (part) =>
                  `${formatNumber(part.value)} ${part.label.toLowerCase()}`,
              )
              .join(" · ") || "Sem variações"}
          </small>
        </li>
      ))}
    </ul>
  );
}
