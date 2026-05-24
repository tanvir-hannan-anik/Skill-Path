import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Play, FileText, Maximize2, Minimize2, CheckSquare, Circle, BookOpen, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Schedule } from '../types';
import { toDateKey } from '../lib/dates';

interface Props {
  onClose: () => void;
  schedule: Schedule;
  onSelectDate: (date: string) => void;
}

export function CalendarView({ onClose, schedule, onSelectDate }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [direction, setDirection] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const handleNext = () => {
    setDirection(1);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long' });
  const yearName = currentMonth.getFullYear();
  const blanks = Array(firstDayOfMonth).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0, scale: 0.98 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ zIndex: 0, x: d < 0 ? 50 : -50, opacity: 0, scale: 0.98 }),
  };

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col bg-canvas w-full overflow-hidden transition-all duration-500 ease-in-out relative ${isFullscreen ? 'p-4 fixed inset-0 z-[100]' : ''}`}
    >
      {/* Compact header — just month nav + controls, no title block */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-3 sm:py-4 shrink-0">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display font-medium text-2xl sm:text-3xl text-primary">{monthName}</h2>
          <span className="font-display text-lg text-text-muted">{yearName}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handlePrev} aria-label="Previous month" className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-white border border-border-strong rounded-xl hover:text-primary text-text-secondary transition-all active:scale-95">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button onClick={handleNext} aria-label="Next month" className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-white border border-border-strong rounded-xl hover:text-primary text-text-secondary transition-all active:scale-95">
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-white border border-border-strong rounded-xl text-text-secondary hover:text-primary transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          <button
            onClick={onClose}
            aria-label="Close calendar"
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-primary rounded-xl text-white hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Calendar grid — takes all remaining height */}
      <div className="flex-1 bg-white border border-border-strong flex flex-col shadow-[0_8px_40px_rgb(0,0,0,0.04)] overflow-hidden rounded-2xl sm:rounded-3xl min-h-0">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border-strong bg-canvas/40 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={d} className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted border-r border-border-strong last:border-r-0">
              <span className="hidden md:inline">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}</span>
              <span className="inline md:hidden">{d}</span>
            </div>
          ))}
        </div>

        {/* Animated month grid */}
        <div className="flex-1 relative overflow-hidden bg-border-strong min-h-0">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentMonth.toISOString()}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute inset-0 grid grid-cols-7 grid-rows-6 gap-px"
            >
              {blanks.map((_, i) => <div key={`b-${i}`} className="bg-canvas/40" />)}
              {days.map((d) => {
                const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
                const dayStr = String(d).padStart(2, '0');
                const fullDate = `${currentMonth.getFullYear()}-${m}-${dayStr}`;
                const dayData = schedule[fullDate];
                const isToday = fullDate === todayKey;

                const totalTasks = dayData?.tasks?.length ?? 0;
                const doneTasks = dayData?.tasks?.filter(t => t.done).length ?? 0;
                const hasContent = (dayData?.videos?.length || 0) + (dayData?.docs?.length || 0) + totalTasks > 0;

                const allDone = hasContent && totalTasks > 0 && doneTasks === totalTasks;
                const partialDone = hasContent && totalTasks > 0 && doneTasks > 0 && doneTasks < totalTasks;

                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDayKey(fullDate)}
                    aria-label={`Open ${fullDate}${isToday ? ' (today)' : ''}`}
                    className={`bg-white p-1.5 sm:p-2 lg:p-3 flex flex-col text-left transition-colors cursor-pointer group hover:bg-blue-50/20 relative overflow-hidden ${isToday ? 'ring-2 ring-inset ring-primary/30' : ''} ${allDone ? 'bg-emerald-50/30' : ''}`}
                  >
                    {/* Today accent bar */}
                    {isToday && <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />}

                    {/* Completion bar at bottom */}
                    {hasContent && totalTasks > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border-strong">
                        <div
                          className={`h-full transition-all ${allDone ? 'bg-emerald-500' : 'bg-amber-400'}`}
                          style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
                        />
                      </div>
                    )}

                    {/* Day number + completion badge */}
                    <div className="flex items-start justify-between gap-1 mb-1 shrink-0">
                      <span className={`text-xs sm:text-sm font-display font-medium w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                        isToday ? 'bg-primary text-white' : 'text-text-secondary group-hover:text-primary group-hover:bg-canvas'
                      }`}>
                        {d}
                      </span>

                      {hasContent && (
                        <span className={`hidden sm:flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${
                          allDone
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : partialDone
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-canvas border-border-strong text-text-secondary'
                        }`}>
                          {allDone ? '✓ Done' : partialDone ? `${doneTasks}/${totalTasks}` : totalTasks > 0 ? `0/${totalTasks}` : null}
                          {!totalTasks && hasContent && <Circle className="w-2 h-2 fill-current" />}
                        </span>
                      )}
                    </div>

                    {/* Topic title — shown prominently */}
                    {dayData?.topicTitle && (
                      <div className="hidden sm:block mb-1 shrink-0">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-primary leading-tight line-clamp-2 block">
                          {dayData.topicTitle}
                        </span>
                      </div>
                    )}

                    {/* Content items */}
                    <div className="flex-1 space-y-1 overflow-hidden hidden sm:flex flex-col">
                      {dayData?.videos?.slice(0, 2).map((vid, idx) => (
                        <div key={`v-${idx}`} className="flex items-start gap-1 bg-white/70 border border-border-strong p-1 sm:p-1.5 rounded-lg shrink-0">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-canvas flex items-center justify-center shrink-0 mt-px">
                            <Play className="w-2.5 h-2.5 text-accent" />
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-medium text-text-secondary leading-snug line-clamp-2">{vid.title}</span>
                        </div>
                      ))}
                      {dayData?.docs?.slice(0, 1).map((doc, idx) => (
                        <div key={`d-${idx}`} className="flex items-start gap-1 bg-white/70 border border-border-strong p-1 sm:p-1.5 rounded-lg shrink-0">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-canvas flex items-center justify-center shrink-0 mt-px">
                            <FileText className="w-2.5 h-2.5 text-emerald-500" />
                          </div>
                          <span className="text-[9px] sm:text-[10px] font-medium text-text-secondary leading-snug line-clamp-2">{doc.title}</span>
                        </div>
                      ))}
                      {dayData?.tasks?.slice(0, 2).map((task) => (
                        <div key={task.id} className={`flex items-start gap-1 border p-1 sm:p-1.5 rounded-lg transition-colors shrink-0 ${task.done ? 'bg-emerald-50/60 border-emerald-100 opacity-70' : 'bg-white/70 border-border-strong'}`}>
                          <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md flex items-center justify-center shrink-0 mt-px ${task.done ? 'text-emerald-500' : 'bg-canvas text-primary'}`}>
                            <CheckSquare className="w-2.5 h-2.5" />
                          </div>
                          <span className={`text-[9px] sm:text-[10px] font-medium leading-snug line-clamp-2 ${task.done ? 'line-through text-text-muted' : 'text-text-secondary'}`}>{task.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* Mobile: dot indicators */}
                    <div className="flex sm:hidden flex-wrap gap-1 mt-auto pt-1">
                      {hasContent && (
                        <div className={`w-2 h-2 rounded-full ${allDone ? 'bg-emerald-500' : partialDone ? 'bg-amber-400' : 'bg-primary'}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Day detail modal */}
      <AnimatePresence>
        {selectedDayKey && (() => {
          const dayData = schedule[selectedDayKey];
          const [year, mon, day] = selectedDayKey.split('-');
          const label = new Date(Number(year), Number(mon) - 1, Number(day)).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          const totalTasks = dayData?.tasks?.length ?? 0;
          const doneTasks = dayData?.tasks?.filter(t => t.done).length ?? 0;
          const hasAny = (dayData?.videos?.length || 0) + (dayData?.docs?.length || 0) + totalTasks > 0;

          return (
            <>
              {/* Backdrop */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-black/30 backdrop-blur-sm"
                onClick={() => setSelectedDayKey(null)}
              />

              {/* Card */}
              <motion.div
                key="card"
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="absolute inset-0 z-30 flex items-center justify-center p-4 pointer-events-none"
              >
                <div className="pointer-events-auto w-full max-w-md bg-white rounded-3xl shadow-2xl border border-border-strong flex flex-col overflow-hidden max-h-[80vh]">

                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 shrink-0">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Daily Overview</p>
                      <h3 className="font-display font-semibold text-lg text-primary leading-tight">{label}</h3>
                      {dayData?.topicTitle && (
                        <p className="text-sm text-text-secondary mt-0.5 leading-snug">{dayData.topicTitle}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedDayKey(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-canvas border border-border-strong text-text-muted hover:text-primary transition-colors shrink-0 mt-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  {totalTasks > 0 && (
                    <div className="px-5 pb-3 shrink-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-text-muted">Tasks</span>
                        <span className="text-[11px] font-bold text-text-secondary">{doneTasks}/{totalTasks} done</span>
                      </div>
                      <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${doneTasks === totalTasks ? 'bg-emerald-500' : 'bg-amber-400'}`}
                          style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-border-strong shrink-0 mx-5" />

                  {/* Activity list */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
                    {!hasAny && (
                      <p className="text-sm text-text-muted text-center py-6">No activities scheduled for this day.</p>
                    )}

                    {(dayData?.videos?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Videos</p>
                        <div className="space-y-2">
                          {dayData!.videos.map((vid, i) => (
                            <div key={i} className="flex items-center gap-3 bg-canvas border border-border-strong rounded-xl px-3 py-2.5">
                              <div className="w-8 h-8 rounded-lg bg-white border border-border-strong flex items-center justify-center shrink-0">
                                <Play className="w-3.5 h-3.5 text-accent" />
                              </div>
                              <span className="text-sm font-medium text-text-secondary leading-snug line-clamp-2">{vid.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(dayData?.docs?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Docs</p>
                        <div className="space-y-2">
                          {dayData!.docs.map((doc, i) => (
                            <div key={i} className="flex items-center gap-3 bg-canvas border border-border-strong rounded-xl px-3 py-2.5">
                              <div className="w-8 h-8 rounded-lg bg-white border border-border-strong flex items-center justify-center shrink-0">
                                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                              </div>
                              <span className="text-sm font-medium text-text-secondary leading-snug line-clamp-2">{doc.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {totalTasks > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Tasks</p>
                        <div className="space-y-2">
                          {dayData!.tasks.map((task) => (
                            <div key={task.id} className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${task.done ? 'bg-emerald-50/60 border-emerald-100' : 'bg-canvas border-border-strong'}`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${task.done ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-border-strong text-primary'}`}>
                                <CheckSquare className="w-3.5 h-3.5" />
                              </div>
                              <span className={`text-sm font-medium leading-snug ${task.done ? 'line-through text-text-muted' : 'text-text-secondary'}`}>{task.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer CTA */}
                  <div className="px-5 py-4 shrink-0 border-t border-border-strong bg-canvas/50">
                    <button
                      onClick={() => { onSelectDate(selectedDayKey); setSelectedDayKey(null); }}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold text-sm py-3 rounded-2xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
                    >
                      <BookOpen className="w-4 h-4" />
                      Go to Learn
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center gap-4 px-2 py-2 shrink-0">
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> All done
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> In progress
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted font-medium">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Scheduled
        </span>
      </div>
    </div>
  );
}
