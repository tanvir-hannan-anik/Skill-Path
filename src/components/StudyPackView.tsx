import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Clock, CheckCircle2, XCircle, Eye, EyeOff, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import type { StudyPack, QuizQuestion, PracticeProblem } from '../types';

interface Props {
  pack: StudyPack | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate?: () => void;
}

/**
 * Renders an AI-generated study pack for a documentation page.
 *
 * Solutions to practice problems are hidden by default — the user must click
 * "Show solution" to reveal each one (to encourage real attempts before peeking).
 */
export function StudyPackView({ pack, loading, error, onGenerate, onRegenerate }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-secondary">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Generating your study pack…</p>
        <p className="text-xs text-text-muted">This usually takes 5–15 seconds.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-700 flex items-start gap-3">
        <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold mb-1">Could not generate study pack</p>
          <p>{error}</p>
          <button
            onClick={onGenerate}
            className="mt-3 px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="bg-canvas border border-dashed border-border-strong rounded-2xl p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-white border border-border-strong flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-5 h-5 text-accent" />
        </div>
        <h3 className="font-display font-medium text-lg text-primary mb-2">No study pack yet</h3>
        <p className="text-sm text-text-secondary mb-5 max-w-md mx-auto">
          Generate a personalised study pack: key concepts, reading time, quiz, assignments, and practice problems.
        </p>
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Generate study pack
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header: concepts + reading time */}
      <div className="bg-white border border-border-strong rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-display font-medium text-xl text-primary mb-1">{pack.docTitle}</h3>
            <p className="text-xs text-text-muted truncate">{pack.docUrl}</p>
          </div>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              aria-label="Regenerate study pack"
              title="Regenerate"
              className="w-9 h-9 rounded-full border border-border-strong bg-canvas hover:bg-white text-text-secondary hover:text-primary transition-colors flex items-center justify-center shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4 text-sm text-text-secondary">
          <Clock className="w-4 h-4" />
          <span>
            <strong className="font-semibold text-primary">~{pack.readingMinutes} min</strong> to read
          </span>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Key concepts</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pack.conceptList.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <BookOpen className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quiz */}
      <Quiz questions={pack.quiz} />

      {/* Assignments */}
      <section className="bg-white border border-border-strong rounded-2xl p-5 sm:p-6">
        <h4 className="font-display font-medium text-lg text-primary mb-4">Assignments</h4>
        <ol className="space-y-3 list-decimal list-inside text-sm text-text-secondary marker:text-text-muted">
          {pack.assignments.map((a, i) => (
            <li key={i} className="leading-relaxed">{a}</li>
          ))}
        </ol>
      </section>

      {/* Problems */}
      <section className="space-y-4">
        <h4 className="font-display font-medium text-lg text-primary">Practice problems</h4>
        <ProblemGroup title="Easy" tone="emerald" problems={pack.problems.easy} />
        <ProblemGroup title="Medium" tone="amber" problems={pack.problems.medium} />
        <ProblemGroup title="Hard" tone="rose" problems={pack.problems.hard} />
      </section>
    </div>
  );
}

function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const correct = questions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? 1 : 0), 0);

  return (
    <section className="bg-white border border-border-strong rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display font-medium text-lg text-primary">Knowledge check</h4>
        {submitted && (
          <span className="text-xs font-bold uppercase tracking-widest text-text-muted">
            {correct} / {questions.length} correct
          </span>
        )}
      </div>

      <div className="space-y-5">
        {questions.map((q, qi) => (
          <div key={qi}>
            <p className="text-sm font-medium text-primary mb-2">
              <span className="text-text-muted mr-1">{qi + 1}.</span>
              {q.q}
            </p>
            <div className="space-y-1.5">
              {q.choices.map((c, ci) => {
                const isPicked = answers[qi] === ci;
                const isCorrect = q.answer === ci;
                const showResult = submitted;
                return (
                  <button
                    key={ci}
                    type="button"
                    onClick={() => !submitted && setAnswers((a) => ({ ...a, [qi]: ci }))}
                    disabled={submitted}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-colors flex items-center gap-3 ${
                      showResult && isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : showResult && isPicked && !isCorrect ? 'bg-red-50 border-red-300 text-red-900'
                      : isPicked ? 'bg-canvas border-primary text-primary'
                      : 'bg-canvas border-border-strong text-text-secondary hover:border-primary/30'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                      {String.fromCharCode(65 + ci)}
                    </span>
                    <span className="flex-1">{c}</span>
                    {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {showResult && isPicked && !isCorrect && <XCircle className="w-4 h-4 text-red-600" />}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <p className="text-xs text-text-secondary mt-2 ml-1 leading-relaxed">
                <strong className="text-primary">Why:</strong> {q.explanation}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={submitted || Object.keys(answers).length < questions.length}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitted ? 'Submitted' : 'Check answers'}
        </button>
        {submitted && (
          <button
            type="button"
            onClick={() => { setAnswers({}); setSubmitted(false); }}
            className="px-4 py-2.5 bg-canvas border border-border-strong text-text-secondary text-sm font-medium rounded-xl hover:text-primary transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </section>
  );
}

function ProblemGroup({ title, tone, problems }: { title: string; tone: 'emerald' | 'amber' | 'rose'; problems: PracticeProblem[] }) {
  const toneClass = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
  }[tone];

  return (
    <div className="bg-white border border-border-strong rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${toneClass}`}>{title}</span>
      </div>
      <div className="space-y-4">
        {problems.map((p, i) => <Problem key={i} problem={p} />)}
      </div>
    </div>
  );
}

function Problem({ problem }: { problem: PracticeProblem }) {
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  return (
    <div className="border-l-2 border-border-strong pl-4">
      <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">{problem.prompt}</p>
      <div className="flex items-center gap-2 mt-3">
        {problem.hint && (
          <button
            type="button"
            onClick={() => setShowHint((s) => !s)}
            className="text-xs font-medium text-text-secondary hover:text-primary inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-canvas border border-border-strong transition-colors"
          >
            {showHint ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowSolution((s) => !s)}
          className="text-xs font-medium text-text-secondary hover:text-primary inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-canvas border border-border-strong transition-colors"
        >
          {showSolution ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showSolution ? 'Hide solution' : 'Show solution'}
        </button>
      </div>
      <AnimatePresence>
        {showHint && problem.hint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 leading-relaxed">
              <strong className="font-semibold">Hint:</strong> {problem.hint}
            </div>
          </motion.div>
        )}
        {showSolution && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900 leading-relaxed whitespace-pre-wrap font-mono">
              {problem.solution}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
