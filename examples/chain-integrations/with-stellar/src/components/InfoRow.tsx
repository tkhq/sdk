import { type ReactElement } from "react";

export default function InfoRow({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  link?: string;
}): ReactElement {
  if (!value) return <></>;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={`truncate text-blue-600 underline underline-offset-2 text-right ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </a>
      ) : (
        <span
          className={`truncate text-right ${mono ? "font-mono text-xs text-gray-700" : "text-gray-900"}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}
