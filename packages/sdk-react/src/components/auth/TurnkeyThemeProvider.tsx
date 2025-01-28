"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material";

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
  const [muiTheme, setMuiTheme] = useState(createTheme({}));

  useEffect(() => {
    if (theme) {
      const root = document.documentElement.style;
      Object.entries(theme).forEach(([key, value]) => {
        root.setProperty(key, value);
      });
    }
    setMuiTheme(
      createTheme({
        typography: {
          fontFamily: "inherit", // We want MUI components to use the same font as the rest of the app
        },
      })
    );
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme || null}>
      <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
