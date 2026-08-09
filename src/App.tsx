import React, { useState, useEffect } from 'react';
import { ThemeMode, Language } from './types';
import { YTLinkerOps } from './components/YTLinkerOps';
import { watchAuthState, signInWithGoogle, signOutUser } from './lib/firebase';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    // The approved visual direction is the editorial library surface. Existing
    // user preferences still take precedence, including the optional dark mode.
    return (localStorage.getItem('ytlinker_theme') as ThemeMode) || 'editorial-light';
  });

  // الواجهة عربية فقط (RTL) بشكل دائم — لا يوجد خيار لغة إنجليزية.
  const lang: Language = 'ar';

  // حالة المصادقة: التطبيق كله محجوب خلف تسجيل دخول Google
  const [authUser, setAuthUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = watchAuthState((user) => {
      setAuthUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google sign-in failed:', err);
      setAuthError(
        err?.code === 'auth/unauthorized-domain'
          ? 'هذا النطاق غير مُصرَّح به في إعدادات Firebase. أضِف النطاق في Authentication ← Settings ← Authorized domains.'
          : 'تعذّر تسجيل الدخول. تأكد من تفعيل مزوّد Google في لوحة Firebase ثم أعد المحاولة.'
      );
    }
  };

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

  const isLight = theme === 'editorial-light';
  const shellClass = `min-h-screen font-sans transition-colors ${
    isLight ? 'bg-[#f7fbed] text-[#181d15]' : 'glacier-bg text-[#e0e8f0]'
  }`;

  // أثناء التحقق من الجلسة
  if (!authChecked) {
    return (
      <div className={`${shellClass} flex items-center justify-center`}>
        <p className="text-sm opacity-70">جارٍ التحقق من الجلسة...</p>
      </div>
    );
  }

  // شاشة تسجيل الدخول
  if (!authUser) {
    return (
      <div className={`${shellClass} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-sm rounded-2xl border p-8 text-center space-y-4 ${
          isLight ? 'bg-white border-[#c1c9b6]' : 'bg-[#141c2e] border-white/10'
        }`}>
          <h1 className="text-xl font-bold">يوتيوب أكاديمي</h1>
          <p className="text-xs opacity-70 leading-relaxed">
            سجّل الدخول بحساب Google للوصول إلى مفضلتك ومجموعاتك المحفوظة.
          </p>
          <button
            onClick={handleSignIn}
            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
              isLight ? 'bg-[#205100] text-white hover:bg-green-900' : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
            }`}
          >
            تسجيل الدخول بحساب Google
          </button>
          {authError && (
            <p className="text-[11px] text-rose-400 leading-relaxed">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <YTLinkerOps
        theme={theme}
        onThemeToggle={() => setTheme(isLight ? 'glacier-dark' : 'editorial-light')}
        lang={lang}
        userEmail={authUser.email || ''}
        onSignOut={signOutUser}
      />
    </div>
  );
}
