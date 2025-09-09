import clsx from "clsx";

interface SpinnerProps {
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

export function Spinner(props: SpinnerProps) {
  const { className, style, strokeWidth = 3, ...rest } = props;
  return (
    <svg
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("text-primary-light dark:text-primary-dark", className)}
      style={style}
      {...rest}
    >
      <style>
        {
          ".spinner_V8m1{transform-origin:center;animation:spinner_zKoa 2s linear infinite}.spinner_V8m1 circle{stroke-linecap:round;animation:spinner_YpZS 1.5s ease-in-out infinite}@keyframes spinner_zKoa{100%{transform:rotate(360deg)}}@keyframes spinner_YpZS{0%{stroke-dasharray:0 150;stroke-dashoffset:0}47.5%{stroke-dasharray:42 150;stroke-dashoffset:-16}95%,100%{stroke-dasharray:42 150;stroke-dashoffset:-59}}"
        }
      </style>
      <g className="spinner_V8m1">
        <circle cx={12} cy={12} r={9.5} strokeWidth={strokeWidth} />
      </g>
    </svg>
  );
}
