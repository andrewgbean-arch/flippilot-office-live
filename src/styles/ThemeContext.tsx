import React, {
  createContext,
  useState,
  useContext,
  useMemo,
} from "react";

import { themes } from "./theme";
import { useUserSettings } from "../features/settings/UserSettingsContext";

type ThemeContextType = {
  colors: any;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  ...themes.free,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<"free" | "pro">("free");
  const { isDealer } = useUserSettings();

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "free" ? "pro" : "free"));
  };

  const value = useMemo<ThemeContextType>(() => {
    const base = themeMode === "free" ? themes.free : themes.pro;

    return {
      ...base,
      toggleTheme,
    };
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
