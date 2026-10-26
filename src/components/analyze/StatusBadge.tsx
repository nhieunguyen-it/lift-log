import type { MuscleStatus } from '@/analyzer';
import { STATUS_WORD, statusColors } from './statusStyle';

export default function StatusBadge({ status }: { status: MuscleStatus }) {
  const c = statusColors(status);
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {STATUS_WORD[status]}
    </span>
  );
}
