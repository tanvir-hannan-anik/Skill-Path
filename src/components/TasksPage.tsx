import { FormEvent, useState } from 'react';
import { Check, Compass, Sparkles, Plus, Rocket, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DayContent, Task } from '../types';
import { parseDateKey } from '../lib/dates';

interface Props {
  date: string;
  day: DayContent;
  onUpdateDay: (data: DayContent) => void;
}

function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function TasksPage({ date, day, onUpdateDay }: Props) {
  const tasks = day.tasks ?? [];
  const [draft, setDraft] = useState('');

  const doneCount = tasks.filter((t) => t.done).length;
  const progressPercent = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const friendlyDate = parseDateKey(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const toggleTask = (id: string) => {
    onUpdateDay({ ...day, tasks: tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  };
  const removeTask = (id: string) => {
    onUpdateDay({ ...day, tasks: tasks.filter((t) => t.id !== id) });
  };
  const addTask = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const next: Task = { id: newId(), text, done: false, createdAt: Date.now() };
    onUpdateDay({ ...day, tasks: [...tasks, next] });
    setDraft('');
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-10 w-full">
      {/* Hero */}
      <div className="bg-primary rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 md:p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute left-[-10%] bottom-[-20%] w-[300px] h-[300px] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg border border-white/10 text-xs font-bold uppercase tracking-widest text-white/80">
              <Compass className="w-3.5 h-3.5" />
              <span>Daily Protocol &bull; {friendlyDate}</span>
            </div>
            <h1 className="font-display font-medium text-3xl sm:text-4xl md:text-5xl tracking-tight">Focus & Execution</h1>
            <p className="text-white/60 text-base sm:text-lg leading-relaxed">
              Knock out these targeted objectives to solidify today's cognitive load.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="text-4xl sm:text-5xl font-display font-medium tracking-tighter tabular-nums gap-1 flex items-baseline">
              {doneCount}<span className="text-2xl text-white/40">/{tasks.length}</span>
            </div>
            <div className="w-32 sm:w-40 h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ type: 'spring', stiffness: 50, damping: 15 }}
              />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">{progressPercent}% complete</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8">
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-medium text-xl text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" /> Action Items
            </h3>
          </div>

          <form onSubmit={addTask} className="flex gap-2 mb-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a new task…"
              className="flex-1 bg-white border border-border-strong rounded-2xl px-5 py-3 outline-none focus:border-primary text-sm shadow-sm transition-colors text-primary placeholder:text-text-muted"
              aria-label="New task"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-5 py-3 bg-primary text-white rounded-2xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {tasks.map((task) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key={task.id}
                  className={`w-full flex items-center gap-4 p-4 sm:p-5 rounded-[20px] transition-all text-left group overflow-hidden relative border ${
                    task.done ? 'bg-canvas border-border-subtle' : 'bg-white border-border-strong shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-md hover:border-primary/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    aria-pressed={task.done}
                    aria-label={`Mark "${task.text}" as ${task.done ? 'not done' : 'done'}`}
                    className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      task.done ? 'bg-primary border-primary text-white' : 'border-border-strong text-transparent group-hover:border-primary/50'
                    }`}
                  >
                    {task.done && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </motion.span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className={`flex-1 text-left text-[15px] font-medium transition-colors min-w-0 break-words ${
                      task.done ? 'text-text-muted line-through' : 'text-primary'
                    }`}
                  >
                    {task.text}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    aria-label={`Remove "${task.text}"`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {tasks.length === 0 && (
              <div className="bg-canvas border border-dashed border-border-strong rounded-[20px] p-8 text-center">
                <p className="text-text-secondary text-sm">No tasks for today yet. Add one above to start your day.</p>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="p-[2px] rounded-[24px] bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent">
            <div className="bg-white rounded-[22px] p-6 h-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                    <Rocket className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Daily Challenge</span>
                </div>
                <h4 className="font-display font-medium text-2xl text-primary mb-3">Apply Today's Lesson</h4>
                <p className="text-text-secondary text-sm leading-relaxed mb-6">
                  Build a small project using what you learned today. Even 15 minutes of hands-on practice solidifies retention dramatically.
                </p>
              </div>

              <button
                onClick={() => {
                  const text = 'Apply today\'s lesson in a 15-minute hands-on practice';
                  if (tasks.some((t) => t.text === text)) return;
                  onUpdateDay({
                    ...day,
                    tasks: [...tasks, { id: newId(), text, done: false, createdAt: Date.now() }],
                  });
                }}
                className="w-full py-3 bg-canvas text-primary font-semibold text-sm rounded-[12px] hover:bg-black hover:text-white transition-colors border border-border-strong hover:border-black"
              >
                Add to Today's Tasks
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
