import { useState, ReactNode, useEffect } from 'react';
import { Play, FileText, CheckCircle2, ClipboardList, Calendar, StickyNote, HelpCircle, Sparkles, Loader2, RotateCcw, ChevronRight, Trophy, AlertCircle } from 'lucide-react';
import { ContentTypePill, DayContent, Resource, QuizPlan, AssignmentPlan, NotePlan, QuizQuestion } from '../types';
import { VideoMode } from './VideoMode';
import { DocsMode } from './DocsMode';
import { NotesMode } from './NotesMode';
import { motion, AnimatePresence } from 'motion/react';
import { parseDateKey } from '../lib/dates';
import { generateTopicQuiz, generateDailyAssignments, GeneratedTask } from '../lib/studyPack';
import {
  getKnowledgeCheck, saveKnowledgeCheck,
  getDailyTasks, saveDailyTasks,
  type KnowledgeCheckRecord, type DailyTasksRecord,
} from '../lib/supabaseDb';

interface Props {
  uid: string | null;
  wsId: string;
  date: string;
  day: DayContent;
  onUpdateDay: (data: DayContent) => void;
  onScheduleVideoForDate?: (date: string, video: Resource) => void;
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

export function LearnContentView({ uid, wsId, date, day, onUpdateDay, onScheduleVideoForDate }: Props) {
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
            onScheduleVideoForDate={onScheduleVideoForDate}
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
          <QuizSection
            quizzes={day.quizzes ?? []}
            topic={day.topicTitle ?? ''}
            uid={uid}
            wsId={wsId}
            date={date}
          />
        )}
        {activePill === 'assignment' && (
          <AssignmentSection
            assignments={day.assignments ?? []}
            topic={day.topicTitle ?? ''}
            uid={uid}
            wsId={wsId}
            date={date}
          />
        )}
      </motion.div>
    </div>
  );
}

// ---- Quiz section -----------------------------------------------------------

type QuizState = 'idle' | 'loading' | 'taking' | 'done';
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

interface QuizSectionProps {
  quizzes: QuizPlan[];
  topic: string;
  uid: string | null;
  wsId: string;
  date: string;
}

