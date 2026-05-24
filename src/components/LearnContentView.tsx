import { useState, ReactNode, useEffect } from 'react';
import { Play, FileText, CheckCircle2, ClipboardList, Calendar, StickyNote, HelpCircle, ExternalLink } from 'lucide-react';
import { ContentTypePill, DayContent, Resource, QuizPlan, AssignmentPlan, NotePlan } from '../types';
import { VideoMode } from './VideoMode';
import { DocsMode } from './DocsMode';
import { NotesMode } from './NotesMode';
import { motion } from 'motion/react';
import { parseDateKey } from '../lib/dates';

interface Props {
  date: string;
  day: DayContent;
  onUpdateDay: (data: DayContent) => void;
}

const DIFFICULTY_COLORS = {
  Easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Hard: 'bg-red-100 text-red-700 border-red-200',
};

const PILLS: { id: ContentTypePill; label: string; icon: ReactNode }[] = [
  { id: 'video', label: 'Video', icon: <Play className="w-[14px] h-[14px]" /> },
  { id: 'docs', label: 'Documentation', icon: <FileText className="w-[14px] h-[14px]" /> },
  { id: 'notes', label: 'Notes', icon: <StickyNote className="w-[14px] h-[14px]" /> },
  { id: 'quiz', label: 'Knowledge Check', icon: <CheckCircle2 className="w-[14px] h-[14px]" /> },
  { id: 'assignment', label: 'Daily Task', icon: <ClipboardList className="w-[14px] h-[14px]" /> },
];

