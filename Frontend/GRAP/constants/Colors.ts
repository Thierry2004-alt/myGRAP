// GRAP Color Palette - inspired by the official logo
// Blue: #1B56B6 / #0D3A7A / #2A8FD6
// Green: #3BB55C / #1E9B3D / #5CD06E

const bluePrimary = '#1B56B6';
const blueDark = '#0D3A7A';
const blueLight = '#2A8FD6';
const blueSoft = '#E8F0FE';

const greenPrimary = '#3BB55C';
const greenDark = '#1E9B3D';
const greenLight = '#5CD06E';
const greenSoft = '#E8F7EC';

const tintColorLight = bluePrimary;
const tintColorDark = '#fff';

export default {
  light: {
    text: '#1A1A1A',
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    tint: tintColorLight,
    tabIconDefault: '#999',
    tabIconSelected: tintColorLight,
    card: '#FFFFFF',
    border: '#E0E0E0',
    // GRAP brand colors
    bluePrimary,
    blueDark,
    blueLight,
    blueSoft,
    greenPrimary,
    greenDark,
    greenLight,
    greenSoft,
    success: greenPrimary,
    error: '#E53935',
    warning: '#FFA726',
  },
  dark: {
    text: '#FFFFFF',
    background: '#121212',
    backgroundSecondary: '#1E1E1E',
    tint: tintColorDark,
    tabIconDefault: '#999',
    tabIconSelected: blueLight,
    card: '#1E1E1E',
    border: '#333',
    bluePrimary,
    blueDark,
    blueLight,
    blueSoft,
    greenPrimary,
    greenDark,
    greenLight,
    greenSoft,
    success: greenLight,
    error: '#EF5350',
    warning: '#FFB74D',
  },
};