import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Play, Share2, X, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Pause, Bot, Send, Terminal, Layers, Loader2, Sparkles,
} from 'lucide-react';
import type { ChatMessage } from '../types';
import {
  isGroqConfigured, traceCode, runViaPiston, streamGroqChat,
  type TraceStep, type TraceFrame, type HeapObject,
} from '../lib/groq';
import { useToast } from '../lib/toast';
import { useTheme } from '../lib/theme';

interface Props {
  /** Active workspace skill — used as light context for the tutor. */
  skill?: string;
}

type Language = 'python' | 'javascript' | 'c' | 'cpp' | 'java';

interface Example {
  label: string;
  language: Language;
  code: string;
}

const EXAMPLES: Example[] = [
  {
    label: 'Factorial (recursion)',
    language: 'python',
    code: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)
print(result)`,
  },
  {
    label: 'Linked list sum',
    language: 'python',
    code: `def listSum(numbers):
    if not numbers:
        return 0
    else:
        f = numbers[0]
        rest = numbers[1:]
        return f + listSum(rest)

myList = [1, 2, 3]
total = listSum(myList)
print(total)`,
  },
  {
    label: 'Linked list (nodes)',
    language: 'python',
    code: `class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

class LinkedList:
    def __init__(self):
        self.first = None
        self.last = None
    def add(self, val):
        node = Node(val)
        if self.first is None:
            self.first = node
        else:
            self.last.next = node
        self.last = node

ll = LinkedList()
for n in [1, 2, 3]:
    ll.add(n)`,
  },
  {
    label: 'Fibonacci loop',
    language: 'python',
    code: `def fib(n):
    a, b = 0, 1
    for i in range(n):
        a, b = b, a + b
    return a

print(fib(7))`,
  },
  {
    label: 'Bubble sort',
    language: 'python',
    code: `def bubble(arr):
    for i in range(len(arr)):
        for j in range(len(arr) - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

print(bubble([5, 2, 4, 1]))`,
  },
  {
    label: 'JS array reduce',
    language: 'javascript',
    code: `function sum(nums) {
  let total = 0;
  for (const n of nums) {
    total += n;
  }
  return total;
}

console.log(sum([1, 2, 3, 4]));`,
  },
  {
    label: 'C factorial',
    language: 'c',
    code: `#include <stdio.h>

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int result = factorial(5);
    printf("%d\\n", result);
    return 0;
}`,
  },
  {
    label: 'C++ vector sum',
    language: 'cpp',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> nums = {1, 2, 3, 4};
    int total = 0;
    for (int n : nums) {
        total += n;
    }
    cout << total << endl;
    return 0;
}`,
  },
  {
    label: 'Java factorial',
    language: 'java',
    code: `public class Main {
    static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        int result = factorial(5);
        System.out.println(result);
    }
}`,
  },
];

const DEFAULT_CODE = EXAMPLES[0].code;

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
];

type MobileView = 'code' | 'visual' | 'tutor';

