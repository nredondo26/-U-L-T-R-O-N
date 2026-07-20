// src/cli/theme.ts
// Sistema de temas visuales para J.A.R.V.I.S.

export interface ThemeColors {
  primary: string; accent: string; success: string; warn: string;
  error: string; dim: string; surface: string; text: string;
  bright: string; bg: string; matrix: string;
}

export type ThemeName = 'ultron' | 'sky' | 'cyber' | 'midnight' | 'matrix';

export const themes: Record<string, ThemeColors> = {
  ultron: {
    primary: '#ef4444', accent: '#f87171', success: '#34d399',
    warn: '#fbbf24', error: '#dc2626', dim: '#3d1a1a',
    surface: '#1a0a0a', text: '#fca5a5', bright: '#fecaca',
    bg: '#0a0202', matrix: '#2d0a0a',
  },
  sky: {
    primary: '#0ea5e9', accent: '#38bdf8', success: '#34d399',
    warn: '#fbbf24', error: '#f87171', dim: '#1e3a5f',
    surface: '#0c1929', text: '#7dd3fc', bright: '#e0f2fe',
    bg: '#061220', matrix: '#0a1e3d',
  },
  cyber: {
    primary: '#00ffff', accent: '#ff00ff', success: '#00ff88',
    warn: '#ffff00', error: '#ff0055', dim: '#1a2a3a',
    surface: '#0a0a1a', text: '#00ddff', bright: '#00ffff',
    bg: '#010118', matrix: '#001133',
  },
  midnight: {
    primary: '#6366f1', accent: '#a855f7', success: '#22c55e',
    warn: '#eab308', error: '#ef4444', dim: '#334155',
    surface: '#0f172a', text: '#cbd5e1', bright: '#f1f5f9',
    bg: '#020617', matrix: '#1e1b4b',
  },
  matrix: {
    primary: '#00ff41', accent: '#00cc33', success: '#39ff14',
    warn: '#bfff00', error: '#ff0040', dim: '#1a3a1a',
    surface: '#0d1f0d', text: '#00cc33', bright: '#00ff41',
    bg: '#020502', matrix: '#003b00',
  },
};

let currentTheme: ThemeName = 'ultron';

export function getTheme(): ThemeColors { return themes[currentTheme]; }
export function setTheme(name: ThemeName): void { if (themes[name]) currentTheme = name; }
export function getThemeName(): ThemeName { return currentTheme; }
export function listThemes(): string[] { return Object.keys(themes); }
