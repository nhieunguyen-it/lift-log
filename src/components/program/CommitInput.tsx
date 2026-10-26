import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface Props extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'onBlur'> {
  value: string;
  onCommit: (value: string) => void;
}

/** Text/number input that keeps a local draft and commits on blur or Enter. */
export default function CommitInput({ value, onCommit, onKeyDown, ...rest }: Props) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <Input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
