import { useEffect, useState } from 'react';
import { resolveThemePreference, type ThemeMode } from '../features/themePreference';

const KEY = 'tripnest.theme';

function apply(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event('tripnest-theme-change'));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  useEffect(() => {
    const preference = matchMedia('(prefers-color-scheme: dark)');
    const refresh = () =>
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    const stored = () => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    };
    const followSystem = () => {
      const choice = stored();
      if (choice !== 'dark' && choice !== 'light')
        apply(resolveThemePreference(null, preference.matches));
    };
    const followOtherTab = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null)
        apply(resolveThemePreference(stored(), preference.matches));
    };
    window.addEventListener('tripnest-theme-change', refresh);
    window.addEventListener('storage', followOtherTab);
    preference.addEventListener('change', followSystem);
    return () => {
      window.removeEventListener('tripnest-theme-change', refresh);
      window.removeEventListener('storage', followOtherTab);
      preference.removeEventListener('change', followSystem);
    };
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* The choice still works in this tab. */
    }
    apply(next);
  };
  const label = theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode';
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={theme === 'dark'}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        width="19"
        height="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.5 13.6A8.7 8.7 0 0 1 10.4 3.5a8.8 8.8 0 1 0 10.1 10.1Z" />
        )}
      </svg>
    </button>
  );
}
