import { Hexagon } from 'lucide-react';
import { motion } from 'motion/react';

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-canvas gap-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-black/10"
      >
        <Hexagon className="w-7 h-7 text-white fill-white/20" />
      </motion.div>
      <p className="text-text-secondary text-sm font-medium">{label}</p>
    </div>
  );
}
