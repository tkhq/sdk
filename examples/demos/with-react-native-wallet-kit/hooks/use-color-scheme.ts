import { useColorScheme as useRNColorScheme } from "react-native";

// RN 0.86+ can return "unspecified"; the app only themes light/dark.
export function useColorScheme() {
  return useRNColorScheme() === "dark" ? "dark" : "light";
}
