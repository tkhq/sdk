import chalk from "chalk";
import ora, { Ora } from "ora";

/**
 * Creates a spinner with the given message
 */
export function createSpinner(message: string): Ora {
  return ora(message);
}

/**
 * Success message in green
 */
export function success(message: string): void {
  console.log(chalk.green(`[SUCCESS] ${message}`));
}

/**
 * Error message in red
 */
export function error(message: string): void {
  console.log(chalk.red(`[ERROR] ${message}`));
}

/**
 * Info message in blue
 */
export function info(message: string): void {
  console.log(chalk.blue(`[INFO] ${message}`));
}

/**
 * Warning message in yellow
 */
export function warning(message: string): void {
  console.log(chalk.yellow(`[WARNING] ${message}`));
}

/**
 * Print a formatted header
 */
export function printHeader(title: string): void {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

/**
 * Print a visual separator
 */
export function printSeparator(): void {
  console.log("─".repeat(60));
}

