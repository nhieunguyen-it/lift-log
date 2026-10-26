import { Copy, Plus } from 'lucide-react';
import HelpButton from '@/components/guide/HelpButton';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProgramEditor from '@/components/program/ProgramEditor';
import { useActiveProgram, usePrograms } from '@/db/programHooks';
import * as programsRepo from '@/db/programsRepo';
import type { Program } from '@/program/types';

export default function ProgramsPage() {
  const { id } = useParams();
  return id ? <ProgramDetail id={id} /> : <ProgramList />;
}

function ProgramDetail({ id }: { id: string }) {
  return (
    <section className="space-y-4" data-testid="program-detail">
      <div>
        <Link
          to="/programs"
          className="text-primary inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
        >
          All programs
        </Link>
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">Program</h1>
          <HelpButton anchor="programs" label="programs" />
        </div>
      </div>
      <ProgramEditor programId={id} />
    </section>
  );
}

function ProgramList() {
  const programs = usePrograms();
  const active = useActiveProgram();
  const navigate = useNavigate();

  if (programs === undefined) {
    return (
      <section className="space-y-4" aria-busy="true">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">Programs</h1>
          <HelpButton anchor="programs" label="programs" />
        </div>
        <div className="bg-muted h-24 animate-pulse rounded-md" aria-hidden />
      </section>
    );
  }
  const builtIns = programs.filter((p) => p.builtIn);
  const mine = programs.filter((p) => !p.builtIn);

  async function create() {
    const p = await programsRepo.createProgram();
    void navigate(`/programs/${p.id}`);
  }

  return (
    <section className="space-y-6" data-testid="programs-page">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold">Programs</h1>
          <HelpButton anchor="programs" label="programs" />
        </div>
        <Button data-testid="new-program" onClick={() => void create()}>
          <Plus /> New program
        </Button>
      </div>

      <section className="space-y-2" aria-labelledby="my-programs-heading">
        <h2 id="my-programs-heading" className="text-lg font-medium">
          My programs
        </h2>
        {mine.length === 0 ? (
          <p
            className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm"
            data-testid="programs-empty"
          >
            No programs yet. Create one, or copy a template below.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((p) => (
              <ProgramRow key={p.id} program={p} active={active?.id === p.id} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="templates-heading">
        <h2 id="templates-heading" className="text-lg font-medium">
          Templates
        </h2>
        <ul className="space-y-2">
          {builtIns.map((p) => (
            <ProgramRow key={p.id} program={p} active={active?.id === p.id} />
          ))}
        </ul>
      </section>
    </section>
  );
}

function ProgramRow({ program, active }: { program: Program; active: boolean }) {
  const navigate = useNavigate();
  const exerciseCount = program.days.reduce((n, d) => n + d.exercises.length, 0);
  return (
    <li>
      <Card data-testid="program-item" data-program-id={program.id}>
        <CardContent className="flex items-center justify-between gap-2">
          <Link
            to={`/programs/${program.id}`}
            className="focus-visible:ring-ring min-h-11 min-w-0 flex-1 rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{program.name}</span>
              {active && <Badge data-testid="active-badge">Active</Badge>}
              {program.builtIn && <Badge variant="secondary">Built-in</Badge>}
            </span>
            <span className="text-muted-foreground block text-sm">
              {program.days.length} days, {exerciseCount} exercises
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Duplicate ${program.name}`}
            data-testid="duplicate-program-row"
            onClick={() =>
              void programsRepo
                .duplicateProgram(program.id)
                .then((c) => navigate(`/programs/${c.id}`))
            }
          >
            <Copy />
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}
