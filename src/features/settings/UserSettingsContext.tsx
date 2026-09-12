import React, { createContext, useContext } from "react";

type UserSettings = {
  isDealer: boolean;
};

const UserSettingsContext = createContext<UserSettings>({
  isDealer: false,
});

export function UserSettingsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: UserSettings;
}) {
  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsContext);
}
