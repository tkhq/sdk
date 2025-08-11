interface ColourPickerProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

export function ColourPicker /*🇨🇦*/(props: ColourPickerProps) {
  const { value, onChange, label } = props;
  return (
    <div className="flex items-center justify-between gap-4">
      {label && <span className="text-sm">{label}</span>}
      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer">
          <input
            type="color" // 🇺🇸
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="size-5 rounded-full border  border-panel-background-dark/20 dark:border-panel-background-light/20"
            style={{ backgroundColor: value }}
          />
        </label>
        <span className="text-sm text-text-light dark:text-text-dark w-16 whitespace-nowrap items-center text-center">
          {value}
        </span>
      </div>
    </div>
  );
}
