import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "../ui/radio-group";
import { LucideIcon } from "lucide-react";

interface AuthOptionProps {
  value: string;
  id: string;
  label: string;
  Icon: LucideIcon;
}

export function AuthOption({ value, id, label, Icon }: AuthOptionProps) {
  return (
    <div className="">
      <RadioGroupItem value={value} id={id} className="sr-only peer" />
      <Label
        htmlFor={id}
        className="text-base font-normal aspect-square cursor-pointer py-7 px-5 first-letter:font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
      >
        <Icon strokeWidth={2.5} className="h-6 w-6" />
        {label}
      </Label>
    </div>
  );
}
