"use client";

import { useState } from "react";
import Link from "next/link";
import { CaptainShell, CaptainCard } from "@/components/ng/captain/captain-shell";

const STEPS = [
  { n: 1, label: "Scan lot" },
  { n: 2, label: "Weigh & photo" },
  { n: 3, label: "Sensory" },
  { n: 4, label: "Sign-off" },
];

export default function CaptainIntake() {
  const [step, setStep] = useState(2);

  return (
    <CaptainShell active="/captain/intake" title="Receive lot" subtitle="PK-2026-218 · Anantapur · K. Subbaiah">
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <div className={`size-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
              step >= s.n ? "bg-ng-forest-deep text-ng-cream" : "bg-ng-line-soft text-ng-ink-soft"
            }`}>
              {step > s.n ? "✓" : s.n}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${step > s.n ? "bg-ng-forest" : "bg-ng-line-soft"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mb-4">Step {step} of 4 · {STEPS[step - 1]?.label}</div>

      {/* Step 2 content shown */}
      {step === 1 && (
        <CaptainCard tone="sage">
          <div className="text-center py-8">
            <div className="size-20 rounded-full bg-ng-cream mx-auto flex items-center justify-center text-[40px]">▢</div>
            <h2 className="font-display text-[20px] text-ng-forest-deep mt-5">Point camera at lot QR</h2>
            <p className="text-[12.5px] text-ng-ink-muted mt-2 max-w-xs mx-auto">QR sticker is on the lot card on top of every drum</p>
            <button onClick={() => setStep(2)} className="mt-7 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-6 py-2.5 text-[13px]">
              Simulate scan ANT-24-052
            </button>
          </div>
        </CaptainCard>
      )}

      {step === 2 && (
        <>
          <CaptainCard className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft">Scanned lot</div>
            <div className="font-mono text-[15px] text-ng-forest-deep mt-1">ANT-24-052 · Groundnut · cold-press grade</div>
            <div className="text-[12px] text-ng-ink-muted mt-2">Expected: 1,500 kg · 30 drums of 50kg each</div>
          </CaptainCard>

          <h3 className="font-display text-[14px] text-ng-forest-deep mb-2 mt-2">Actual weight</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              defaultValue={1488}
              className="flex-1 rounded-2xl bg-ng-paper border border-ng-line-soft px-4 py-3 text-[18px] font-display text-ng-forest-deep outline-none focus:border-ng-forest"
            />
            <span className="px-4 py-3 rounded-2xl bg-ng-cream border border-ng-line-soft text-[13px] text-ng-ink-muted self-stretch flex items-center">kg</span>
          </div>
          <div className="text-[11.5px] text-ng-terracotta mb-5">
            Variance: −12 kg (−0.8%). Within tolerance (±2%). Note: 1 drum was 48kg, others 49.2–50.4kg.
          </div>

          <h3 className="font-display text-[14px] text-ng-forest-deep mb-2">Photos</h3>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="aspect-square rounded-2xl bg-ng-sage/40 border-2 border-dashed border-ng-line flex items-center justify-center text-[24px] text-ng-forest">+</div>
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-ng-forest to-ng-leaf relative overflow-hidden">
              <div className="absolute bottom-1 left-2 text-ng-cream text-[10px]">Top of drum</div>
            </div>
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-ng-clay to-ng-terracotta relative overflow-hidden">
              <div className="absolute bottom-1 left-2 text-ng-cream text-[10px]">Seal intact</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => setStep(1)} className="rounded-2xl bg-ng-paper border border-ng-line-soft text-ng-ink py-3 text-[14px] font-semibold">← Back</button>
            <button onClick={() => setStep(3)} className="rounded-2xl bg-ng-forest-deep text-ng-cream py-3 text-[14px] font-semibold">Sensory →</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <CaptainCard className="mb-4">
            <h3 className="font-display text-[15px] text-ng-forest-deep">Quick sensory check</h3>
            <p className="text-[12px] text-ng-ink-muted mt-1">Tap each that applies. Doesn't replace lab — first-line only.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {["Smell normal", "No off-color", "No moisture clumps", "Visible foreign matter", "Insect damage", "Discolored grains"].map((c, i) => (
                <button key={c} className={`text-[12.5px] py-2.5 rounded-xl border-2 transition-colors ${
                  i < 3 ? "bg-ng-success/10 border-ng-success/40 text-ng-success" : "bg-ng-paper border-ng-line-soft text-ng-ink-muted"
                }`}>{i < 3 ? "✓ " : ""}{c}</button>
              ))}
            </div>
          </CaptainCard>

          <CaptainCard tone="clay" className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-ng-forest-deep">Notes for QC lab</div>
            <textarea
              className="w-full mt-2 rounded-xl bg-ng-cream/80 border border-ng-clay/40 px-3 py-2.5 text-[13px] outline-none min-h-[80px]"
              defaultValue="One drum slightly underweight — checked seal, intact. Recommend re-weigh at facility."
            />
          </CaptainCard>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button onClick={() => setStep(2)} className="rounded-2xl bg-ng-paper border border-ng-line-soft text-ng-ink py-3 text-[14px] font-semibold">← Back</button>
            <button onClick={() => setStep(4)} className="rounded-2xl bg-ng-forest-deep text-ng-cream py-3 text-[14px] font-semibold">Sign-off →</button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <CaptainCard tone="sage" className="mb-4">
            <h3 className="font-display text-[18px] text-ng-forest-deep">Farmer sign-off</h3>
            <dl className="mt-4 space-y-2 text-[13px]">
              <Row label="Lot" value="ANT-24-052" />
              <Row label="Expected" value="1,500 kg" />
              <Row label="Received" value="1,488 kg" />
              <Row label="Rate" value="₹125 / kg" />
              <Row label="Payable" value="₹1,86,000" emphasis />
            </dl>
          </CaptainCard>

          <CaptainCard className="mb-4">
            <div className="text-[12px] text-ng-ink-muted">Signed by K. Subbaiah</div>
            <div className="mt-3 h-32 rounded-xl bg-ng-cream border-2 border-dashed border-ng-line flex items-center justify-center">
              <div className="font-display text-[28px] text-ng-forest-deep italic">K. Subbaiah</div>
            </div>
            <div className="text-[11px] text-ng-ink-soft mt-2 font-mono">Captured 19 May 2026 · 14:42 IST · GPS verified</div>
          </CaptainCard>

          <Link href="/captain" className="block rounded-2xl bg-ng-forest-deep text-ng-cream text-center py-4 text-[15px] font-semibold mt-6">
            ✓ Confirm & submit to HQ
          </Link>
        </>
      )}
    </CaptainShell>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-ng-line-soft last:border-0">
      <dt className="text-ng-ink-soft">{label}</dt>
      <dd className={emphasis ? "font-display text-[18px] text-ng-forest-deep" : "text-ng-ink"}>{value}</dd>
    </div>
  );
}
