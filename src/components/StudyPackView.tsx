import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { BookOpen, Clock, Sparkles, RefreshCw, XCircle, FileText, Pencil } from 'lucide-react';
import type { StudyPack } from '../types';

interface Props {
  pack: StudyPack | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate?: () => void;
}

export function StudyPackView({ pack, loading, error, onGenerate, onRegenerate }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <DotLottieReact
          src="https://lottie.host/032219e0-ead6-4de6-a8de-4913de4a83cb/3uDAtEKI3e.lottie"
          style={{ width: 200, height: 200 }}
          autoplay
          loop
        />
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
          Generate a study pack: the AI will read the page and produce a summary, key concepts, and hands-on assignments.
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

  const summaryParagraphs = (pack.summary ?? '').split(/\n+/).filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-medium text-xl text-primary mb-0.5">{pack.docTitle}</h3>
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

      {/* Reading time */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Clock className="w-4 h-4 text-accent" />
        <span>Estimated reading time: <strong className="font-semibold text-primary">~{pack.readingMinutes} min</strong></span>
      </div>

      {/* Summary */}
      <section className="bg-white border border-border-strong rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-accent" />
          <h4 className="font-display font-medium text-lg text-primary">Page Summary</h4>
        </div>
        {summaryParagraphs.length > 0 ? (
          <div className="space-y-3">
            {summaryParagraphs.map((p, i) => (
              <p key={i} className="text-sm text-text-secondary leading-relaxed">{p}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">No summary available.</p>
        )}
      </section>

      {/* Key concepts */}
      {pack.conceptList.length > 0 && (
        <section className="bg-white border border-border-strong rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-accent" />
            <h4 className="font-display font-medium text-lg text-primary">Key Concepts</h4>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {pack.conceptList.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 bg-canvas border border-border-strong rounded-xl px-4 py-3">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-text-secondary leading-snug">{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Assignments */}
      {pack.assignments.length > 0 && (
        <section className="bg-white border border-border-strong rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Pencil className="w-4 h-4 text-accent" />
            <h4 className="font-display font-medium text-lg text-primary">Assignments</h4>
          </div>
          <ol className="space-y-4">
            {pack.assignments.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">{a}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
