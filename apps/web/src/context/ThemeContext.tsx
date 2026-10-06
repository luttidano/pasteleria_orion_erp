/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  theme: 'dark' | 'light';
  toggleDarkMode: () => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  theme: 'light',
  toggleDarkMode: () => {},
  toggleTheme: () => {},
});

const applyThemeClasses = (dark: boolean) => {
  try {
    const root = document.documentElement;
    const body = document.body;

    // 1. Congelar transiciones para que el cambio sea simultáneo en todos los elementos del DOM
    root.classList.add('disable-theme-transitions');

    // 2. Aplicar clases de tema de forma atómica
    if (dark) {
      root.classList.add('dark');
      if (body) body.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('orion_theme', 'dark');
    } else {
      root.classList.remove('dark');
      if (body) body.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('orion_theme', 'light');
    }

    // 3. Forzar reflow para que el navegador aplique todos los colores en el mismo cuadro de renderizado
    void window.getComputedStyle(root).opacity;

    // 4. Restaurar transiciones en el siguiente frame para no afectar interacciones de usuario (hover, focus, etc.)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('disable-theme-transitions');
      });
    });
  } catch (e) {
    console.error('Error applying theme:', e);
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('orion_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    applyThemeClasses(isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      applyThemeClasses(next);
      return next;
    });
  }, []);

  const toggleTheme = toggleDarkMode;
  const theme = isDarkMode ? 'dark' : 'light';

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
