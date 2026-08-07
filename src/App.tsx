import React, { useState, useEffect } from 'react';
import { ThemeMode, Language } from './types';
import { YTLinkerOps } from './components/YTLinkerOps';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('ytlinker_theme') as ThemeMode) || 'glacier-dark';
  });

  // الواجهة عربية فقط (RTL) بشكل دائم — لا يوجد خيار لغة إنجليزية.
  const lang: Language = 'ar';

  // Sync localStorage & DOM root attributes (dark mode, lang, dir)
  useEffect(() => {
    localStorage.setItem('ytlinker_theme', theme);
    const root = document.documentElement;
    if (theme === 'glacier-dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', 'ar');
    root.setAttribute('dir', 'rtl');
  }, []);

  return (
    <div className={`min-h-screen font-sans transition-colors ${
      theme === 'editorial-light' ? 'bg-[#f7fbed] text-[#181d15]' : 'glacier-bg text-[#e0e8f0]'
    }`}>
      <YTLinkerOps
        theme={theme}
        onThemeToggle={() => setTheme(theme === 'editorial-light' ? 'glacier-dark' : 'editorial-light')}
        lang={lang}
      />
    </div>
  );
}
