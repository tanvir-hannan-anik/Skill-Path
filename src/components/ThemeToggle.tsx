import { Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../lib/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`relative w-12 h-7 rounded-full border border-border-strong bg-canvas transition-colors flex items-center px-1 ${className}`}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`w-5 h-5 rounded-full bg-surface shadow-sm flex items-center justify-center text-text-secondary ${isDark ? 'ml-auto' : ''}`}
      >
        {isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
      </motion.div>
    </button>
  );
}
