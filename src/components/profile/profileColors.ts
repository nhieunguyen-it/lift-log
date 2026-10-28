import { PROFILES, type ProfileColor } from '@/config/profiles';

/** Avatar classes per colour token (full literals so Tailwind can see them). */
const AVATAR_CLASSES: Record<ProfileColor, string> = {
  blue: 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
  green: 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  rose: 'bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100',
  violet: 'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100',
  teal: 'bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100',
};

export function avatarClass(color: ProfileColor | undefined): string {
  return AVATAR_CLASSES[color ?? PROFILES.colors[0]];
}

export function initialsOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

export function formatLastUsed(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
