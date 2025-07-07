export type ThemeOverrides = {
  // Any colours we want to customize, add here!
  primary?: string;
  primaryText?: string; // This is the text that sits on top of any primary color
  button?: string;
  modalBackground?: string;
  modalText?: string;
  iconBackground?: string;
  iconText?: string;
};

export function TurnkeyThemeOverrides(props: {
  light?: Partial<ThemeOverrides> | undefined;
  dark?: Partial<ThemeOverrides> | undefined;
}) {
  const { light, dark } = props;
  const generateCSSVars = (theme?: Partial<ThemeOverrides>) => {
    if (!theme) return "";
    return Object.entries(theme)
      .map(([key, value]) => `--color-${kebab(key)}-light: ${value};`)
      .join("\n");
  };

  const generateDarkCSSVars = (theme?: Partial<ThemeOverrides>) => {
    if (!theme) return "";
    return Object.entries(theme)
      .map(([key, value]) => `--color-${kebab(key)}-dark: ${value};`)
      .join("\n");
  };

  return (
    <style>
      {`
        :root {
          ${generateCSSVars(light)}
        }
        .dark {
          ${generateDarkCSSVars(dark)}
        }
      `}
    </style>
  );
}

// Utility to convert camelCase to kebab-case 🥙
function kebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
