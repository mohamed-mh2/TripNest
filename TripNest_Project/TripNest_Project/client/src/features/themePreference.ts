export type ThemeMode = 'light' | 'dark';

export function resolveThemePreference(
  saved: string | null,
  systemDark: boolean,
): ThemeMode {
  return saved === 'light' || saved === 'dark' ? saved : systemDark ? 'dark' : 'light';
}
