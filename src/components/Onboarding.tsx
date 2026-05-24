import { useState } from 'react';
import { ArrowRight, Sparkles, Code, Cpu, Palette, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onComplete: (skill: string) => void;
  onSignIn: () => void;
}

const SKILL_SUGGESTIONS = [
  { name: 'HTML & CSS', icon: <Code className="w-4 h-4" /> },
  { name: 'Python', icon: <Cpu className="w-4 h-4" /> },
  { name: 'UI/UX Design', icon: <Palette className="w-4 h-4" /> },
  { name: 'Digital Marketing', icon: <PenTool className="w-4 h-4" /> }
];

export function Onboarding({ onComplete, onSignIn }: Props) {
  const [skill, setSkill] = useState('');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [hours, setHours] = useState(2);

  return (
    <div className="flex h-screen bg-canvas items-center justify-center font-sans relative overflow-hidden">
      
      {/* Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-100/50 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl w-full p-6 z-10 space-y-8"
      >
        
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full shadow-sm border border-border-strong text-xs font-semibold uppercase tracking-widest text-text-secondary"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>SkillPath AI</span>
          </motion.div>
          <label htmlFor="skill-input" className="block text-4xl md:text-5xl lg:text-6xl font-display font-medium text-primary tracking-tight leading-tight">
            What do you want <br/> to master today?
          </label>
          <div className="relative max-w-lg mx-auto pt-2">
            <input 
              id="skill-input"
              type="text" 
              placeholder="Start typing a skill..." 
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className="w-full text-center text-xl font-medium bg-transparent border-b-2 border-border-strong focus:border-primary pb-3 outline-none transition-colors text-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        {/* Suggestion Chips */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-2.5"
        >
          {SKILL_SUGGESTIONS.map(s => (
            <button 
              key={s.name}
              onClick={() => setSkill(s.name)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${
                skill === s.name 
                ? 'bg-primary border-primary text-white shadow-md scale-105' 
                : 'bg-white border-border-strong text-text-secondary hover:border-border-strong/80 hover:bg-canvas'
              }`}
            >
              {s.icon}
              {s.name}
            </button>
          ))}
        </motion.div>

        {/* Configurations */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Level Selector */}
          <div className="bg-white rounded-[20px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border-strong flex flex-col gap-2">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Experience</p>
            {(['Beginner', 'Intermediate', 'Advanced'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className="relative flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group overflow-hidden"
              >
                {level === l && (
                  <motion.div layoutId="levelBg" className="absolute inset-0 bg-canvas rounded-xl border border-border-strong z-0" />
                )}
                <span className={`relative z-10 ${level === l ? 'text-primary' : 'text-text-secondary group-hover:text-primary'}`}>{l}</span>
                {level === l && <Sparkles className="w-4 h-4 relative z-10 text-primary" />}
              </button>
            ))}
          </div>

          {/* Hours Selector */}
          <div className="bg-white rounded-[20px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border-strong flex flex-col justify-between">
             <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Daily Commitment</p>
             <div className="flex-1 flex flex-col justify-center gap-6 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-medium text-5xl text-primary tracking-tighter">{hours}</span>
                  <span className="text-base font-medium text-text-muted">hours / day</span>
                </div>
                <div className="space-y-3">
                  <input 
                    type="range" 
                    min="1" max="6" 
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full accent-primary h-2 bg-canvas rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs font-bold text-text-muted">
                    <span>1h</span>
                    <span>6h</span>
                  </div>
                </div>
             </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="pt-4 flex justify-center gap-4"
        >
          <button 
            disabled={!skill.trim()}
            onClick={() => onComplete(skill)}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-full text-base font-medium hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group shadow-lg shadow-primary/20"
          >
            <span>Begin Journey</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button 
            onClick={onSignIn}
            className="flex items-center gap-2 px-8 py-4 bg-white text-primary rounded-full text-base font-medium hover:bg-canvas transition-all active:scale-95 border border-border-strong shadow-sm"
          >
            <span>Sign In</span>
          </button>
        </motion.div>

      </motion.div>
    </div>
  );
}
