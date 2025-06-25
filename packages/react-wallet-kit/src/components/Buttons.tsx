import { Button } from "@headlessui/react";

interface IconButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}
export function IconButton(props: IconButtonProps) {
  const { children, onClick, disabled, className } = props;

  return (
    <Button
      className={`flex items-center justify-center p-2 rounded-full bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      onClick={onClick}
      disabled={!!disabled}
    >
      {children}
    </Button>
  );
}
