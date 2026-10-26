import { STATUS_HINT, STATUS_ORDER, STATUS_WORD, statusColors } from './statusStyle';

export default function StatusLegend() {
  return (
    <ul aria-label="Legend" className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
      {STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-sm border"
            style={{ backgroundColor: statusColors(s).bg, borderColor: statusColors(s).fg }}
          />
          <span>
            <span className="font-medium">{STATUS_WORD[s]}</span>
            <span className="text-muted-foreground"> · {STATUS_HINT[s]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
