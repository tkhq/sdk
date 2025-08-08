import { Input } from "@headlessui/react";

interface SliderFieldProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string; // This comes after the number, e.g., "px" for pixel values
}

export function SliderField(props: SliderFieldProps) {
  const {
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    suffix,
  } = props;
  return (
    <div className="flex items-center justify-between gap-3">
      {label && <span className="text-sm whitespace-nowrap w-64">{label}</span>}
      <Input
        type="range"
        className="w-full accent-primary-light dark:accent-primary-dark"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(Number(e.target.value))
        }
        min={min}
        max={max}
        step={step}
      />
      <span className="text-sm text-gray-500 w-20 text-right whitespace-nowrap">
        {value} {suffix}
      </span>
    </div>
  );
}
