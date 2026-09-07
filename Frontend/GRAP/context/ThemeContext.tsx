import React, { createContext, useState, useContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  card: string;
  cardBorder: string;
  text: string;
  subText: string;
  primary: string;
  secondary: string;
  accent: string;
  inputBg: string;
  mapBg: string;
}

const bluePrimary = '#1B56B6';
const blueDark = '#0D3A7A';
const blueLight = '#2A8FD6';
const blueSky = '#E3F2FD';
const greenPrimary = '#3BB55C';
const greenDark = '#1E9B3D';
const greenLight = '#5CD06E';
const greenMint = '#E8F5E9';

const darkColors: ThemeColors = {
  bg: '#0F172A',
  card: '#1E293B',
  cardBorder: '#334155',
  text: '#F8FAFC',
  subText: '#CBD5E1',
  primary: blueLight,
  secondary: greenLight,
  accent: '#FBBF24',
  inputBg: '#1E293B',
  mapBg: '#0F172A',
};

const lightColors: ThemeColors = {
  bg: '#F6F7F4',
  card: '#FFFFFF',
  cardBorder: '#DCE2DA',
  text: '#172018',
  subText: '#667368',
  primary: bluePrimary,
  secondary: greenPrimary,
  accent: '#D89100',
  inputBg: '#EEF2EC',
  mapBg: '#E5EBE3',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const colors = mode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};