import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, CalendarDays, Send, Bot, User, Maximize2, Minimize2, Loader2, Trash2, Trophy, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, Schedule, WeeklyAssignment } from '../types';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/toast';
import { appendChatMessage, clearChat, subscribeToChat, getWeeklyAssignment, saveWeeklyAssignment } from '../lib/firestore';
import { appendGuestChat, clearGuestChat, getGuestChat, getGuestWeeklyAssignment, setGuestWeeklyAssignment } from '../lib/localStore';
import { isGroqConfigured, streamGroqReply } from '../lib/groq';
import { extractWeekTopics, generateWeeklyAssignment, isoWeekDates, isoWeekKey } from '../lib/studyPack';
import { parseDateKey, toDateKey } from '../lib/dates';

interface Props {
  skill: string;
  schedule: Schedule;
}

type InsightTab = 'tracker' | 'chat' | 'weekly';

const WELCOME: ChatMessage = {
  id: '__welcome',
  role: 'ai',
  text:
    "Hello! I'm your SkillPath AI tutor. Ask me to plan today's study session, explain a concept, or break down a tricky task — I'll tailor everything to what you're currently learning.",
};

export function InsightsPage({ skill, schedule }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<InsightTab>('tracker');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Subscribe to chat history. Signed-in users get Firestore realtime; guests
  // read from localStorage.
  useEffect(() => {
    if (!user) {
      setMessages(getGuestChat());
      return;
    }
    return subscribeToChat(
      user.uid,
      (msgs) => setMessages(msgs.length ? msgs : []),
      (err) => {
        console.error(err);
        toast.error('Failed to load chat history.');
      }
    );
  }, [user, toast]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Auto-scroll to bottom as messages stream in.
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamingText]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await chatContainerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.error(err);
    }
  };

  const displayedMessages = useMemo(() => (messages.length ? messages : [WELCOME]), [messages]);

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || sending) return;
    if (!isGroqConfigured) {
      toast.error('AI is not configured — add VITE_GROQ_API_KEY to your .env.local.');
      return;
    }

    setInputMessage('');
    setSending(true);
    setStreamingText('');

    try {
      // Optimistically persist the user message (guest uses localStorage; the
      // local message list is updated via the snapshot or via setMessages below).
      if (user) {
        await appendChatMessage(user.uid, 'user', text);
      } else {
        const m = appendGuestChat('user', text);
        setMessages((prev) => [...prev, m]);
      }

      let assembled = '';
      await streamGroqReply({
        skill,
        history: messages,
        userMessage: text,
        onDelta: (chunk) => {
          assembled += chunk;
          setStreamingText(assembled);
        },
      });

      if (assembled.trim()) {
        if (user) {
          await appendChatMessage(user.uid, 'ai', assembled);
        } else {
          const m = appendGuestChat('ai', assembled);
          setMessages((prev) => [...prev, m]);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || 'AI is unavailable right now.');
    } finally {
      setStreamingText('');
      setSending(false);
    }
  }

  async function handleClearChat() {
    if (!confirm('Clear all chat history?')) return;
    try {
      if (user) {
        await clearChat(user.uid);
      } else {
        clearGuestChat();
        setMessages([]);
      }
      toast.success('Chat history cleared.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear chat.');
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col h-full min-h-0">
      <div className="mb-4 space-y-4 shrink-0">
        <div className="space-y-2">
          <h1 className="font-display font-medium text-3xl sm:text-4xl text-primary tracking-tight">AI Insights & Tracking</h1>
          <p className="text-text-secondary text-base max-w-2xl leading-relaxed">
            Analyze your progress, track your consistency, and chat with your AI tutor.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-canvas p-1.5 rounded-full border border-border-strong w-fit max-w-full overflow-x-auto" role="tablist">
          {([
            { id: 'tracker', label: 'Monthly Tracker', icon: <CalendarDays className="w-4 h-4" /> },
            { id: 'chat', label: 'AI Assistant', icon: <MessageSquare className="w-4 h-4" /> },
            { id: 'weekly', label: 'Weekly Project', icon: <Trophy className="w-4 h-4" /> },
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              aria-selected={activeTab === id}
              className={`relative px-4 sm:px-5 py-2.5 text-sm font-medium rounded-full transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === id ? 'text-primary' : 'text-text-muted hover:text-primary'
              }`}
            >
              {activeTab === id && (
                <motion.div layoutId="insightsTab" className="absolute inset-0 bg-white shadow-sm border border-border-strong rounded-full pointer-events-none" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {icon}
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'tracker' && (
            <motion.div
              key="tracker"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-[24px] border border-border-strong p-4 sm:p-6 shadow-sm flex-1 flex flex-col min-h-0 overflow-y-auto"
            >
              <MonthlyTracker schedule={schedule} />
            </motion.div>
          )}

          {activeTab === 'weekly' && (
            <motion.div
              key="weekly"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-[24px] border border-border-strong p-4 sm:p-6 shadow-sm flex-1 flex flex-col min-h-0 overflow-y-auto"
            >
              <WeeklyAssignmentPanel skill={skill} schedule={schedule} />
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              ref={chatContainerRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`bg-white border border-border-strong shadow-sm flex flex-col flex-1 min-h-0 ${
                isFullscreen ? 'fixed inset-0 z-[100] w-full h-full rounded-none border-none max-w-none' : 'rounded-[24px]'
              }`}
            >
              <div className="px-4 sm:px-6 py-4 border-b border-border-strong flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary border border-border-strong shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-medium text-lg text-primary leading-tight truncate">SkillPath AI</h3>
                    <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                      {isGroqConfigured ? 'Online • Powered by Groq' : 'Offline • API key missing'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={handleClearChat}
                      aria-label="Clear chat history"
                      className="w-9 h-9 rounded-full hover:bg-canvas flex items-center justify-center text-text-secondary hover:text-red-500 transition-colors border border-border-strong"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-canvas flex items-center justify-center text-text-secondary hover:text-primary transition-colors border border-border-strong"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
                {displayedMessages.map((msg) => (
                  <MessageBubble key={msg.id ?? msg.createdAt} msg={msg} />
                ))}
                {streamingText && (
                  <MessageBubble msg={{ id: '__stream', role: 'ai', text: streamingText, pending: true }} />
                )}
                {sending && !streamingText && (
                  <div className="flex items-center gap-3 text-text-muted text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                  </div>
                )}
                <div ref={scrollAnchorRef} />
              </div>

              <div className="p-3 sm:p-4 md:p-6 bg-surface border-t border-border-strong">
                <form onSubmit={handleSendMessage} className="relative max-w-3xl mx-auto">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={isGroqConfigured ? 'Ask anything about your learning…' : 'Add VITE_GROQ_API_KEY to enable chat'}
                    disabled={!isGroqConfigured || sending}
                    className="w-full bg-white border border-border-strong outline-none focus:border-primary rounded-full pl-5 sm:pl-6 pr-14 py-3 sm:py-4 text-sm shadow-sm transition-colors text-primary disabled:opacity-60"
                    aria-label="Message AI assistant"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || sending || !isGroqConfigured}
                    aria-label="Send message"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 bg-primary text-white flex items-center justify-center rounded-full hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function WeeklyAssignmentPanel({ skill, schedule }: { skill: string; schedule: Schedule }) {
  const { user } = useAuth();
  const toast = useToast();
  const weekKey = useMemo(() => isoWeekKey(), []);
  const weekDates = useMemo(() => isoWeekDates(), []);
  const topics = useMemo(() => extractWeekTopics(schedule, weekDates), [schedule, weekDates]);

  const [assignment, setAssignment] = useState<WeeklyAssignment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = user
        ? await getWeeklyAssignment(user.uid, weekKey)
        : getGuestWeeklyAssignment(weekKey);
      if (!cancelled) setAssignment(cached);
    })().catch((err) => console.error(err));
    return () => { cancelled = true; };
  }, [user, weekKey]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const fresh = await generateWeeklyAssignment({ skill, topics, weekKey });
      if (user) await saveWeeklyAssignment(user.uid, fresh);
      else setGuestWeeklyAssignment(fresh);
      setAssignment(fresh);
      toast.success('Weekly project generated.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-canvas rounded-lg border border-border-strong text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">
            <Trophy className="w-3.5 h-3.5 text-accent" />
            <span>{weekKey}</span>
          </div>
          <h2 className="font-display font-medium text-2xl text-primary tracking-tight">Weekly project</h2>
          <p className="text-text-secondary text-sm mt-1 max-w-xl leading-relaxed">
            A bigger, hands-on synthesis assignment generated from everything you've worked on this week.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || topics.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : assignment ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {assignment ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {topics.length > 0 && (
        <div className="bg-canvas border border-border-strong rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">This week's topics</p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t, i) => (
              <span key={i} className="text-xs px-2.5 py-1 bg-white border border-border-strong text-text-secondary rounded-lg">{t}</span>
            ))}
          </div>
        </div>
      )}

      {topics.length === 0 && !assignment && (
        <div className="bg-canvas border border-dashed border-border-strong rounded-2xl p-10 text-center">
          <p className="text-text-secondary text-sm">
            No topics this week yet. Add some videos, docs, or tasks to your daily plan and come back here on the weekend.
          </p>
        </div>
      )}

      {assignment && (
        <div className="bg-white border border-border-strong rounded-2xl p-5 sm:p-7">
          <WeeklyProjectMarkdown text={assignment.prompt} />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-5">
            Generated {new Date(assignment.generatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

/** Renders the weekly project markdown: headings, bullets, bold, paragraphs. */
function WeeklyProjectMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  function renderInline(line: string): React.ReactNode {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="font-semibold text-primary">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length ?? 1;
      const content = line.replace(/^#+\s/, '');
      const cls = level === 1
        ? 'font-display font-semibold text-xl text-primary mt-6 mb-2'
        : level === 2
        ? 'font-display font-semibold text-base text-primary mt-5 mb-1.5'
        : 'font-semibold text-sm text-primary mt-4 mb-1';
      elements.push(<p key={key++} className={cls}>{content}</p>);
    } else if (/^[-*]\s/.test(line)) {
      const content = line.replace(/^[-*]\s/, '');
      elements.push(
        <div key={key++} className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 shrink-0" />
          <span>{renderInline(content)}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(<p key={key++} className="text-sm text-text-secondary leading-relaxed">{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-1">{elements}</div>;
}

/** Renders AI message text: **bold** → <strong>, newlines preserved, no raw markdown symbols shown. */
function RichText({ text, pending }: { text: string; pending?: boolean }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        // Split on **…** pairs to produce bold spans
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={li}>
            {parts.map((part, pi) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pi} className="font-semibold">{part.slice(2, -2)}</strong>;
              }
              return <span key={pi}>{part}</span>;
            })}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
      {pending && <span className="inline-block w-1.5 h-4 bg-primary/40 ml-1 animate-pulse align-middle" />}
    </>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAI = msg.role === 'ai';
  return (
    <div className={`flex gap-3 sm:gap-4 ${isAI ? '' : 'flex-row-reverse'}`}>
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
        isAI ? 'bg-primary text-white' : 'bg-canvas border border-border-strong text-primary'
      }`}>
        {isAI ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
      </div>
      <div className={`flex flex-col min-w-0 ${isAI ? 'items-start' : 'items-end'}`}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5 px-1">
          {isAI ? 'SkillPath AI' : 'You'}
        </span>
        <div className={`px-4 sm:px-5 py-3 sm:py-3.5 max-w-xl text-sm leading-relaxed break-words ${
          isAI
            ? 'bg-canvas border border-border-strong text-primary rounded-2xl rounded-tl-sm'
            : 'bg-primary text-white rounded-2xl rounded-tr-sm'
        }`}>
          {isAI ? (
            <RichText text={msg.text} pending={msg.pending} />
          ) : (
            <>
              {msg.text}
              {msg.pending && <span className="inline-block w-1.5 h-4 bg-white/40 ml-1 animate-pulse align-middle" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthlyTracker({ schedule }: { schedule: Schedule }) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthName = today.toLocaleString('default', { month: 'long' });

  // Intensity = number of completed tasks on that day, capped at 4.
  const dayInfo = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const day = schedule[key];
      const done = day?.tasks?.filter((t) => t.done).length ?? 0;
      return {
        key,
        intensity: Math.min(done, 4),
        topic: day?.topicTitle?.trim() || '',
        items: (day?.videos?.length ?? 0) + (day?.docs?.length ?? 0) + (day?.tasks?.length ?? 0),
      };
    });
  }, [schedule, year, month, daysInMonth]);

  const totalCompleted = dayInfo.reduce((sum, d) => sum + d.intensity, 0);
  const activeDays = dayInfo.filter((d) => d.intensity > 0).length;
  const streak = useMemo(() => computeCurrentStreak(schedule, today), [schedule, today]);

  return (
    <>
      {/* Header: title + stat tiles */}
      <div className="mb-6 shrink-0 space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-medium text-2xl text-primary tracking-tight">{monthName} {year}</h2>
            <p className="text-text-secondary text-sm">Each square is one day — darker means more tasks completed.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile label="Active days" value={activeDays} suffix={`/ ${daysInMonth}`} />
          <StatTile label="Tasks done" value={totalCompleted} />
          <StatTile label="Current streak" value={streak} suffix={streak === 1 ? 'day' : 'days'} />
        </div>
      </div>

      {/* Heatmap — capped width so cells stay small and the grid never
          overflows the card. With gap-2 and a 400px cap, each cell is ~50px. */}
      <div className="max-w-[360px] sm:max-w-[420px] mx-auto w-full">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 shrink-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 content-start">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} aria-hidden="true" />)}

          {dayInfo.map((d, i) => {
            const day = i + 1;
            const isToday = d.key === todayKey;
            const tooltip = `${parseDateKey(d.key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}${d.topic ? ` — ${d.topic}` : ''} — ${d.intensity} task${d.intensity === 1 ? '' : 's'} done`;
            return (
              <div
                key={i}
                title={tooltip}
                className={`aspect-square w-full rounded-md sm:rounded-lg flex items-center justify-center font-medium text-[10px] sm:text-[11px] border transition-all cursor-default hover:scale-110 hover:z-10 relative ${
                  d.intensity === 0 ? 'bg-canvas border-border-strong text-text-muted'
                  : d.intensity === 1 ? 'bg-emerald-100 border-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200'
                  : d.intensity === 2 ? 'bg-emerald-300 border-emerald-400 text-emerald-900 dark:bg-emerald-700/50 dark:border-emerald-700 dark:text-emerald-100'
                  : d.intensity === 3 ? 'bg-emerald-500 border-emerald-600 text-white'
                  : 'bg-emerald-700 border-emerald-800 text-white shadow-md'
                } ${isToday ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
              >
                <span className="leading-none">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center gap-2 text-[11px] font-medium text-text-muted justify-end shrink-0">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-canvas border border-border-strong" />
          <div className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800" />
          <div className="w-3 h-3 rounded-sm bg-emerald-300 border border-emerald-400 dark:bg-emerald-700/50 dark:border-emerald-700" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-600" />
          <div className="w-3 h-3 rounded-sm bg-emerald-700 border border-emerald-800" />
        </div>
        <span>More</span>
      </div>
    </>
  );
}

function StatTile({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="bg-canvas border border-border-strong rounded-xl px-3 sm:px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className="font-display font-medium text-2xl text-primary tabular-nums leading-none">{value}</span>
        {suffix && <span className="text-xs font-medium text-text-muted">{suffix}</span>}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">{label}</div>
    </div>
  );
}

function computeCurrentStreak(schedule: Schedule, today: Date): number {
  let streak = 0;
  const cursor = new Date(today);
  while (true) {
    const key = toDateKey(cursor);
    const day = schedule[key];
    if (day?.tasks?.some((t) => t.done)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
