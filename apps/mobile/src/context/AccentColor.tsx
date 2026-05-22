import React, { createContext, useContext, useState, useCallback } from 'react';

type AccentColor = 'red' | 'blue' | 'green' | 'gray';

const COLORS: Record<AccentColor, string> = {
  red: '#ef4444',
  blue: '#2563eb',
  green: '#10b981',
  gray: '#6b7280',
};

interface AccentColorContextType {
  accentColor: string;
  setAccent: (color: AccentColor) => void;
}

const AccentColorContext = createContext<AccentColorContextType>({
  accentColor: COLORS.red,
  setAccent: () => {},
});

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [color, setColor] = useState<AccentColor>('red');
  const setAccent = useCallback((c: AccentColor) => setColor(c), []);
  return (
    <AccentColorContext.Provider value={{ accentColor: COLORS[color], setAccent }}>
      {children}
    </AccentColorContext.Provider>
  );
}

export function useAccentColor() {
  return useContext(AccentColorContext);
}
