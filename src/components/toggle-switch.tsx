'use client';

import { useTransition } from 'react';
import * as Switch from '@radix-ui/react-switch';

/**
 * Accessible on/off switch used for consent toggles and role toggles alike.
 * The caller owns persistence via `onToggle`; this component only renders
 * and manages pending state.
 */
export function ToggleSwitch({
  id,
  label,
  granted,
  onToggle,
  onLabel = 'Given',
  offLabel = 'Not given',
}: {
  id: string;
  label: string;
  granted: boolean;
  onToggle: (granted: boolean) => void | Promise<void>;
  onLabel?: string;
  offLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const domId = `toggle-${id}`;

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={domId} className="flex-1">
        {label}
      </label>
      <Switch.Root
        id={domId}
        aria-label={label}
        checked={granted}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(() => {
            void onToggle(checked);
          })
        }
        className="relative h-7 w-12 rounded-full bg-slate-500 data-[state=checked]:bg-brand-700 disabled:opacity-60"
      >
        <Switch.Thumb className="block h-6 w-6 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
      <span aria-hidden="true" className="w-14 text-right text-sm text-slate-600 dark:text-slate-400">
        {granted ? onLabel : offLabel}
      </span>
    </div>
  );
}
