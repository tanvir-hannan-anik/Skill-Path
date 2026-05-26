import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, CheckCircle, Send, Volume2, History, ChevronLeft } from 'lucide-react';
import {
  getDailyVocabulary,
  getUserSentences,
  saveUserSentence,
  getVocabDateHistory,
  type VocabWord,
} from '../lib/softSkills';
import { useAuth } from '../lib/AuthContext';
import { toDateKey } from '../lib/dates';

type View = 'today' | 'history' | 'past-date';

export function VocabularyPage() {
  const { user } = useAuth();
  const today = toDateKey();
  const [view, setView] = useState<View>('today');
  const [pastDate, setPastDate] = useState<string | null>(null);

  function openPastDate(date: string) {
    setPastDate(date);
    setView('past-date');
  }

  return (
    <div className="max-w-4xl mx-auto w-full py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          {view !== 'today' && (
            <button
              onClick={() => setView(view === 'past-date' ? 'history' : 'today')}
              className="w-9 h-9 rounded-xl bg-white border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
              title="Back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-2xl text-primary">English Vocabulary</h1>
            <p className="text-text-muted text-sm">
              {view === 'today'
                ? '10 new words every day'
                : view === 'history'
                ? 'Your word history'
                : pastDate
                ? formatDate(pastDate)
                : ''}
            </p>
          </div>
        </div>

        {view === 'today' && (
          <button
            onClick={() => setView('history')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary border border-border-strong rounded-2xl hover:text-primary hover:border-primary/30 transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </button>
        )}
      </div>

      {view === 'today' && (
        <DailyWords uid={user?.uid ?? null} date={today} isToday />
      )}
      {view === 'history' && (
        <VocabHistory uid={user?.uid ?? null} today={today} onSelectDate={openPastDate} />
      )}
      {view === 'past-date' && pastDate && (
        <DailyWords uid={user?.uid ?? null} date={pastDate} isToday={false} />
      )}
    </div>
  );
}

// ---- Daily Words view -------------------------------------------------------

interface DailyWordsProps {
  uid: string | null;
  date: string;
  isToday: boolean;
}

function DailyWords({ uid, date, isToday }: DailyWordsProps) {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentences, setSentences] = useState<Record<number, string>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [justSaved, setJustSaved] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getDailyVocabulary(date),
      getUserSentences(uid, date),
    ])
      .then(([w, s]) => {
        if (cancelled) return;
        setWords(w);
        setSentences(s);
        setDrafts(s);
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [uid, date]);

  async function handleSave(idx: number) {
    const sentence = (drafts[idx] ?? '').trim();
    if (!sentence) return;
    await saveUserSentence(uid, date, idx, sentence);
    setSentences((prev) => ({ ...prev, [idx]: sentence }));
    setJustSaved((prev) => ({ ...prev, [idx]: true }));
    setTimeout(() => setJustSaved((prev) => ({ ...prev, [idx]: false })), 2000);
  }

  function speak(text: string) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }

  if (loading) return <WordSkeleton />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  const completedCount = Object.keys(sentences).length;

  return (
    <>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-muted">
            {isToday ? formatDate(date) : formatDate(date)} · {completedCount}/10 sentences written
          </span>
          {completedCount === 10 && (
            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-0.5">
              All done! 🎉
            </span>
          )}
        </div>
        <div className="h-1.5 bg-border-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Word cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {words.map((word, idx) => (
          <WordCard
            key={idx}
            word={word}
            index={idx}
            draft={drafts[idx] ?? ''}
            savedSentence={sentences[idx]}
            justSaved={justSaved[idx] ?? false}
            readOnly={!isToday}
            onDraftChange={(v) => setDrafts((prev) => ({ ...prev, [idx]: v }))}
            onSave={() => handleSave(idx)}
            onSpeak={() => speak(`${word.word}. ${word.exampleSentence}`)}
          />
        ))}
      </div>
    </>
  );
}

// ---- Vocab History view -----------------------------------------------------

interface VocabHistoryProps {
  uid: string | null;
  today: string;
  onSelectDate: (date: string) => void;
}