export function CodeTutorPage({ skill = '' }: Props) {
  const toast = useToast();

  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState<Language>('python');
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [realOutput, setRealOutput] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const [mobileView, setMobileView] = useState<MobileView>('code');

  const { resolved } = useTheme();
  const palette = useMemo(() => makePalette(resolved === 'dark'), [resolved]);

  const configured = isGroqConfigured;

  // Derived view of the current step.
  const currentStep = steps[currentStepIndex] ?? null;
  const currentLine = currentStep?.line ?? null;
  const currentFrames = currentStep?.frames ?? [];
  const currentHeap = currentStep?.heap ?? {};
  const currentStdout = currentStep?.stdout ?? '';
  const totalSteps = steps.length;
  const hasTrace = totalSteps > 0;

  // ---- Load shared code from the URL on first mount ------------------------
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('code');
      const lang = params.get('lang') as Language | null;
      if (encoded) setCode(decodeURIComponent(atob(encoded)));
      if (lang && LANGUAGES.some((l) => l.value === lang)) setLanguage(lang);
    } catch { /* ignore malformed share links */ }
  }, []);

  // ---- Step navigation -----------------------------------------------------
  const goFirst = useCallback(() => setCurrentStepIndex(0), []);
  const goLast = useCallback(() => setCurrentStepIndex(Math.max(0, totalSteps - 1)), [totalSteps]);
  const goPrev = useCallback(() => setCurrentStepIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setCurrentStepIndex((i) => Math.min(totalSteps - 1, i + 1)), [totalSteps]);

  // ---- Auto-play -----------------------------------------------------------
  useEffect(() => {
    if (!isAutoPlaying || !hasTrace) return;
    if (currentStepIndex >= totalSteps - 1) { setIsAutoPlaying(false); return; }
    const id = setTimeout(() => setCurrentStepIndex((i) => Math.min(totalSteps - 1, i + 1)), 800);
    return () => clearTimeout(id);
  }, [isAutoPlaying, currentStepIndex, totalSteps, hasTrace]);

  // ---- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    if (!hasTrace) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === ' ') { e.preventDefault(); setIsAutoPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasTrace, goPrev, goNext]);

  // ---- Visualize -----------------------------------------------------------
  const handleVisualize = async () => {
    if (!configured) { toast.error('AI is not configured. Add VITE_GROQ_API_KEY to .env.local.'); return; }
    if (!code.trim()) { toast.error('Write some code first.'); return; }
    setIsLoading(true);
    setError(null);
    setIsAutoPlaying(false);
    setRealOutput(null);
    try {
      // Generate the AI trace; run the real program in parallel (best-effort).
      const [trace, piston] = await Promise.allSettled([
        traceCode(code, language),
        runViaPiston(code, language),
      ]);
      if (trace.status === 'rejected') throw trace.reason;
      setSteps(trace.value);
      setCurrentStepIndex(0);
      if (piston.status === 'fulfilled' && piston.value) setRealOutput(piston.value);
      setMobileView('visual');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate trace. Try simpler code.';
      setError(msg);
      setSteps([]);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSteps([]);
    setCurrentStepIndex(0);
    setError(null);
    setRealOutput(null);
    setChatMessages([]);
    setIsAutoPlaying(false);
  };

  const handleShare = async () => {
    try {
      const encoded = btoa(encodeURIComponent(code));
      const url = `${window.location.origin}${window.location.pathname}?code=${encoded}&lang=${language}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard!');
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const loadExample = (ex: Example) => {
    setCode(ex.code);
    setLanguage(ex.language);
    handleClear();
  };

  // ---- AI Tutor chat -------------------------------------------------------
  const buildSystemPrompt = useCallback(() => {
    return [
      'You are a friendly, encouraging code tutor. A student is visualizing code step by step (like Python Tutor).',
      skill ? `They are studying: "${skill}".` : '',
      'Answer in simple, clear terms. Keep replies under 150 words.',
      'Formatting: use **bold** for key terms, plain dashes (-) for lists. Never use # headings or markdown code fences.',
      'If the student writes in Bengali, reply in Bengali.',
      '',
      'Current code:',
      code,
      '',
      hasTrace
        ? [
            `Current execution step ${currentStepIndex + 1} of ${totalSteps}:`,
            `- Line being executed: ${currentLine}`,
            `- Variables in scope: ${JSON.stringify(currentFrames)}`,
            `- Output so far: ${currentStdout || '(none)'}`,
          ].join('\n')
        : 'The student has not run the visualizer yet.',
    ].filter(Boolean).join('\n');
  }, [skill, code, hasTrace, currentStepIndex, totalSteps, currentLine, currentFrames, currentStdout]);

  const sendChat = async (rawText?: string) => {
    const text = (rawText ?? chatInput).trim();
    if (!text || chatBusy || !configured) return;
    setChatInput('');
    const history = chatMessages;
    const userMsg: ChatMessage = { role: 'user', text };
    const aiMsg: ChatMessage = { role: 'ai', text: '', pending: true };
    setChatMessages([...history, userMsg, aiMsg]);
    setChatBusy(true);
    try {
      let assembled = '';
      await streamGroqChat({
        system: buildSystemPrompt(),
        history,
        userMessage: text,
        onDelta: (chunk) => {
          assembled += chunk;
          setChatMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'ai', text: assembled, pending: true };
            return next;
          });
        },
      });
      setChatMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'ai', text: assembled || '…', pending: false };
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'The tutor is unavailable right now.';
      setChatMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'ai', text: `⚠️ ${msg}`, pending: false };
        return next;
      });
    } finally {
      setChatBusy(false);
    }
  };

  const askAboutStep = () => {
    if (!hasTrace) { toast.info('Run the visualizer first.'); return; }
    sendChat(`Explain what is happening at this step (line ${currentLine}) in simple terms.`);
  };

  // ---- Render --------------------------------------------------------------
  return (
    <div className="h-full min-h-0 flex flex-col text-gray-200 -mt-2">
      {/* Mobile view switcher */}
      <div className="md:hidden flex gap-1 mb-2 bg-[#1a1a2e] rounded-xl p-1 border border-white/10">
        {(['code', 'visual', 'tutor'] as MobileView[]).map((v) => (
          <button
            key={v}
            onClick={() => setMobileView(v)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
              mobileView === v ? 'bg-blue-600 text-white' : 'text-gray-400'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 rounded-2xl overflow-hidden">
        {/* ===== LEFT PANEL — editor & controls ===== */}
        <section
          className={`${mobileView === 'code' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 md:w-[26%] bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden`}
        >
          <PanelHeader icon={<Play className="w-4 h-4 text-blue-400" />} title="Code Visualizer" />
          <div className="px-3 pt-2 flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="flex-1 bg-[#0f0f1e] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500"
            >
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <ExampleMenu onPick={loadExample} />
          </div>

          <div className="flex-1 min-h-0 p-3">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full h-full resize-none bg-[#0f0f1e] border border-white/10 rounded-xl p-3 font-mono text-[13px] leading-6 text-gray-100 outline-none focus:border-blue-500/50"
              placeholder="Write or paste your code here…"
            />
          </div>

          <div className="p-3 pt-0 space-y-2">
            <button
              onClick={handleVisualize}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isLoading ? 'Tracing…' : 'Visualize'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium py-2 rounded-lg transition-colors border border-white/10"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button
                onClick={handleClear}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium py-2 rounded-lg transition-colors border border-white/10"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
        </section>

        {/* ===== CENTER PANEL — display, controls, tutor ===== */}
        <section
          className={`${mobileView === 'visual' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 md:w-[44%] bg-[#16213e] rounded-2xl border border-white/10 overflow-hidden relative`}
        >
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-[#16213e]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm text-gray-300 font-medium">Generating execution trace…</p>
              <p className="text-xs text-gray-500">Analyzing your code with AI</p>
            </div>
          )}

          {/* Section A — code display */}
          <div className="flex-[3] min-h-0 flex flex-col">
            <PanelHeader icon={<Sparkles className="w-4 h-4 text-amber-400" />} title="Execution" />
            <div className="flex-1 min-h-0 overflow-auto font-mono text-[13px] leading-6 py-1">
              <CodeDisplay code={code} activeLine={currentLine} />
            </div>
          </div>

          {/* Section B — step controls */}
          <div className="bg-[#0f1729] border-y border-white/10 px-3 py-2.5">
            {error ? (
              <p className="text-xs text-red-400 text-center py-1">{error}</p>
            ) : (
              <p className="text-xs text-gray-400 text-center mb-2">
                {hasTrace
                  ? <>Step <span className="text-gray-100 font-semibold">{currentStepIndex + 1}</span> of {totalSteps} — line {currentLine}</>
                  : 'Click Visualize to trace your code'}
              </p>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <CtrlButton onClick={goFirst} disabled={!hasTrace || currentStepIndex === 0} title="First"><SkipBack className="w-4 h-4" /></CtrlButton>
              <CtrlButton onClick={goPrev} disabled={!hasTrace || currentStepIndex === 0} title="Previous"><ChevronLeft className="w-4 h-4" /></CtrlButton>
              <CtrlButton
                onClick={() => setIsAutoPlaying((p) => !p)}
                disabled={!hasTrace || currentStepIndex >= totalSteps - 1}
                title="Auto-play"
                active={isAutoPlaying}
              >
                {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </CtrlButton>
              <CtrlButton onClick={goNext} disabled={!hasTrace || currentStepIndex >= totalSteps - 1} title="Next"><ChevronRight className="w-4 h-4" /></CtrlButton>
              <CtrlButton onClick={goLast} disabled={!hasTrace || currentStepIndex >= totalSteps - 1} title="Last"><SkipForward className="w-4 h-4" /></CtrlButton>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, totalSteps - 1)}
              value={currentStepIndex}
              disabled={!hasTrace}
              onChange={(e) => setCurrentStepIndex(Number(e.target.value))}
              className="w-full mt-2 accent-blue-500 disabled:opacity-40"
            />
          </div>

          {/* Section C — AI tutor */}
          <div className="flex-[2] min-h-0 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <Bot className="w-4 h-4 text-blue-400" /> AI Tutor
              </div>
              <button
                onClick={askAboutStep}
                className="text-[11px] bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 px-2 py-1 rounded-md border border-blue-500/30 transition-colors"
              >
                Ask about this step
              </button>
            </div>
            <ChatPanel
              messages={chatMessages}
              input={chatInput}
              busy={chatBusy}
              configured={configured}
              onInput={setChatInput}
              onSend={() => sendChat()}
            />
          </div>
        </section>

        {/* ===== RIGHT PANEL — frames, heap, output ===== */}
        <section
          className={`${mobileView === 'tutor' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 md:w-[30%] bg-[#0f3460] rounded-2xl border border-white/10 overflow-hidden`}
        >
          {/* Frames & Objects — Python Tutor style memory map with connector arrows */}
          <div className="flex-[4] min-h-0 flex flex-col">
            <PanelHeader icon={<Layers className="w-4 h-4 text-blue-300" />} title="Frames & Objects" />
            <div
              className="flex-1 min-h-0 overflow-auto m-2 mt-0 rounded-lg border"
              style={{ background: palette.canvas, borderColor: palette.canvasBorder }}
            >
              {currentFrames.length === 0 && Object.keys(currentHeap).length === 0 ? (
                <p className="text-xs italic p-3" style={{ color: palette.muted }}>Run the visualizer to see frames &amp; objects.</p>
              ) : (
                <MemoryMap frames={currentFrames} heap={currentHeap} stepKey={currentStepIndex} palette={palette} />
              )}
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 min-h-0 flex flex-col border-t border-white/10">
            <PanelHeader icon={<Terminal className="w-4 h-4 text-green-400" />} title="Output" />
            <div className="flex-1 min-h-0 overflow-auto m-2 mt-0 rounded-lg bg-black p-2 font-mono text-xs text-green-400 whitespace-pre-wrap break-words">
              {currentStdout || realOutput || <span className="text-gray-600">(no output yet)</span>}
              {realOutput && currentStdout && realOutput.trim() !== currentStdout.trim() && (
                <div className="mt-2 pt-2 border-t border-white/10 text-gray-500">
                  <span className="text-[10px] uppercase tracking-wider">Actual program output:</span>
                  {'\n'}<span className="text-green-500/80">{realOutput}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---- Small building blocks --------------------------------------------------

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 shrink-0">
      {icon} {title}
    </div>
  );
}

function CtrlButton({ children, onClick, disabled, title, active }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function CodeDisplay({ code, activeLine }: { code: string; activeLine: number | null }) {
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        const lineNo = i + 1;
        const active = lineNo === activeLine;
        return (
          <div
            key={i}
            className={`flex ${active ? 'bg-[rgba(255,215,0,0.15)]' : ''}`}
          >
            <span className="w-6 text-right pr-1 text-red-500 select-none shrink-0">{active ? '→' : ''}</span>
            <span className="w-8 text-right pr-3 text-gray-600 select-none shrink-0">{lineNo}</span>
            <span className="text-gray-200 whitespace-pre pr-4">{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

interface ArrowPath { id: string; d: string; kind: string }

/** Color set for the memory map, chosen per active theme so it reads in light & dark. */
interface Palette {
  canvas: string; canvasBorder: string;
  frameBg: string; frameBorder: string; frameText: string; frameDivider: string;
  frameActiveBg: string; frameActiveBorder: string; frameActiveText: string; frameActiveDivider: string;
  varName: string; valueBg: string; valueBorder: string; valueText: string;
  objBg: string; objBorder: string; objHeader: string;
  cellBg: string; cellBorder: string; cellDivider: string; indexText: string;
  arrowFrame: string; arrowHeap: string; ret: string; muted: string; colTitle: string;
}

function makePalette(dark: boolean): Palette {
  return dark
    ? {
        canvas: '#0e1626', canvasBorder: '#26334d',
        frameBg: '#1b2438', frameBorder: '#39455f', frameText: '#cbd5e1', frameDivider: '#2c3650',
        frameActiveBg: '#15314f', frameActiveBorder: '#3b82f6', frameActiveText: '#93c5fd', frameActiveDivider: '#2c4a6b',
        varName: '#94a3b8', valueBg: '#0b1322', valueBorder: '#475569', valueText: '#e5e7eb',
        objBg: '#2e2a16', objBorder: '#6f5f2c', objHeader: '#cbb86a',
        cellBg: '#0b1322', cellBorder: '#475569', cellDivider: '#33415c', indexText: '#94a3b8',
        arrowFrame: '#9aa5b8', arrowHeap: '#60a5fa', ret: '#f87171', muted: '#64748b', colTitle: '#94a3b8',
      }
    : {
        canvas: '#fbfaf3', canvasBorder: '#e3e0cf',
        frameBg: '#ffffff', frameBorder: '#cfcfcf', frameText: '#4b5563', frameDivider: '#ececec',
        frameActiveBg: '#e9f0fb', frameActiveBorder: '#9bbbe8', frameActiveText: '#1f4e9b', frameActiveDivider: '#bcd1ee',
        varName: '#4b5563', valueBg: '#ffffff', valueBorder: '#999999', valueText: '#111827',
        objBg: '#fdf7d3', objBorder: '#d9c862', objHeader: '#6b7280',
        cellBg: '#ffffff', cellBorder: '#999999', cellDivider: '#cccccc', indexText: '#6b7280',
        arrowFrame: '#8a8a8a', arrowHeap: '#3a66b0', ret: '#c0392b', muted: '#9ca3af', colTitle: '#6b7280',
      };
}

const PaletteCtx = createContext<Palette | null>(null);
const usePalette = () => useContext(PaletteCtx) ?? makePalette(false);

/**
 * Python-Tutor-style memory diagram: a Frames column and an Objects column on a
 * light canvas, with curved SVG connector arrows drawn from each pointer (a dot
 * inside a value cell) to the heap object it references. Arrows are remeasured
 * from the live DOM whenever the step, frames, or heap change.
 */
function MemoryMap({ frames, heap, stepKey, palette }: { frames: TraceFrame[]; heap: Record<string, HeapObject>; stepKey: number; palette: Palette }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<ArrowPath[]>([]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const esc = (s: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'));

    const compute = () => {
      const crect = content.getBoundingClientRect();
      const sources = content.querySelectorAll<HTMLElement>('[data-source-target]');
      const next: ArrowPath[] = [];
      sources.forEach((src, i) => {
        const refKey = src.dataset.sourceTarget;
        if (!refKey) return;
        const kind = src.dataset.sourceKind ?? 'frame';
        const target = content.querySelector<HTMLElement>(`[data-heap-ref="${esc(refKey)}"]`);
        if (!target) return;
        const s = src.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        const x1 = s.left - crect.left + s.width / 2;
        const y1 = s.top - crect.top + s.height / 2;
        const targetLeftX = t.left - crect.left;
        const targetRightX = t.right - crect.left;
        const useLeft = Math.abs(targetLeftX - x1) <= Math.abs(targetRightX - x1);
        const x2 = useLeft ? targetLeftX : targetRightX;
        const y2 = t.top - crect.top + Math.min(t.height / 2, 18);
        const dx = Math.max(28, Math.abs(x2 - x1) * 0.5);
        const c1x = x1 + (x2 >= x1 ? dx : -dx);
        const c2x = x2 + (useLeft ? -dx : dx);
        const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
        next.push({ id: src.dataset.sourceId ?? `s${i}`, d, kind });
      });
      setPaths(next);
    };

    const raf = requestAnimationFrame(compute);
    const t = setTimeout(compute, 260); // recompute once entrance fades settle
    const ro = new ResizeObserver(compute);
    ro.observe(content);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [frames, heap, stepKey]);

  return (
    <PaletteCtx.Provider value={palette}>
      <div ref={contentRef} className="relative inline-block min-w-full p-3">
        {/* Columns (paint below the arrows) */}
        <div className="relative z-0 flex gap-14 items-start">
          {/* Frames column (global at top → most recent at bottom) */}
          <div className="flex flex-col gap-3 shrink-0">
            <div className="text-[11px] font-bold mb-0.5" style={{ color: palette.colTitle }}>Frames</div>
            {frames.length === 0
              ? <p className="text-[11px] italic" style={{ color: palette.muted }}>—</p>
              : frames.map((frame, i) => (
                  <FrameBox key={i} frame={frame} active={i === frames.length - 1} heap={heap} />
                ))}
          </div>

          {/* Objects column (heap) */}
          <div className="flex flex-col gap-4 shrink-0">
            <div className="text-[11px] font-bold mb-0.5" style={{ color: palette.colTitle }}>Objects</div>
            {Object.keys(heap).length === 0
              ? <p className="text-[11px] italic" style={{ color: palette.muted }}>—</p>
              : Object.entries(heap).map(([ref, obj]) => (
                  <ObjectBox key={ref} refKey={ref} obj={obj} heap={heap} />
                ))}
          </div>
        </div>

        {/* Connector arrows on top so they read clearly from the pointer dot to the object */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }} aria-hidden>
          <defs>
            <marker id="ct-arrow-frame" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={palette.arrowFrame} />
            </marker>
            <marker id="ct-arrow-heap" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={palette.arrowHeap} />
            </marker>
          </defs>
          {paths.map((p) => (
            <motion.path
              key={`${stepKey}-${p.id}`}
              d={p.d}
              fill="none"
              stroke={p.kind === 'heap' ? palette.arrowHeap : palette.arrowFrame}
              strokeWidth={1.6}
              markerEnd={`url(#ct-arrow-${p.kind === 'heap' ? 'heap' : 'frame'})`}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          ))}
        </svg>
      </div>
    </PaletteCtx.Provider>
  );
}

function FrameBox({ frame, active, heap }: { frame: TraceFrame; active: boolean; heap: Record<string, HeapObject> }) {
  const c = usePalette();
  const entries = Object.entries(frame.locals ?? {});
  const hasReturn = frame.returnValue != null && frame.returnValue !== '';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-[3px] border text-[12px] shadow-sm"
      style={{ minWidth: 104, background: active ? c.frameActiveBg : c.frameBg, borderColor: active ? c.frameActiveBorder : c.frameBorder }}
    >
      <div
        className="px-2 py-1 text-[11px] font-semibold border-b"
        style={{ color: active ? c.frameActiveText : c.frameText, borderColor: active ? c.frameActiveDivider : c.frameDivider }}
      >
        {frame.name}
      </div>
      <div className="px-2 py-1.5 space-y-1">
        {entries.length === 0 && !hasReturn ? (
          <div className="text-[11px] italic" style={{ color: c.muted }}>no variables</div>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-end gap-1.5">
              <span className="font-mono" style={{ color: c.varName }}>{k}</span>
              <ValueCell value={v} heap={heap} kind="frame" id={`f-${frame.name}-${k}`} />
            </div>
          ))
        )}
        {hasReturn && (
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-semibold text-[11px]" style={{ color: c.ret }}>Return value</span>
            <ValueCell value={String(frame.returnValue)} heap={heap} kind="frame" id={`f-${frame.name}-ret`} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ObjectBox({ refKey, obj, heap }: { refKey: string; obj: HeapObject; heap: Record<string, HeapObject> }) {
  const c = usePalette();
  const title = obj.className ?? obj.type;
  const entries = obj.entries ? Object.entries(obj.entries) : [];
  return (
    <motion.div
      data-heap-ref={refKey}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-[3px] border shadow-sm"
      style={{ minWidth: 64, background: c.objBg, borderColor: c.objBorder }}
    >
      <div className="px-2 pt-1 text-[10px] italic whitespace-nowrap" style={{ color: c.objHeader }}>{title}</div>
      <div className="px-2 pb-2 pt-1">
        {obj.items && (
          <div className="flex">
            {obj.items.length === 0 ? (
              <span className="text-[11px] italic px-1" style={{ color: c.muted }}>empty</span>
            ) : (
              obj.items.map((it, i) => (
                <div key={i} className="flex flex-col items-stretch border -ml-px first:ml-0" style={{ background: c.cellBg, borderColor: c.cellBorder }}>
                  <span className="text-[9px] text-center border-b leading-none py-0.5 px-1" style={{ color: c.indexText, borderColor: c.cellDivider }}>{i}</span>
                  <ValueCell value={it} heap={heap} kind="heap" id={`o-${refKey}-${i}`} bare />
                </div>
              ))
            )}
          </div>
        )}
        {entries.length > 0 && (
          <div className="space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-[11px] font-mono" style={{ color: c.frameText }}>{k}</span>
                <ValueCell value={v} heap={heap} kind="heap" id={`o-${refKey}-${k}`} />
              </div>
            ))}
          </div>
        )}
        {!obj.items && entries.length === 0 && (
          <span className="text-[11px] italic" style={{ color: c.muted }}>—</span>
        )}
      </div>
    </motion.div>
  );
}

/**
 * A single value box. If the value references a heap object, renders a colored
 * dot anchor (the arrow source); otherwise renders the literal value.
 * `bare` drops the bordered box for use inside list cells that already have one.
 */
function ValueCell({ value, heap, kind, id, bare }: {
  value: string; heap: Record<string, HeapObject>; kind: 'frame' | 'heap'; id: string; bare?: boolean;
}) {
  const c = usePalette();
  const pointer = Boolean(heap[value]);
  const inner = pointer ? (
    <span
      data-source-id={id}
      data-source-target={value}
      data-source-kind={kind}
      className="block w-2.5 h-2.5 rounded-full"
      style={{ background: kind === 'heap' ? c.arrowHeap : c.arrowFrame }}
    />
  ) : (
    <span className="font-mono text-[12px] leading-none inline-block max-w-[160px] truncate align-middle" style={{ color: c.valueText }} title={value}>{value}</span>
  );
  if (bare) return <span className="inline-flex items-center justify-center px-2 py-1 min-w-[22px]">{inner}</span>;
  return (
    <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 h-[20px] border rounded-[2px]" style={{ background: c.valueBg, borderColor: c.valueBorder }}>
      {inner}
    </span>
  );
}

function ExampleMenu({ onPick }: { onPick: (ex: Example) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-2.5 py-1.5 rounded-lg border border-white/10 whitespace-nowrap transition-colors"
      >
        Examples
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 w-52 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl py-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => { onPick(ex); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Chat -------------------------------------------------------------------

function ChatPanel({ messages, input, busy, configured, onInput, onSend }: {
  messages: ChatMessage[];
  input: string;
  busy: boolean;
  configured: boolean;
  onInput: (v: string) => void;
  onSend: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2 space-y-2.5">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2">
            Ask the tutor anything about your code or the current step. বাংলায় জিজ্ঞাসা করলে বাংলায় উত্তর পাবেন।
          </p>
        ) : (
          messages.map((m, i) => <ChatBubble key={i} msg={m} />)
        )}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-white/10 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
          disabled={busy || !configured}
          placeholder={configured ? 'Ask the tutor…' : 'AI not configured'}
          className="flex-1 bg-[#0f0f1e] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-100 outline-none focus:border-blue-500/50 disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={busy || !input.trim() || !configured}
          className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isAI = msg.role === 'ai';
  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed break-words ${
        isAI ? 'bg-gray-700 text-gray-100 rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'
      }`}>
        <RichText text={msg.text} />
        {msg.pending && <span className="inline-block w-1.5 h-3 bg-current/40 ml-1 animate-pulse align-middle" />}
      </div>
    </div>
  );
}

/** Renders **bold** and preserves line breaks. */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={li}>
            {parts.map((part, pi) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={pi} className="font-semibold">{part.slice(2, -2)}</strong>
                : <span key={pi}>{part}</span>
            )}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}
