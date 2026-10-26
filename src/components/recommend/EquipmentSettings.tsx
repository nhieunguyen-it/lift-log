import { Checkbox } from '@/components/ui/checkbox';
import { EQUIPMENT } from '@/data/schema';
import { settingsRepo, useEquipment } from '@/db';
import type { Equipment } from '@/data';

const label = (e: string) => e.charAt(0).toUpperCase() + e.slice(1);

export default function EquipmentSettings() {
  const equipment = useEquipment();
  if (!equipment) return null;

  function toggle(e: Equipment, on: boolean) {
    const next = on
      ? [...new Set([...(equipment ?? []), e])]
      : (equipment ?? []).filter((x) => x !== e);
    void settingsRepo.setEquipment(next.includes('bodyweight') ? next : [...next, 'bodyweight']);
  }

  return (
    <fieldset className="space-y-1" data-testid="equipment-settings">
      <legend className="sr-only">Available equipment</legend>
      {EQUIPMENT.map((e) => {
        const locked = e === 'bodyweight';
        const id = `equip-${e}`;
        return (
          <label
            key={e}
            htmlFor={id}
            className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
          >
            <Checkbox
              id={id}
              checked={equipment.includes(e)}
              disabled={locked}
              onCheckedChange={(c) => toggle(e, c === true)}
            />
            <span>
              {label(e)}
              {locked && <span className="text-muted-foreground"> (always on)</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
