import React, { createContext, useContext, useEffect } from "react";

const ThemeContext = createContext<Record<string, string> | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: Record<string, string>;
}

/**
 * A provider component for dynamically applying and managing CSS custom properties (variables) as themes.
 *
 * - Applies the provided `theme` to the root `<html>` element via CSS variables.
 * - Makes the `theme` object accessible to child components through React context. These themes will apply to all Turnkey components used in your app
 *
 * Example usage:
 * ```tsx
 * const theme = {
 *   "--text-primary": "#333",
 * };
 *
 * <TurnkeyThemeProvider theme={theme}>
 *   <App />
 * </TurnkeyThemeProvider>
 * ```
 */

export const TurnkeyThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  theme,
}) => {
  useEffect(() => {
    if (theme) {
      const root = document.documentElement.style;
      Object.entries(theme).forEach(([key, value]) => {
        root.setProperty(key, value);
      });
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme || null}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
