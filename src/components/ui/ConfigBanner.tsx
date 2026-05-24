import { AlertTriangle } from 'lucide-react';

export function ConfigBanner() {
  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[150]">
      <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed">
          <strong className="font-semibold">Firebase not configured.</strong>{' '}
          Authentication and data persistence are disabled. Copy{' '}
          <code className="font-mono">.env.example</code> to{' '}
          <code className="font-mono">.env.local</code> and fill in your project keys.
        </div>
      </div>
    </div>
  );
}
