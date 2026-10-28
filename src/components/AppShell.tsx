import { Activity, Dumbbell, History, ListChecks, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import GuideOverlays from '@/components/guide/GuideOverlays';
import ProfileBadge from '@/components/profile/ProfileBadge';
import ProfileSwitcher from '@/components/profile/ProfileSwitcher';
import OnboardingProgramChooser from '@/components/program/OnboardingProgramChooser';

const tabs = [
  { to: '/', label: 'Workout', icon: Dumbbell, end: true },
  { to: '/history', label: 'History', icon: History, end: false },
  { to: '/exercises', label: 'Exercises', icon: ListChecks, end: false },
  { to: '/analyze', label: 'Analyze', icon: Activity, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export default function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <main className="flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
        <header className="mb-3 flex items-center justify-between gap-2">
          <ProfileBadge testId="profile-active-name" />
          <ProfileSwitcher />
        </header>
        <Outlet />
      </main>
      <GuideOverlays programChooser={<OnboardingProgramChooser />} />
      <nav
        aria-label="Primary"
        className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 min-w-11 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="size-6" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