function QuizSection({ quizzes, topic, uid, wsId, date }: QuizSectionProps) {
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<QuizPlan | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(null);

  const effectiveTopic = activePlan?.topic || topic;
  const canGenerate = !!effectiveTopic.trim();

  // Load saved quiz from Supabase on mount / date change
  useEffect(() => {
    if (!uid || !wsId || !date) return;
    let cancelled = false;
    getKnowledgeCheck(uid, wsId, date).then(rec => {
      if (cancelled || !rec || rec.questions.length === 0) return;
      setQuestions(rec.questions);
      setSelectedAnswers(rec.answers);
      setSavedScore(rec.score);
      setQuizState(rec.score !== null ? 'done' : rec.answers.some(a => a !== null) ? 'taking' : 'idle');
      setCurrentIdx(rec.answers.findIndex(a => a === null) === -1 ? rec.questions.length - 1 : Math.max(0, rec.answers.findIndex(a => a === null)));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [uid, wsId, date]);

  async function persist(qs: QuizQuestion[], ans: (number | null)[], score: number | null) {
    if (!uid || !wsId) return;
    const record: KnowledgeCheckRecord = {
      topic: effectiveTopic,
      questions: qs,
      answers: ans,
      score,
      generatedAt: Date.now(),
      ...(score !== null ? { completedAt: Date.now() } : {}),
    };
    saveKnowledgeCheck(uid, wsId, date, record).catch(console.error);
  }

  async function handleGenerate(plan?: QuizPlan) {
    const t = plan?.topic || topic;
    const c = plan?.count ?? 5;
    if (!t.trim()) return;
    setActivePlan(plan ?? null);
    setQuizState('loading');
    setError(null);
    try {
      const qs = await generateTopicQuiz(t, c);
      const emptyAnswers = new Array(qs.length).fill(null);
      setQuestions(qs);
      setSelectedAnswers(emptyAnswers);
      setSavedScore(null);
      setCurrentIdx(0);
      setShowExplanation(false);
      setQuizState('taking');
      persist(qs, emptyAnswers, null);
    } catch (err) {
      setError((err as Error).message);
      setQuizState('idle');
    }
  }

  function handleSelect(choiceIdx: number) {
    if (selectedAnswers[currentIdx] !== null) return;
    const updated = [...selectedAnswers];
    updated[currentIdx] = choiceIdx;
    setSelectedAnswers(updated);
    setShowExplanation(true);
    persist(questions, updated, null);
  }

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setShowExplanation(false);
    } else {
      const score = selectedAnswers.filter((a, i) => a === questions[i]?.answer).length;
      setSavedScore(score);
      setQuizState('done');
      persist(questions, selectedAnswers, score);
    }
  }

  function handleRetake() {
    const emptyAnswers = new Array(questions.length).fill(null);
    setSelectedAnswers(emptyAnswers);
    setSavedScore(null);
    setCurrentIdx(0);
    setShowExplanation(false);
    setQuizState('taking');
    persist(questions, emptyAnswers, null);
  }

  function handleReset() {
    setQuizState('idle');
    setQuestions([]);
    setActivePlan(null);
    setError(null);
    setSavedScore(null);
  }

  // ---- Idle / loading ----
  if (quizState === 'idle' || quizState === 'loading') {
    const isLoading = quizState === 'loading';
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-display font-medium text-lg text-primary">Knowledge Check</h4>
          {!quizzes.length && canGenerate && (
            <button
              onClick={() => handleGenerate()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isLoading ? 'Generating…' : 'Generate Quiz'}
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {quizzes.length > 0 ? (
          <div className="space-y-3">
            {quizzes.map(q => {
              const isThisLoading = isLoading && activePlan?.id === q.id;
              return (
                <div key={q.id} className="bg-white border border-border-strong rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-primary">{q.count} question{q.count !== 1 ? 's' : ''}</p>
                    {q.topic && <p className="text-sm text-text-muted mt-0.5">{q.topic}</p>}
                  </div>
                  <button
                    onClick={() => handleGenerate(q)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isThisLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {isThisLoading ? 'Generating…' : 'Start'}
                  </button>
                </div>
              );
            })}
            {isLoading && !activePlan && (
              <div className="text-center py-4 text-sm text-text-muted flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating quiz questions…
              </div>
            )}
          </div>
        ) : canGenerate ? (
          isLoading ? (
            <div className="bg-canvas border border-border-strong rounded-[24px] p-12 text-center flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-text-secondary font-medium">Generating quiz questions…</p>
              <p className="text-xs text-text-muted">This usually takes 5–10 seconds.</p>
            </div>
          ) : (
            <div className="bg-canvas border border-dashed border-border-strong rounded-[24px] p-12 text-center flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <HelpCircle className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-primary">Ready to test your knowledge?</p>
                <p className="text-sm text-text-muted mt-1">Generate a quiz on <strong>{effectiveTopic}</strong> using AI.</p>
              </div>
              <button
                onClick={() => handleGenerate()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="w-4 h-4" /> Generate Quiz
              </button>
            </div>
          )
        ) : (
          <EmptyState
            icon={<CheckCircle2 className="w-8 h-8 text-text-muted" />}
            title="No topic set"
            body="Add a topic title for today or go to the Plan section to set up a knowledge check."
          />
        )}
      </div>
    );
  }

  // ---- Taking quiz ----
  if (quizState === 'taking') {
    const q = questions[currentIdx];
    const selected = selectedAnswers[currentIdx];
    const progress = ((currentIdx + (selected !== null ? 1 : 0)) / questions.length) * 100;

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
              Question {currentIdx + 1} of {questions.length}
            </p>
            {(activePlan?.topic || topic) && (
              <p className="text-sm text-text-secondary mt-0.5">{activePlan?.topic || topic}</p>
            )}
          </div>
          <button onClick={handleReset} className="text-xs text-text-muted hover:text-primary flex items-center gap-1 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Quit
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-canvas border border-border-strong rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="bg-white border border-border-strong rounded-2xl p-6 space-y-5"
          >
            <p className="font-display font-medium text-lg text-primary leading-snug">{q.q}</p>

            <div className="space-y-2.5">
              {q.choices.map((choice, i) => {
                let cls = 'border-border-strong bg-canvas text-primary hover:border-primary hover:bg-primary/5';
                if (selected !== null) {
                  if (i === q.answer) cls = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                  else if (i === selected) cls = 'border-red-400 bg-red-50 text-red-900';
                  else cls = 'border-border-strong bg-canvas text-text-muted opacity-60';
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    disabled={selected !== null}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left text-sm font-medium transition-colors ${cls}`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      selected === null ? 'bg-white border border-border-strong text-text-secondary'
                      : i === q.answer ? 'bg-emerald-500 text-white'
                      : i === selected ? 'bg-red-500 text-white'
                      : 'bg-border-strong text-text-muted'
                    }`}>
                      {CHOICE_LABELS[i]}
                    </span>
                    {choice}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                    <p className="font-semibold mb-1">Explanation</p>
                    <p>{q.explanation}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next button */}
            {selected !== null && (
              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  {currentIdx < questions.length - 1 ? 'Next Question' : 'See Results'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ---- Results ----
  const score = savedScore ?? selectedAnswers.filter((a, i) => a === questions[i]?.answer).length;
  const pct = Math.round((score / questions.length) * 100);
  const scoreColor = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = pct >= 80 ? 'bg-emerald-50 border-emerald-200' : pct >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="space-y-5">
      {/* Score card */}
      <div className={`${scoreBg} border rounded-2xl p-6 text-center`}>
        <Trophy className={`w-8 h-8 mx-auto mb-2 ${scoreColor}`} />
        <p className={`font-display text-4xl font-medium ${scoreColor}`}>{score}/{questions.length}</p>
        <p className="text-text-secondary text-sm mt-1">{pct}% correct</p>
        <p className="text-text-muted text-xs mt-0.5">
          {pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good effort — review the explanations below.' : 'Keep studying — check the explanations below.'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handleRetake} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-canvas border border-border-strong rounded-xl text-sm font-medium text-primary hover:bg-white transition-colors">
          <RotateCcw className="w-4 h-4" /> Retake
        </button>
        <button onClick={() => handleGenerate(activePlan ?? undefined)} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
          <Sparkles className="w-4 h-4" /> New Quiz
        </button>
      </div>

      {/* Question review */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Review</p>
        {questions.map((q, i) => {
          const userAnswer = selectedAnswers[i];
          const correct = userAnswer === q.answer;
          return (
            <div key={i} className={`bg-white border rounded-2xl p-5 space-y-3 ${correct ? 'border-emerald-200' : 'border-red-200'}`}>
              <div className="flex items-start gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                  {correct ? '✓' : '✗'}
                </span>
                <p className="font-medium text-primary text-sm">{q.q}</p>
              </div>
              {!correct && userAnswer !== null && (
                <p className="text-xs text-red-600 pl-7">Your answer: {q.choices[userAnswer]}</p>
              )}
              <p className="text-xs text-emerald-700 pl-7">Correct: {q.choices[q.answer]}</p>
              <p className="text-xs text-text-secondary pl-7 bg-canvas rounded-lg p-2.5">{q.explanation}</p>
            </div>
          );
        })}
      </div>

      <button onClick={handleReset} className="text-xs text-text-muted hover:text-primary transition-colors flex items-center gap-1">
        <RotateCcw className="w-3 h-3" /> Back to quiz list
      </button>
    </div>
  );
}

// ---- Assignment section -----------------------------------------------------

interface AssignmentSectionProps {
  assignments: AssignmentPlan[];
  topic: string;
  uid: string | null;
  wsId: string;
  date: string;
}

function AssignmentSection({ assignments, topic, uid, wsId, date }: AssignmentSectionProps) {
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());

  const canGenerate = !!topic.trim();

  // Load saved tasks from Supabase on mount / date change
  useEffect(() => {
    if (!uid || !wsId || !date) return;
    let cancelled = false;
    getDailyTasks(uid, wsId, date).then(rec => {
      if (cancelled || !rec || rec.tasks.length === 0) return;
      setGeneratedTasks(rec.tasks);
      setDone(new Set(rec.doneIds));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [uid, wsId, date]);

  function persistTasks(tasks: GeneratedTask[], doneIds: string[]) {
    if (!uid || !wsId) return;
    const record: DailyTasksRecord = { tasks, doneIds, generatedAt: Date.now() };
    saveDailyTasks(uid, wsId, date, record).catch(console.error);
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    try {
      const tasks = await generateDailyAssignments(topic);
      setGeneratedTasks(tasks);
      setExpanded(new Set());
      setDone(new Set());
      persistTasks(tasks, []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleDone(id: string) {
    setDone(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (generatedTasks) persistTasks(generatedTasks, [...next]);
      return next;
    });
  }

  const hasPlan = assignments.length > 0;
  const hasGenerated = !!generatedTasks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display font-medium text-lg text-primary">Daily Tasks</h4>
        {canGenerate && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generating…' : hasGenerated ? 'Regenerate' : 'Generate AI Tasks'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Planned assignments (from Plan section) */}
      {hasPlan && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Planned</p>
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
      )}

      {/* AI-generated tasks */}
      {loading && !hasGenerated && (
        <div className="bg-canvas border border-border-strong rounded-[24px] p-12 text-center flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-text-secondary font-medium">Generating tasks for today…</p>
          <p className="text-xs text-text-muted">Tailored to: <strong>{topic}</strong></p>
        </div>
      )}

      {hasGenerated && (
        <div className="space-y-2">
          {hasPlan && <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">AI-Generated</p>}
          {generatedTasks!.map(task => {
            const isExpanded = expanded.has(task.id);
            const isDone = done.has(task.id);
            return (
              <div key={task.id} className={`bg-white border rounded-2xl overflow-hidden transition-colors ${isDone ? 'border-emerald-200 opacity-70' : 'border-border-strong'}`}>
                <div className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => toggleDone(task.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border-strong hover:border-emerald-400'}`}
                  >
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${isDone ? 'line-through text-text-muted' : 'text-primary'}`}>{task.title}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border shrink-0 ${DIFFICULTY_COLORS[task.difficulty]}`}>
                    {task.difficulty}
                  </span>
                  <button
                    onClick={() => toggleExpand(task.id)}
                    className="text-text-muted hover:text-primary transition-colors shrink-0"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 border-t border-border-strong pt-3 bg-canvas">
                        <p className="text-sm text-text-secondary leading-relaxed">{task.description}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Completion summary */}
          {done.size > 0 && (
            <p className="text-xs text-text-muted text-right">
              {done.size}/{generatedTasks!.length} tasks completed
            </p>
          )}
        </div>
      )}

      {/* Empty state when no plan AND no generated tasks AND no topic */}
      {!hasPlan && !hasGenerated && !loading && !canGenerate && (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8 text-text-muted" />}
          title="No tasks yet"
          body="Add a topic title for today to generate AI-powered tasks, or go to the Plan section to add assignments manually."
        />
      )}

      {/* Prompt to generate when topic exists but nothing generated */}
      {!hasPlan && !hasGenerated && !loading && canGenerate && (
        <div className="bg-canvas border border-dashed border-border-strong rounded-[24px] p-12 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
            <ClipboardList className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-primary">Get your daily tasks</p>
            <p className="text-sm text-text-muted mt-1">Generate 3 practical tasks (Easy / Medium / Hard) for <strong>{topic}</strong>.</p>
          </div>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate Tasks
          </button>
        </div>
      )}
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
