import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, BookOpen, Mic, MicOff, Volume2, VolumeX,
  Send, Loader2, History, ChevronDown, ChevronUp,
  Pause, Play, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  getDailyStory,
  getStoryHistory,
  streamVoiceChat,
  type VoiceStory,
  type StoryHistoryEntry,
  type GeminiMessage,
} from '../lib/softSkills';
import { toDateKey } from '../lib/dates';

type Tab = 'story' | 'chat' | 'history';

// ---- Browser Speech API helpers ---------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Pick the best available English TTS voice. */
function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    'Google US English',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Samantha', // macOS
    'Alex',     // macOS
  ];
  for (const name of preferred) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  // Fallback: any en-US voice, then any en voice
  return (
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  );
}

function speakText(text: string, onEnd?: () => void): () => void {
  window.speechSynthesis.cancel();

  const doSpeak = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = getBestVoice();
    u.lang = 'en-US';
    u.rate = 0.85;
    u.pitch = 1.05;
    u.volume = 1;

    // Chrome bug: long utterances are silently cut after ~15s. Keep-alive workaround.
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    u.onend = () => {
      clearInterval(keepAlive);
      onEnd?.();
    };
    u.onerror = () => {
      clearInterval(keepAlive);
      onEnd?.();
    };

    window.speechSynthesis.speak(u);
    return () => clearInterval(keepAlive);
  };

  // Voices may not be loaded yet on first call
  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
  }

  return () => window.speechSynthesis.cancel();
}

/**
 * Improved word comparison: checks if each original word appears anywhere in
 * the spoken words (bag-of-words match, consuming duplicates), which is fairer
 * for out-of-order speech.
 */
function compareTexts(original: string, spoken: string) {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

  const orig = normalize(original);
  const said = normalize(spoken);

  // Build mutable count map of what was spoken
  const pool = new Map<string, number>();
  said.forEach((w) => pool.set(w, (pool.get(w) ?? 0) + 1));

  const wordResults = orig.map((w) => {
    const count = pool.get(w) ?? 0;
    if (count > 0) {
      pool.set(w, count - 1);
      return { word: w, correct: true };
    }
    return { word: w, correct: false };
  });

  const accuracy =
    orig.length > 0
      ? wordResults.filter((w) => w.correct).length / orig.length
      : 0;

  return { wordResults, accuracy };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Split story text into individual sentences. */
function splitSentences(text: string): string[] {
  const raw = text.match(/[^.!?]*[.!?]+/g) ?? [text];
  return raw.map((s) => s.trim()).filter(Boolean);
}

// ---- Main page --------------------------------------------------------------

export function CommunicationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('story');

  return (
    <div className="max-w-3xl mx-auto w-full py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display font-semibold text-2xl text-primary">Communication</h1>
          <p className="text-text-muted text-sm">Practice your English speaking skills with AI</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: 'story' as Tab, label: "Today's Story", icon: <BookOpen className="w-4 h-4" /> },
          { id: 'chat' as Tab, label: 'Voice Chat', icon: <MessageCircle className="w-4 h-4" /> },
          { id: 'history' as Tab, label: 'Past Stories', icon: <History className="w-4 h-4" /> },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white border border-border-strong text-text-secondary hover:text-primary hover:border-primary/30'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'story' && <StoryPractice />}
      {activeTab === 'chat' && <VoiceChat />}
      {activeTab === 'history' && <StoryHistoryView />}
    </div>
  );
}

// ---- Story Practice ---------------------------------------------------------

interface SpeechResult {
  transcript: string;
  accuracy: number;
  wordResults: { word: string; correct: boolean }[];
  sentenceIdx: number;
}

