import React, { createContext, useContext, useState } from "react";

interface UIContextType {
  isInputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  scrollY: number;
  setScrollY: (y: number) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isInputFocused, setInputFocused] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <UIContext.Provider
      value={{
        isInputFocused,
        setInputFocused,
        scrollY,
        setScrollY,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
};
