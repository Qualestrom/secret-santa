import { WarningCircle } from '@phosphor-icons/react';

export function ErrorMark() {
  return (
    <span role="img" aria-label="Error" className="inline-flex shrink-0 items-center">
      <WarningCircle size={15} weight="regular" aria-hidden="true" />
    </span>
  );
}
