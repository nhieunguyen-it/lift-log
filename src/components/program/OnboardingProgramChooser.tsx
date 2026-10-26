import { BUILT_IN_PROGRAMS } from '@/program/templates';
import { activateProgram } from '@/db/programsRepo';
import { useActiveProgram } from '@/db/programHooks';
import { Button } from '@/components/ui/button';

/** Onboarding step 3: optionally activate a built-in template. */
export default function OnboardingProgramChooser() {
  const active = useActiveProgram();
  return (
    <div className="space-y-2" role="group" aria-label="Choose a program">
      {BUILT_IN_PROGRAMS.map((p) => (
        <Button
          key={p.id}
          variant={active?.id === p.id ? 'default' : 'outline'}
          className="w-full justify-start"
          aria-pressed={active?.id === p.id}
          data-testid={`onboarding-program-${p.id}`}
          onClick={() => void activateProgram(p.id)}
        >
          {p.name}
        </Button>
      ))}
    </div>
  );
}
