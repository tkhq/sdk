import {
  Turnstile as TurnstileBase,
  type TurnstileInstance,
  type TurnstileProps,
} from "@marsidev/react-turnstile";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

export type { TurnstileInstance, TurnstileProps };

/**
 * @marsidev/react-turnstile may resolve against a different @types/react copy
 * than this package (common in the monorepo), which triggers TS2786 when used
 * as JSX. Re-export through our local React types.
 */
export const Turnstile = TurnstileBase as unknown as ForwardRefExoticComponent<
  TurnstileProps & RefAttributes<TurnstileInstance | undefined>
>;
