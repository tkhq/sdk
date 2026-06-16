import React from "react";
import { Button } from "./button"; // Importing the Button component
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select"; // Assuming you have a Select component
import { ChainType } from "@/lib/types";
import { Label } from "./label";

interface InsetSelectButtonProps<T> {
  children: React.ReactNode;
  onSelect: (selection: T) => void;
  connect: () => void;
}

const InsetSelectButton = <T,>({
  children,
  onSelect,
  connect,
}: InsetSelectButtonProps<T>) => {
  return (
    <div className="relative flex flex-col gap-4">
      <div className="flex items-center gap-6">
        <Label>Select network</Label>
        <Select
          disabled
          onValueChange={(value) => onSelect(value as T)}
          defaultValue={ChainType.SOLANA}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Chain</SelectLabel>
              <SelectItem value={ChainType.EVM}>Ethereum</SelectItem>
              <SelectItem value={ChainType.SOLANA}>Solana</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Button className="" onClick={connect} variant="default">
        {children}
      </Button>
    </div>
  );
};

export default InsetSelectButton;
