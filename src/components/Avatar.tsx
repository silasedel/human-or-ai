import type { LucideIcon } from "lucide-react";
import {
  Anchor, Bike, Bird, Camera, Cat, Cherry, Cloud, Coffee, Cookie, Crown, Dices, Dog, Droplet, Eye, Fish,
  Flame, Flower2, Gamepad2, Gem, Ghost, Guitar, Headphones, Heart, Leaf, Lightbulb, Moon, Mountain, Music,
  Pizza, Plane, Rabbit, Rocket, Sailboat, Skull, Smile, Snowflake, Star, Sun, Trophy, Turtle, Umbrella, Zap,
} from "lucide-react";
import { avatarColors, fallbackAvatar, parseAvatar, type AvatarIconId, type AvatarSpec } from "@/lib/avatar-icons";
import { cn } from "@/lib/utils";

export const AVATAR_ICON_COMPONENTS: Record<AvatarIconId, LucideIcon> = {
  star: Star, zap: Zap, heart: Heart, leaf: Leaf, moon: Moon, sun: Sun, cloud: Cloud, droplet: Droplet,
  flame: Flame, gem: Gem, ghost: Ghost, cat: Cat, dog: Dog, bird: Bird, fish: Fish, rabbit: Rabbit,
  turtle: Turtle, rocket: Rocket, music: Music, headphones: Headphones, guitar: Guitar, coffee: Coffee,
  pizza: Pizza, cookie: Cookie, cherry: Cherry, smile: Smile, eye: Eye, lightbulb: Lightbulb,
  umbrella: Umbrella, anchor: Anchor, gamepad: Gamepad2, bike: Bike, camera: Camera, flower: Flower2,
  mountain: Mountain, snowflake: Snowflake, skull: Skull, crown: Crown, trophy: Trophy, dices: Dices,
  plane: Plane, sailboat: Sailboat,
};

/** Renders an icon avatar from a spec. */
export function IconAvatar({ spec, size = 44, className }: { spec: AvatarSpec; size?: number; className?: string }) {
  const Icon = AVATAR_ICON_COMPONENTS[spec.icon];
  const { bg, fg } = avatarColors(spec);
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full", className)}
      style={{ width: size, height: size, background: bg, color: fg }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.52)} strokeWidth={2.25} color={fg} />
    </span>
  );
}

interface AvatarProps {
  /** Stored avatar code (or a legacy image URL). */
  src: string | null | undefined;
  /** Used to derive a stable fallback avatar when no code is stored. */
  name: string;
  size?: number;
  className?: string;
}

/** Circular avatar for any account. Always renders something; never blank. */
export function Avatar({ src, name, size = 44, className }: AvatarProps) {
  const spec = parseAvatar(src);
  if (spec) return <IconAvatar spec={spec} size={size} className={className} />;

  if (src && /^https?:\/\//.test(src)) {
    return (
      <span className={cn("inline-block shrink-0 overflow-hidden rounded-full bg-bg-subtle", className)} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" loading="lazy" draggable={false} />
      </span>
    );
  }

  return <IconAvatar spec={fallbackAvatar(name)} size={size} className={className} />;
}