export function LearnContentView({ date, day, onUpdateDay }: Props) {
  const [activePill, setActivePill] = useState<ContentTypePill>('video');
  const [titleDraft, setTitleDraft] = useState(day.topicTitle ?? '');

  useEffect(() => {
    setTitleDraft(day.topicTitle ?? '');
  }, [date, day.topicTitle]);

  const friendlyDate = (() => {
    try {
      return parseDateKey(date).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
      });
    } catch { return date; }
  })();

  const updateTitle = (value: string) => {
    setTitleDraft(value);
    onUpdateDay({ ...day, topicTitle: value });
  };

  const handleAddVideo = (v: Resource) => {
    const updates: Partial<DayContent> = { videos: [...day.videos, v] };
    if (!day.topicTitle?.trim()) updates.topicTitle = v.title;
    onUpdateDay({ ...day, ...updates });
  };

  const handleAddNote = (note: NotePlan) => {
    onUpdateDay({ ...day, notes: [...(day.notes ?? []), note] });
  };

  const handleRemoveNote = (id: string) => {
    onUpdateDay({ ...day, notes: (day.notes ?? []).filter(n => n.id !== id) });
  };

  // Dot badge counts for pills
  const counts: Partial<Record<ContentTypePill, number>> = {
    video: day.videos?.length ?? 0,
    docs: day.docs?.length ?? 0,
    notes: day.notes?.length ?? 0,
    quiz: day.quizzes?.length ?? 0,
    assignment: day.assignments?.length ?? 0,
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 w-full">
      {/* Date chip */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-canvas rounded-lg border border-border-strong text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{friendlyDate}</span>
      </motion.div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 mb-6 sm:mb-8">
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => updateTitle(e.target.value)}
          aria-label="Topic title"
          className="font-display font-medium text-2xl sm:text-3xl lg:text-4xl text-primary tracking-tight leading-tight bg-transparent border-none outline-none placeholder:text-text-muted/40 w-full focus:ring-0 p-0 m-0 min-w-0 flex-1"
          placeholder="Untitled topic"
        />

        <div className="flex flex-wrap gap-1.5 p-1.5 bg-canvas/80 backdrop-blur border border-border-strong rounded-2xl w-fit max-w-full overflow-x-auto shrink-0">
          {PILLS.map((p) => {
            const isActive = activePill === p.id;
            const count = counts[p.id] ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => setActivePill(p.id)}
                className="relative flex items-center gap-2 h-10 px-3 sm:px-4 rounded-xl text-sm font-medium transition-colors outline-none whitespace-nowrap"
                aria-pressed={isActive}
              >
                {isActive && (
                  <motion.div
                    layoutId="pillIndicator"
                    className="absolute inset-0 bg-white shadow-sm border border-border-strong rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={`relative z-10 flex items-center gap-1.5 ${isActive ? 'text-primary' : 'text-text-muted hover:text-primary'}`}>
                  {p.icon}
                  <span className="hidden sm:inline">{p.label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${isActive ? 'bg-primary text-white' : 'bg-border-strong text-text-secondary'}`}>
                      {count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        key={activePill}
        initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="min-h-[400px]"
      >
        {activePill === 'video' && (
          <VideoMode
            videos={day.videos}
            onAddVideo={handleAddVideo}
            onRemoveVideo={(url) => onUpdateDay({ ...day, videos: day.videos.filter(v => v.url !== url) })}
          />
        )}
        {activePill === 'docs' && (
          <DocsMode
            docs={day.docs}
            onAddDoc={(d) => onUpdateDay({ ...day, docs: [...day.docs, d] })}
            onRemoveDoc={(url) => onUpdateDay({ ...day, docs: day.docs.filter(d => d.url !== url) })}
          />
        )}
        {activePill === 'notes' && (
          <NotesMode
            notes={day.notes ?? []}
            onAddNote={handleAddNote}
            onRemoveNote={handleRemoveNote}
          />
        )}
        {activePill === 'quiz' && (
          <QuizSection quizzes={day.quizzes ?? []} />
        )}
        {activePill === 'assignment' && (
          <AssignmentSection assignments={day.assignments ?? []} />
        )}
      </motion.div>
    </div>
  );
}

// ---- Quiz section -----------------------------------------------------------

function QuizSection({ quizzes }: { quizzes: QuizPlan[] }) {
  if (quizzes.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="w-8 h-8 text-text-muted" />}
        title="No quizzes planned"
        body="Go to the Plan section and add a quiz to this day. You can set the topic and number of questions."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-display font-medium text-lg text-primary">Today's Knowledge Checks</h4>
      {quizzes.map(q => (
        <div key={q.id} className="bg-white border border-border-strong rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-primary">{q.count} question{q.count !== 1 ? 's' : ''}</p>
            {q.topic && <p className="text-sm text-text-muted mt-0.5">Topic: {q.topic}</p>}
          </div>
          <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">Planned</span>
        </div>
      ))}
      <div className="bg-canvas border border-dashed border-border-strong rounded-2xl p-6 text-center">
        <p className="text-sm text-text-secondary">AI-generated quiz questions coming soon.</p>
        <p className="text-xs text-text-muted mt-1">Questions will be based on your videos and documentation.</p>
      </div>
    </div>
  );
}

// ---- Assignment section -----------------------------------------------------

function AssignmentSection({ assignments }: { assignments: AssignmentPlan[] }) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-8 h-8 text-text-muted" />}
        title="No assignments planned"
        body="Go to the Plan section and add an assignment to this day. You can set the difficulty level."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-display font-medium text-lg text-primary">Today's Assignments</h4>
      {assignments.map(a => (
        <div key={a.id} className="bg-white border border-border-strong rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-primary">{a.title}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0 ${DIFFICULTY_COLORS[a.difficulty]}`}>
            {a.difficulty}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- Shared empty state -----------------------------------------------------

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="bg-canvas border border-border-strong rounded-[24px] sm:rounded-[32px] p-10 sm:p-16 lg:p-24 text-center flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-6">
        {icon}
      </div>
      <h3 className="font-display text-2xl font-medium text-primary mb-2">{title}</h3>
      <p className="text-text-secondary max-w-sm">{body}</p>
    </div>
  );
}
