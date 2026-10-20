"use client";

export function ViewSwitcher<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-full bg-card p-1 shadow-card" role="tablist" aria-label="View switcher">
      {options.map((option) => (
        <button
          key={option.id}
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={`min-h-10 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors md:min-h-0 ${
            value === option.id
              ? "bg-ink text-on-ink"
              : "text-muted hover:bg-surface hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
