import { colors } from "./colors";

export * from "./colors";
export * from "./typography";
export * from "./spacing";
export * from "./radius";
export * from "./layout";
export * from "./components";

export const themes = {
  base: { colors },
  pro: { colors },
  free: { colors }, // optional, only if ThemeContext uses it
};

export type Theme = {
  colors: typeof colors;
};
