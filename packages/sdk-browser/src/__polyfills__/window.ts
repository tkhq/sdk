const loadWindow = () => {
  if (typeof window !== "undefined") {
    return window;
  } else {
    return {
      localStorage: {
        getItem: (_key: string): string | null => {
          return null;
        },
        setItem: (_key: string, _value: string) => {},
        removeItem: (_key: string) => {},
        clear: () => {},
        key: (_index: number): string | null => {
          return null;
        },
        length: 0,
      },
      location: {
        hostname: "",
      },
    };
  }
};

export default loadWindow();
