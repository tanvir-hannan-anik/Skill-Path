import { FormEvent, useState } from 'react';
import { User, Mail, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { authErrorMessage, useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/toast';

interface Props {
  onBack: () => void;
  onAuthenticated: () => void;
}

export function AuthPage({ onBack, onAuthenticated }: Props) {
  const { signIn, signUp, signInWithGoogle, resetPassword, configured } = useAuth();
  const toast = useToast();

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    else if (!isLogin && password.length < 6) errs.password = 'Use at least 6 characters.';
    if (!isLogin && !name.trim()) errs.name = 'Name is required.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error('Authentication is disabled — Firebase env vars are missing.');
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('Welcome back!');
      } else {
        await signUp(name, email, password);
        toast.success('Account created. Welcome to SkillPath!');
      }
      onAuthenticated();
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    if (!configured) {
      toast.error('Authentication is disabled — Firebase env vars are missing.');
      return;
    }
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Signed in with Google.');
      onAuthenticated();
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) {
      setFieldErrors((f) => ({ ...f, email: 'Enter your email above first.' }));
      return;
    }
    try {
      await resetPassword(email);
      toast.success('Password reset email sent.');
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  }

  const inputBase =
    'w-full bg-canvas border rounded-2xl pl-12 pr-4 py-3 outline-none text-sm shadow-sm transition-colors text-primary';

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 sm:p-6 relative">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 sm:top-8 sm:left-8 flex items-center gap-2 text-text-secondary hover:text-primary transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-border-strong font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="max-w-md w-full">
        <div className="text-center mb-8 sm:mb-10 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/5 mx-auto flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display font-medium text-3xl sm:text-4xl text-primary tracking-tight">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-text-secondary text-sm">
            {isLogin ? 'Sign in to sync your curriculum.' : 'Create an account to track your progress.'}
          </p>
        </div>

        <div
          className="bg-canvas p-1.5 rounded-full flex items-center mb-8 border border-border-strong w-fit mx-auto relative shadow-inner"
          role="tablist"
        >
          <motion.div
            layoutId="authTabBg"
            className="absolute left-1.5 top-1.5 bottom-1.5 bg-white rounded-full shadow-sm border border-border-strong pointer-events-none"
            initial={false}
            animate={{ width: 'calc(50% - 6px)', x: isLogin ? 0 : '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            onClick={() => { setIsLogin(true); setFieldErrors({}); }}
            className={`relative z-10 px-8 py-2 text-sm font-medium rounded-full transition-colors ${isLogin ? 'text-primary' : 'text-text-muted hover:text-primary'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            onClick={() => { setIsLogin(false); setFieldErrors({}); }}
            className={`relative z-10 px-8 py-2 text-sm font-medium rounded-full transition-colors ${!isLogin ? 'text-primary' : 'text-text-muted hover:text-primary'}`}
          >
            Register
          </button>
        </div>

        <motion.div
          key={isLogin ? 'login' : 'register'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white border border-border-strong rounded-[32px] p-6 sm:p-8 shadow-[0_8px_40px_rgb(0,0,0,0.04)]"
        >
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-2 block">Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!fieldErrors.name}
                    className={`${inputBase} ${fieldErrors.name ? 'border-red-300 focus:border-red-500' : 'border-border-strong focus:border-primary'}`}
                  />
                </div>
                {fieldErrors.name && <p className="text-xs text-red-600 ml-2">{fieldErrors.name}</p>}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-2 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="email"
                  type="email"
                  placeholder="hello@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!fieldErrors.email}
                  className={`${inputBase} ${fieldErrors.email ? 'border-red-300 focus:border-red-500' : 'border-border-strong focus:border-primary'}`}
                />
              </div>
              {fieldErrors.email && <p className="text-xs text-red-600 ml-2">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-2">
                <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Password</label>
                {isLogin && (
                  <button type="button" onClick={handleForgot} className="text-[10px] font-semibold uppercase tracking-widest text-accent hover:underline">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!fieldErrors.password}
                  className={`${inputBase} ${fieldErrors.password ? 'border-red-300 focus:border-red-500' : 'border-border-strong focus:border-primary'}`}
                />
              </div>
              {fieldErrors.password && <p className="text-xs text-red-600 ml-2">{fieldErrors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full pt-4 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="bg-primary text-white py-4 rounded-2xl text-sm font-medium hover:bg-primary/90 transition-colors active:scale-[0.98] shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting
                  ? (isLogin ? 'Signing in…' : 'Creating account…')
                  : (isLogin ? 'Sign In to SkillPath' : 'Create Account')}
              </div>
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <div className="h-px bg-border-strong flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">OR CONTINUE WITH</span>
            <div className="h-px bg-border-strong flex-1" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            type="button"
            className="w-full bg-white border border-border-strong rounded-2xl p-3.5 flex items-center justify-center gap-3 hover:bg-canvas transition-colors shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            <span className="text-sm font-medium text-primary">Continue with Google</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
