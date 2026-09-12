export const layout = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 22,
    xl: 32,
    full: 40, // used for big hero sections
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 26,
    full: 999,
  },
  shadow: {
    sm: {
      elevation: 2,
      shadowColor: "rgba(0,0,0,0.35)",
      shadowOpacity: 0.25,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    md: {
      elevation: 4,
      shadowColor: "rgba(0,0,0,0.45)",
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    lg: {
      elevation: 8,
      shadowColor: "rgba(0,0,0,0.55)",
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    glow: {
      shadowColor: "rgba(255,215,0,0.45)",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
    },
  },
  screen: {
    padding: 22,
    radius: 18,
    headerSpacing: 14,
    sectionSpacing: 24,
  },
  button: {
    padding: 16,
    radius: 14,
    spacing: 12,
  },
  fab: {
    size: 56,
    padding: 14,
    radius: 999,
    offset: {
      bottom: 24,
      right: 24,
    },
  },
};
