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
    <div className="flex" role="tablist" aria-label="View switcher">
      {options.map((option, i) => (
        <button
          key={option.id}
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={`border px-3 py-1.5 text-xs font-medium ${
            i > 0 ? "-ml-px" : ""
          } ${
            value === option.id
              ? "z-10 border-black bg-black text-paper"
              : "border-line text-muted hover:border-black hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
