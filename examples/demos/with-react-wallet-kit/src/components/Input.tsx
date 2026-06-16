import { Input } from "@headlessui/react";
import React from "react";

interface TextInputFieldProps {
  value: string;
  onChange: (val: string) => void;
  width?: number;
  label?: string;
  placeholder?: string;
}

export function TextInputField(props: TextInputFieldProps) {
  const { value, onChange, width = 40, label, placeholder } = props;

  return (
    <div className="flex items-center justify-between gap-3">
      {label && <span className="text-sm">{label}</span>}
      <Input
        type="text"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        style={{ width }}
        className={`rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-light dark:ring-primary-dark text-sm text-center h-7`}
      />
    </div>
  );
}
