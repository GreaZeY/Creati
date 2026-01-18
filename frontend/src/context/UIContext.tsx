import React, { createContext, useContext, useState } from 'react';

interface UIContextType {
    isInputFocused: boolean;
    setInputFocused: (focused: boolean) => void;
    scrollY: number;
    setScrollY: (y: number) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isInputFocused, setInputFocused] = useState(false);
    const [scrollY, setScrollY] = useState(0);

    return (
        <UIContext.Provider value={{ isInputFocused, setInputFocused, scrollY, setScrollY }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
