import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_RISK, type RiskParams } from "@/lib/risk/params";

function Field({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-label text-subtle">{label}</span>
      <Input
        type="number"
        className="mt-1 h-8"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function RiskPanel({
  params,
  onChange,
  halt,
}: {
  params: RiskParams;
  onChange: (patch: Partial<RiskParams>) => void;
  halt: string | null;
}) {
  const p = { ...DEFAULT_RISK, ...params };
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-label text-subtle">Risk</p>
        <p className="mt-0.5 text-sm">
          {halt ? "Halted" : `${p.riskPct}% · max ${p.maxOpen}`}
        </p>
      </div>
      {halt && <p className="text-xs text-short">{halt}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Risk $"
          value={p.riskUsd}
          min={10}
          max={10000}
          step={10}
          onChange={(riskUsd) => onChange({ riskUsd })}
        />
        <Field
          label="Risk %"
          value={p.riskPct}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(riskPct) => onChange({ riskPct })}
        />
        <Field
          label="Max open"
          value={p.maxOpen}
          min={1}
          max={12}
          step={1}
          onChange={(maxOpen) => onChange({ maxOpen })}
        />
        <Field
          label="Daily loss $"
          value={p.dailyLossUsd}
          min={50}
          max={20000}
          step={50}
          onChange={(dailyLossUsd) => onChange({ dailyLossUsd })}
        />
        <Field
          label="Min conf"
          value={p.confMin}
          min={30}
          max={90}
          step={1}
          onChange={(confMin) => onChange({ confMin })}
        />
        <Field
          label="Target R"
          value={p.rewardR}
          min={1}
          max={4}
          step={0.05}
          onChange={(rewardR) => onChange({ rewardR })}
        />
        <Field
          label="ATR stop"
          value={p.atrStop}
          min={0.8}
          max={4}
          step={0.1}
          onChange={(atrStop) => onChange({ atrStop })}
        />
        <Field
          label="Loss streak"
          value={p.maxLossStreak}
          min={1}
          max={10}
          step={1}
          onChange={(maxLossStreak) => onChange({ maxLossStreak })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={p.requireAlign ? "default" : "outline"}
          size="sm"
          aria-pressed={p.requireAlign}
          onClick={() => onChange({ requireAlign: !p.requireAlign })}
        >
          HTF block vs
        </Button>
        <Button
          variant={p.blockChop ? "default" : "outline"}
          size="sm"
          aria-pressed={p.blockChop}
          onClick={() => onChange({ blockChop: !p.blockChop })}
        >
          Block chop
        </Button>
      </div>
    </div>
  );
}