function VocabHistory({ uid: _uid, today, onSelectDate }: VocabHistoryProps) {
  const [pastDates, setPastDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVocabDateHistory(14)
      .then((dates) => setPastDates(dates.filter((d) => d !== today)))
      .catch(() => setPastDates([]))
      .finally(() => setLoading(false));
  }, [today]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-white border border-border-strong rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (pastDates.length === 0) {
    return (
      <div className="bg-white border border-border-strong rounded-2xl p-10 text-center text-text-muted text-sm">
        No past vocabulary yet. Check back after your first day!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-muted mb-4">
        Select a past day to review its words and your sentences.
      </p>
      {pastDates.map((date) => (
        <button
          key={date}
          onClick={() => onSelectDate(date)}
          className="w-full flex items-center justify-between px-5 py-4 bg-white border border-border-strong rounded-2xl hover:border-primary/30 hover:shadow-md transition-all text-left group"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5">
              {formatDate(date)}
            </p>
            <p className="text-sm font-medium text-primary">10 vocabulary words</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-text-muted rotate-180 group-hover:translate-x-0.5 transition-transform" />
        </button>
      ))}
    </div>
  );
}

// ---- Word Card --------------------------------------------------------------

interface WordCardProps {
  word: VocabWord;
  index: number;
  draft: string;
  savedSentence?: string;
  justSaved: boolean;
  readOnly: boolean;
  onDraftChange: (v: string) => void;
  onSave: () => void;
  onSpeak: () => void;
}

const POS_COLORS: Record<string, string> = {
  noun: 'bg-blue-50 text-blue-600 border-blue-100',
  verb: 'bg-green-50 text-green-600 border-green-100',
  adjective: 'bg-purple-50 text-purple-600 border-purple-100',
  adverb: 'bg-orange-50 text-orange-600 border-orange-100',
  phrase: 'bg-pink-50 text-pink-600 border-pink-100',
};

function WordCard({
  word, index, draft, savedSentence, justSaved, readOnly,
  onDraftChange, onSave, onSpeak,
}: WordCardProps) {
  const posClass =
    POS_COLORS[word.partOfSpeech?.toLowerCase()] ?? 'bg-gray-50 text-gray-600 border-gray-100';
  const hasSaved = Boolean(savedSentence);

  return (
    <div className="bg-white border border-border-strong rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      {/* Word + pronounce */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] font-bold text-primary/40">#{index + 1}</span>
            <h3 className="font-display font-semibold text-xl text-primary">{word.word}</h3>
          </div>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${posClass}`}>
            {word.partOfSpeech}
          </span>
        </div>
        <button
          onClick={onSpeak}
          className="w-8 h-8 rounded-full bg-primary/8 text-primary flex items-center justify-center hover:bg-primary/15 transition-colors shrink-0"
          title="Hear pronunciation"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bengali meaning */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 block mb-0.5">
          বাংলা অর্থ
        </span>
        <p className="text-amber-900 font-medium text-sm leading-snug">{word.banglaMeaning}</p>
      </div>

      {/* Example sentence */}
      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted block mb-1">
          Example
        </span>
        <p className="text-text-secondary text-sm italic leading-relaxed">
          "{word.exampleSentence}"
        </p>
      </div>

      {/* User sentence */}
      <div className="mt-auto pt-2 border-t border-border-subtle">
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted block mb-2">
          Your Sentence
        </span>

        {hasSaved ? (
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            <p className="text-green-800 text-sm leading-relaxed">{savedSentence}</p>
          </div>
        ) : readOnly ? (
          <p className="text-text-muted text-xs italic">No sentence written for this day.</p>
        ) : (
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
              placeholder={`Use "${word.word}" in a sentence…`}
              className="flex-1 border border-border-strong rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/50 transition-colors min-w-0"
            />
            <button
              onClick={onSave}
              disabled={!draft.trim()}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                justSaved
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-40'
              }`}
              title="Save sentence"
            >
              {justSaved ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Helpers ----------------------------------------------------------------

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function WordSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="bg-white border border-border-strong rounded-2xl p-5 animate-pulse">
          <div className="h-6 bg-border-subtle rounded w-1/3 mb-2" />
          <div className="h-4 bg-border-subtle rounded w-1/4 mb-4" />
          <div className="h-10 bg-amber-50 rounded-xl mb-3" />
          <div className="h-4 bg-border-subtle rounded w-full mb-1" />
          <div className="h-4 bg-border-subtle rounded w-5/6 mb-4" />
          <div className="h-9 bg-border-subtle rounded-xl" />
        </div>
      ))}
    </div>
  );
}

