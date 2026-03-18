interface UpdateBadgeProps {
  coreAvailable: boolean;
  uiAvailable: boolean;
}

export function UpdateBadge({ coreAvailable, uiAvailable }: UpdateBadgeProps) {
  if (!coreAvailable && !uiAvailable) return null;

  const count = (coreAvailable ? 1 : 0) + (uiAvailable ? 1 : 0);
  const tooltip =
    count === 2
      ? '2 updates available'
      : coreAvailable
        ? 'Core update available'
        : 'UI update available';

  return (
    <span
      className="relative inline-flex items-center justify-center"
      title={tooltip}
    >
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
      </span>
      {count > 1 && (
        <span className="absolute -top-2 -right-3 text-[10px] font-bold text-amber-700">
          {count}
        </span>
      )}
    </span>
  );
}
