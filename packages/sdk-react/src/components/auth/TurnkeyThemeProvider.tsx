import React, { createContext, useContext, useEffect } from "react";

const ThemeContext = createContext<Record<string, string> | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: Record<string, string>;
}

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
