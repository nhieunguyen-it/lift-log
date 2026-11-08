import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { findUnknownExercises, parseProgramFile, type ProgramFile } from '@/program';
import {
  ProgramImportError,
  importProgram,
  knownProgramExerciseIds,
  previewImportName,
} from '@/db/programsRepo';

const MAX_SHOWN = 20;

interface Preview {
  file: ProgramFile;
  name: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function ImportProgramButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  // Data is kept after a dialog closes so its content doesn't blank during the close
  // animation; it is replaced the next time the dialog opens.
  const [errors, setErrors] = useState<string[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const showErrors = (list: string[]) => {
    setErrors(list);
    setErrorsOpen(true);
  };
  const [busy, setBusy] = useState(false);

  async function onFile(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = parseProgramFile(text);
      if (!parsed.ok) {
        showErrors(parsed.errors);
        return;
      }
      const unknown = findUnknownExercises(parsed.file, await knownProgramExerciseIds());
      if (unknown.length > 0) {
        showErrors(unknown);
        return;
      }
      setPreview({ file: parsed.file, name: await previewImportName(parsed.file.program.name) });
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      showErrors(['Could not read this file.']);
    } finally {
      input.value = '';
    }
  }

  async function confirm() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const program = await importProgram(preview.file);
      setPreviewOpen(false);
      void navigate(`/programs/${program.id}`, {
        state: { status: 'Imported. Set it as active to start using it.' },
      });
    } catch (e) {
      setPreviewOpen(false);
      if (e instanceof ProgramImportError) {
        showErrors(e.errors);
      } else {
        console.error(e);
        showErrors(['Import failed. Your programs were not changed.']);
      }
    } finally {
      setBusy(false);
    }
  }

  const days = preview?.file.program.days ?? [];
  const exerciseCount = days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <>
      <Button
        variant="outline"
        data-testid="import-program"
        onClick={() => fileRef.current?.click()}
      >
        <Upload /> Import program
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import program file"
        data-testid="import-program-file"
        onChange={(e) => void onFile(e.currentTarget)}
      />

      <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Can&apos;t import this program</DialogTitle>
            <DialogDescription>Nothing was imported.</DialogDescription>
          </DialogHeader>
          <ul
            className="max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-sm"
            data-testid="import-program-errors"
          >
            {errors.slice(0, MAX_SHOWN).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
            {errors.length > MAX_SHOWN && (
              <li className="list-none">…and {errors.length - MAX_SHOWN} more</li>
            )}
          </ul>
          <DialogFooter>
            <Button onClick={() => setErrorsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent data-testid="import-program-preview">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>
              {plural(days.length, 'day')} · {plural(exerciseCount, 'exercise')}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {days.map((d, i) => (
              <li key={i}>
                {d.name} — {plural(d.exercises.length, 'exercise')}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              data-testid="import-program-confirm"
              disabled={busy}
              onClick={() => void confirm()}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
