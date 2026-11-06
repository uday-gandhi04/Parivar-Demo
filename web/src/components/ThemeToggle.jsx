import { IconSun, IconMoon } from '@tabler/icons-react';
import { useTheme } from '../lib/theme.jsx';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="btn btn-sm btn-link text-body-secondary p-2"
    >
      {isDark ? <IconMoon size={18} /> : <IconSun size={18} />}
    </button>
  );
}