function StoryPractice() {
  const today = toDateKey();
  const [story, setStory] = useState<VoiceStory | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);

  // Recording state
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [result, setResult] = useState<SpeechResult | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any | null>(null);
  const finalTranscriptRef = useRef('');

  const supportsSTT =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Load today's story once
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDailyStory(today)
      .then((s) => {
        if (cancelled) return;
        setStory(s);
        setSentences(splitSentences(s.text));
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, [today]);

  // ---- Playback controls ----

  function playSentence(idx: number, sentences_: string[] = sentences) {
    const text = sentences_[idx];
    if (!text) return;
    window.speechSynthesis.cancel();
    setActiveSentenceIdx(idx);
    setIsSpeaking(true);
    setIsPaused(false);
    setResult(null);
    speakText(text, () => setIsSpeaking(false));
  }

  function handlePause() {
    window.speechSynthesis.pause();
    setIsPaused(true);
  }

  function handleResume() {
    window.speechSynthesis.resume();
    setIsPaused(false);
  }

  function handleStop() {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }

  function handlePrevSentence() {
    handleStop();
    setActiveSentenceIdx((i) => Math.max(0, i - 1));
    setResult(null);
  }

  function handleNextSentence() {
    handleStop();
    const next = Math.min(sentences.length - 1, activeSentenceIdx + 1);
    setActiveSentenceIdx(next);
    setResult(null);
  }

  // ---- Repeat (mic) ----

  function startRepeat() {
    if (!supportsSTT || isListening) return;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    const recognition = getSpeechRecognition();
    if (!recognition) return;

    finalTranscriptRef.current = '';
    setLiveTranscript('');
    setResult(null);

    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onerror = (e: { error: string }) => {
      if (e.error !== 'aborted') {
        setError(`Microphone error: ${e.error}. Please allow mic access in your browser.`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      const full = finalTranscriptRef.current.trim();
      if (full) {
        const target = sentences[activeSentenceIdx] ?? '';
        const { wordResults, accuracy } = compareTexts(target, full);
        setResult({ transcript: full, accuracy, wordResults, sentenceIdx: activeSentenceIdx });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscriptRef.current += t + ' ';
        else interim = t;
      }
      setLiveTranscript((finalTranscriptRef.current + interim).trim());
    };

    recognition.start();
    recognitionRef.current = recognition;
  }

  function stopRepeat() {
    recognitionRef.current?.stop();
  }

  return (
    <div className="space-y-5">
      {/* Date badge */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted bg-canvas border border-border-strong rounded-full px-3 py-1">
          {formatDate(today)}
        </span>
        <span className="text-[10px] text-text-muted">· story updates daily at midnight</span>
      </div>

      {/* Instructions */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl px-5 py-4 text-sm text-text-secondary leading-relaxed">
        <strong className="text-primary">How it works:</strong> Click a sentence to select it, press <strong>Listen</strong> to hear it, then <strong>Pause</strong> to stop. Practice repeating it, then move to the next sentence with <strong>▶</strong>.
      </div>

      {/* Story card — sentences as selectable rows */}
      <div className="bg-white border border-border-strong rounded-2xl overflow-hidden shadow-sm">
        {loading && (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-5 bg-border-subtle rounded w-2/5" />
            {[100, 90, 100, 85, 95].map((w, i) => (
              <div key={i} className="h-4 bg-border-subtle rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}
        {error && !loading && (
          <p className="p-6 text-red-500 text-sm">
            {error}{' '}
            <button
              onClick={() => {
                setError(null); setLoading(true);
                getDailyStory(today)
                  .then((s) => { setStory(s); setSentences(splitSentences(s.text)); })
                  .catch((e) => setError((e as Error).message))
                  .finally(() => setLoading(false));
              }}
              className="underline font-medium"
            >Retry</button>
          </p>
        )}
        {!loading && !error && story && (
          <>
            <div className="px-6 pt-5 pb-2 border-b border-border-subtle">
              <h3 className="font-display font-semibold text-lg text-primary">{story.title}</h3>
            </div>
            <div className="divide-y divide-border-subtle">
              {sentences.map((sentence, idx) => {
                const isActive = activeSentenceIdx === idx;
                const isCurrentlySpeaking = isActive && isSpeaking;
                return (
                  <button
                    key={idx}
                    onClick={() => { handleStop(); setActiveSentenceIdx(idx); setResult(null); }}
                    className={`w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors ${
                      isActive
                        ? 'bg-primary/5 border-l-2 border-primary'
                        : 'hover:bg-canvas border-l-2 border-transparent'
                    }`}
                  >
                    {/* Sentence number */}
                    <span className={`text-xs font-bold shrink-0 mt-0.5 w-5 text-center ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                      {idx + 1}
                    </span>

                    {/* Sentence text */}
                    <p className={`flex-1 text-[15px] leading-relaxed ${isActive ? 'text-primary font-medium' : 'text-text-secondary'}`}>
                      {sentence}
                    </p>

                    {/* Speaking wave animation */}
                    {isCurrentlySpeaking && !isPaused && (
                      <div className="flex items-center gap-[3px] shrink-0 self-center">
                        {[0, 100, 200, 100, 0].map((delay, i) => (
                          <div
                            key={i}
                            className="w-[3px] bg-primary rounded-full animate-bounce"
                            style={{ height: `${8 + i * 3}px`, animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    )}
                    {isCurrentlySpeaking && isPaused && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0 self-center">
                        PAUSED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Player controls */}
      {!loading && !error && sentences.length > 0 && (
        <div className="bg-white border border-border-strong rounded-2xl px-5 py-4 shadow-sm flex flex-wrap items-center gap-3">
          {/* Sentence counter */}
          <span className="text-xs font-medium text-text-muted mr-1">
            Sentence {activeSentenceIdx + 1} / {sentences.length}
          </span>

          {/* ◀ Prev */}
          <button
            onClick={handlePrevSentence}
            disabled={activeSentenceIdx === 0}
            className="w-9 h-9 rounded-xl border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-40"
            title="Previous sentence"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Listen / Pause / Resume */}
          {isSpeaking && !isPaused ? (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          ) : isSpeaking && isPaused ? (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          ) : (
            <button
              onClick={() => playSentence(activeSentenceIdx)}
              disabled={!story || isListening}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md shadow-primary/20"
            >
              <Volume2 className="w-4 h-4" />
              Listen
            </button>
          )}

          {/* ▶ Next */}
          <button
            onClick={handleNextSentence}
            disabled={activeSentenceIdx === sentences.length - 1}
            className="w-9 h-9 rounded-xl border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-40"
            title="Next sentence"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border-strong mx-1" />

          {/* Repeat this sentence */}
          {isListening ? (
            <button
              onClick={stopRepeat}
              className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
            >
              <MicOff className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={startRepeat}
              disabled={!story || isSpeaking || !supportsSTT}
              className="flex items-center gap-2 px-5 py-2 bg-white border border-border-strong text-text-secondary rounded-xl text-sm font-medium hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-50"
              title={supportsSTT ? 'Repeat this sentence' : 'Speech recognition not supported'}
            >
              <Mic className="w-4 h-4" />
              {supportsSTT ? 'Repeat' : 'No mic'}
            </button>
          )}

          {/* Stop all */}
          {(isSpeaking || isListening) && (
            <button
              onClick={() => { handleStop(); stopRepeat(); }}
              className="w-9 h-9 rounded-xl border border-border-strong flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-200 transition-colors"
              title="Stop everything"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Live transcript while recording */}
      {isListening && (
        <div className="bg-primary/5 border border-primary/15 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
              Recording sentence {activeSentenceIdx + 1}…
            </span>
          </div>
          <p className="text-sm text-text-secondary italic min-h-[1.25rem]">
            {liveTranscript || 'Speak now…'}
          </p>
        </div>
      )}

      {/* Result for current sentence */}
      {result && !isListening && result.sentenceIdx === activeSentenceIdx && (
        <div className="bg-white border border-border-strong rounded-2xl p-5 shadow-sm space-y-4">
          {/* Accuracy bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-text-secondary">
                Sentence {result.sentenceIdx + 1} accuracy
              </span>
              <span
                className={`text-2xl font-display font-bold ${
                  result.accuracy >= 0.8 ? 'text-green-600' : result.accuracy >= 0.5 ? 'text-amber-600' : 'text-red-500'
                }`}
              >
                {Math.round(result.accuracy * 100)}%
              </span>
            </div>
            <div className="h-2.5 bg-border-subtle rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  result.accuracy >= 0.8 ? 'bg-green-500' : result.accuracy >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${result.accuracy * 100}%` }}
              />
            </div>
          </div>

          {/* Transcript */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1.5">
              What you said
            </span>
            <p className="text-sm text-text-secondary italic">"{result.transcript}"</p>
          </div>

          {/* Word match */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2">
              Word match
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.wordResults.map((w, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-1 rounded-xl text-sm font-medium border ${
                    w.correct ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                >
                  {w.word}
                </span>
              ))}
            </div>
          </div>

          {/* Feedback + next action */}
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm rounded-xl px-4 py-2.5 border flex-1 ${
              result.accuracy >= 0.85
                ? 'text-green-700 bg-green-50 border-green-100'
                : result.accuracy >= 0.6
                ? 'text-blue-700 bg-blue-50 border-blue-100'
                : 'text-amber-700 bg-amber-50 border-amber-100'
            }`}>
              {result.accuracy >= 0.85
                ? 'Great job! Move to the next sentence.'
                : result.accuracy >= 0.6
                ? 'Good effort! Try repeating once more or move on.'
                : 'Keep trying — listen again, then repeat slowly.'}
            </p>
            {activeSentenceIdx < sentences.length - 1 && (
              <button
                onClick={handleNextSentence}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-md shadow-primary/20"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Voice Chat -------------------------------------------------------------

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
  pending?: boolean;
}

function VoiceChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'ai',
      text: "Hi! I'm Alex, your English communication coach. Tap the mic and say something — I'll respond and help you improve. You can also type if you prefer!",
    },
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [textInput, setTextInput] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const supportsSTT =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isThinking) return;

      // Build history from current messages (use ref to avoid stale closure)
      const history: GeminiMessage[] = messagesRef.current
        .filter((m) => m.text && !m.pending)
        .map((m) => ({
          role: m.role === 'ai' ? ('model' as const) : ('user' as const),
          parts: [{ text: m.text }],
        }));

      setMessages((prev) => [
        ...prev,
        { role: 'user', text },
        { role: 'ai', text: '', pending: true },
      ]);
      setIsThinking(true);

      abortRef.current = new AbortController();
      let full = '';

      try {
        await streamVoiceChat(
          history,
          text,
          (chunk) => {
            full += chunk;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'ai', text: full };
              return updated;
            });
          },
          abortRef.current.signal,
        );

        setIsSpeaking(true);
        speakText(full, () => setIsSpeaking(false));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'ai',
              text: 'Sorry, something went wrong. Please try again.',
            };
            return updated;
          });
        }
      } finally {
        setIsThinking(false);
      }
    },
    [isThinking],
  );

  function startListening() {
    if (!supportsSTT || isThinking || isSpeaking) return;
    // Cancel any ongoing TTS before listening
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: { error: string }) => {
      if (e.error !== 'aborted') {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: `Mic error: ${e.error}. Please allow microphone access.` },
        ]);
      }
      setIsListening(false);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) sendMessage(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function handleSendText() {
    const t = textInput.trim();
    if (!t) return;
    setTextInput('');
    sendMessage(t);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Messages */}
      <div className="bg-white border border-border-strong rounded-2xl p-4 min-h-[380px] max-h-[500px] overflow-y-auto flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mr-2 mt-0.5">
                A
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-canvas text-text-secondary border border-border-strong rounded-bl-md'
              }`}
            >
              {msg.pending && !msg.text ? (
                <div className="flex gap-1 items-center h-4">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Status indicator */}
      {(isListening || isSpeaking || isThinking) && (
        <div className="flex items-center gap-2 text-sm text-text-muted px-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {isListening ? 'Listening…' : isThinking ? 'Alex is thinking…' : 'Alex is speaking…'}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-3 items-center">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isThinking || !supportsSTT}
          title={
            !supportsSTT
              ? 'Speech recognition requires Chrome or Edge'
              : isListening
              ? 'Stop recording'
              : isSpeaking
              ? 'Tap to interrupt and speak'
              : 'Tap to speak'
          }
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110'
              : supportsSTT
              ? 'bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20 hover:scale-105 disabled:opacity-50'
              : 'bg-border-subtle text-text-muted cursor-not-allowed'
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSendText(); }}
          placeholder="Or type your message…"
          disabled={isListening || isThinking}
          className="flex-1 border border-border-strong rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/50 transition-colors disabled:opacity-50"
        />

        <button
          onClick={handleSendText}
          disabled={!textInput.trim() || isThinking || isListening}
          className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md shadow-primary/20 shrink-0"
        >
          {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {!supportsSTT && (
        <p className="text-xs text-text-muted text-center">
          Voice input requires Chrome or Edge. Use the text field to chat with Alex.
        </p>
      )}
    </div>
  );
}

// ---- Past Stories History ---------------------------------------------------

function StoryHistoryView() {
  const [stories, setStories] = useState<StoryHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [playingDate, setPlayingDate] = useState<string | null>(null);

  useEffect(() => {
    getStoryHistory(14)
      .then(setStories)
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
    return () => window.speechSynthesis?.cancel();
  }, []);

  function handlePlay(entry: StoryHistoryEntry) {
    if (playingDate === entry.date) {
      window.speechSynthesis.cancel();
      setPlayingDate(null);
      return;
    }
    setPlayingDate(entry.date);
    speakText(entry.text, () => setPlayingDate(null));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-border-strong rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-border-subtle rounded w-1/4 mb-2" />
            <div className="h-5 bg-border-subtle rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="bg-white border border-border-strong rounded-2xl p-10 text-center text-text-muted text-sm">
        No past stories yet. Come back tomorrow to see your history here!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted px-1">
        {stories.length} {stories.length === 1 ? 'story' : 'stories'} from the past {stories.length} {stories.length === 1 ? 'day' : 'days'}
      </p>

      {stories.map((entry) => {
        const isExpanded = expandedDate === entry.date;
        const isPlaying = playingDate === entry.date;

        return (
          <div
            key={entry.date}
            className="bg-white border border-border-strong rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Header row */}
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-canvas transition-colors"
              onClick={() => setExpandedDate(isExpanded ? null : entry.date)}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5">
                  {formatDate(entry.date)}
                </p>
                <p className="font-medium text-primary">{entry.title}</p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
              )}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-border-subtle">
                <p className="text-text-secondary leading-relaxed text-[15px] mt-4 mb-4">
                  {entry.text}
                </p>
                <button
                  onClick={() => handlePlay(entry)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isPlaying
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-primary/8 text-primary hover:bg-primary/15 border border-primary/20'
                  }`}
                >
                  {isPlaying ? (
                    <><VolumeX className="w-4 h-4" /> Stop</>
                  ) : (
                    <><Volume2 className="w-4 h-4" /> Listen</>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
