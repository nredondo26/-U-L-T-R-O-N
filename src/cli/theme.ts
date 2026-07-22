// src/cli/theme.ts
// Professional color themes — clean, readable, modern

export interface ThemeColors {
  primary: string; accent: string; success: string; warn: string;
  error: string; dim: string; surface: string; text: string;
  bright: string; bg: string; matrix: string;
}

export type ThemeName = 'ultron' | 'sky' | 'cyber' | 'midnight' | 'matrix';

export const themes: Record<string, ThemeColors> = {
  ultron: {
    primary: '#22d3ee', accent: '#67e8f9', success: '#4ade80',
    warn: '#fbbf24', error: '#f87171', dim: '#64748b',
    surface: '#1e293b', text: '#e2e8f0', bright: '#f8fafc',
    bg: '#0f172a', matrix: '#155e75',
  },
  sky: {
    primary: '#60a5fa', accent: '#93c5fd', success: '#4ade80',
    warn: '#fbbf24', error: '#f87171', dim: '#64748b',
    surface: '#1e293b', text: '#e2e8f0', bright: '#f8fafc',
    bg: '#0f172a', matrix: '#1e3a5f',
  },
  cyber: {
    primary: '#2dd4bf', accent: '#5eead4', success: '#34d399',
    warn: '#facc15', error: '#fb7185', dim: '#64748b',
    surface: '#1e293b', text: '#e2e8f0', bright: '#f8fafc',
    bg: '#0f172a', matrix: '#0d9488',
  },
  midnight: {
    primary: '#a78bfa', accent: '#c4b5fd', success: '#4ade80',
    warn: '#fbbf24', error: '#f87171', dim: '#64748b',
    surface: '#1e293b', text: '#e2e8f0', bright: '#f8fafc',
    bg: '#0f172a', matrix: '#5b21b6',
  },
  matrix: {
    primary: '#4ade80', accent: '#86efac', success: '#22c55e',
    warn: '#facc15', error: '#f87171', dim: '#4a7a5a',
    surface: '#0a1a0a', text: '#bbf7d0', bright: '#f0fdf4',
    bg: '#020502', matrix: '#003b00',
  },
};

let currentTheme: ThemeName = 'ultron';

export function getTheme(): ThemeColors { return themes[currentTheme]; }
export function setTheme(name: ThemeName): void { if (themes[name]) currentTheme = name; }
export function getThemeName(): ThemeName { return currentTheme; }
export function listThemes(): string[] { return Object.keys(themes); }
