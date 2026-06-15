import { Chip } from "@/components/primitives/Chip";

interface Metric {
  value: string;
  label: string;
}

const METRICS: Metric[] = [
  { value: "~3000", label: "tok/s" },
  { value: "<400ms", label: "first text" },
  { value: "0ms", label: "cloud storage" },
];

/**
 * Row of live metric chips under the hero terminal. Real numbers, mono font,
 * one accent to keep hierarchy from color. Static — the "live" feel comes from
 * the terminal above, not jittery counters here.
 */
export function MetricChips() {
  return (
    <dl className="flex flex-wrap items-center gap-2">
      {METRICS.map((m) => (
        <Chip key={m.label} accent>
          <span className="font-semibold">{m.value}</span>
          <span className="text-muted">{m.label}</span>
        </Chip>
      ))}
    </dl>
  );
}
