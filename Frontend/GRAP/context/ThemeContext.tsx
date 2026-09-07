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
const greenPrimary = '#3BB55C';
const greenDark = '#1E9B3D';
const greenLight = '#5CD06E';

const darkColors: ThemeColors = {
  bg: '#111714',
  card: '#1B241F',
  cardBorder: '#2D3A32',
  text: '#F1F5F0',
  subText: '#AAB7AD',
  primary: bluePrimary,
  secondary: greenPrimary,
  accent: '#F4BB32',
  inputBg: '#162019',
  mapBg: '#111714',
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