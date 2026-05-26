'use client';
import { useState } from 'react';
import { Button, Card, ChoiceCard, ModeChip } from '@/components/ui';
import { previewModeDiff } from '@/lib/periodization';
import type { UserMode } from '@/types';

interface Props {
  current: UserMode;
  onCancel: () => void;
  onConfirm: (mode: UserMode) => void;
}

export function ModeSwitchDialog({ current, onCancel, onConfirm }: Props) {
  const [picked, setPicked] = useState<UserMode>(current);
  const diff = previewModeDiff(current, picked);

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onCancel}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3">
          <div className="section-head">SWITCH MODE</div>
          <div className="text-xs text-ink-dim mt-0.5">Your data is preserved. Switch back anytime.</div>
        </div>

        <div className="px-4 py-3 space-y-2">
          <ChoiceCard value="BASIC" label="BASIC — Just help me work out" description="No jargon. Today's workout, big buttons." selected={picked === 'BASIC'} onSelect={(v) => setPicked(v)} />
          <ChoiceCard value="INTERMEDIATE" label="INTERMEDIATE — Show me I'm progressing" description="Training blocks, simple charts, plain-English recaps." selected={picked === 'INTERMEDIATE'} onSelect={(v) => setPicked(v)} />
          <ChoiceCard value="ADVANCED" label="ADVANCED — Give me the full system" description="RPE/RIR, MEV/MAV/MRV, e1RM, full meso review." selected={picked === 'ADVANCED'} onSelect={(v) => setPicked(v)} />

          {picked !== current && (
            <Card className="mt-2">
              <div className="section-head mb-2">WHAT CHANGES</div>
              {diff.gained.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] tracking-wider2 font-semibold text-ok uppercase">You'll gain</div>
                  <ul className="text-sm text-ink mt-1 list-disc list-inside space-y-0.5">
                    {diff.gained.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </div>
              )}
              {diff.hidden.length > 0 && (
                <div>
                  <div className="text-[10px] tracking-wider2 font-semibold text-ink-mute uppercase">No longer shown</div>
                  <ul className="text-sm text-ink-dim mt-1 list-disc list-inside space-y-0.5">
                    {diff.hidden.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <div className="flex items-center justify-between pt-3 pb-2">
            <span className="text-xs text-ink-dim">Current: <ModeChip mode={current} /></span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button onClick={() => onConfirm(picked)} disabled={picked === current}>Switch</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
