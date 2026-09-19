"use client";

import { ArrowLeftRight } from "lucide-react";
import {
  AVATAR_ICON_IDS,
  AVATAR_PALETTES,
  AVATAR_PALETTE_IDS,
  avatarColors,
  type AvatarSpec,
} from "@/lib/avatar-icons";
import { AVATAR_ICON_COMPONENTS, IconAvatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  value: AvatarSpec;
  onChange: (next: AvatarSpec) => void;
}

/** Pick an icon, a two-color palette, and optionally swap the colors. */
export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const colors = avatarColors(value);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <IconAvatar spec={value} size={88} className="ring-4 ring-bg-subtle" />
        <div className="text-sm text-fg-muted">
          <p className="font-medium text-fg">Your avatar is an icon and two colors.</p>
          <p className="mt-0.5">Everyone here has one, people and machines alike. No photos, so nothing gives you away.</p>
          <button
            type="button"
            onClick={() => onChange({ ...value, inverted: !value.inverted })}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-fg hover:bg-bg-subtle"
          >
            <ArrowLeftRight size={13} /> Swap colors
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">Icon</div>
        <div className="grid grid-cols-7 gap-2 sm:grid-cols-9 md:grid-cols-10">
          {AVATAR_ICON_IDS.map((icon) => {
            const Icon = AVATAR_ICON_COMPONENTS[icon];
            const selected = icon === value.icon;
            return (
              <button
                key={icon}
                type="button"
                onClick={() => onChange({ ...value, icon })}
                aria-label={icon}
                aria-pressed={selected}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-full border transition-colors",
                  selected ? "border-transparent ring-2 ring-accent" : "border-border hover:bg-bg-subtle",
                )}
                style={selected ? { background: colors.bg, color: colors.fg } : undefined}
              >
                <Icon size={20} strokeWidth={2.25} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">Colors</div>
        <div className="flex flex-wrap gap-2">
          {AVATAR_PALETTE_IDS.map((palette) => {
            const p = AVATAR_PALETTES[palette];
            const swatch = value.inverted ? { bg: p.fg, fg: p.bg } : { bg: p.bg, fg: p.fg };
            const selected = palette === value.palette;
            return (
              <button
                key={palette}
                type="button"
                onClick={() => onChange({ ...value, palette })}
                aria-label={p.label}
                aria-pressed={selected}
                title={p.label}
                className={cn(
                  "relative h-9 w-9 overflow-hidden rounded-full border border-border transition-transform hover:scale-105",
                  selected && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
                )}
                style={{ background: swatch.bg }}
              >
                <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: swatch.fg }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
