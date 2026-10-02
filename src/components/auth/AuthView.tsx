'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Brain, Mail, Lock, User, AlertCircle, Sparkles, Sun, Moon, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export const AuthView: React.FC = () => {
  const { login, signup } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          setError('Please provide both email and password.');
          setLoading(false);
          return;
        }
        await login(email.trim(), password);
      } else {
        if (!name.trim() || !email.trim() || !password) {
          setError('Please fill in all fields.');
          setLoading(false);
          return;
        }
        await signup(name.trim(), email.trim(), password);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please verify your credentials or server status.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoUser = () => {
    setEmail('testuser_thfemv@example.com');
    setPassword('SecurePassword123!');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors relative">
      {/* Theme toggle in top right */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm mb-1">
            <Brain size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Second Brain
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {mode === 'login'
              ? 'Sign in to access your personal knowledge base'
              : 'Create an account to start organizing your knowledge'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] shadow-xl space-y-6">
          {/* Mode Switcher */}
          <div role="tablist" className="grid grid-cols-2 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-xs font-semibold">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 rounded-md transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-2 rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User size={15} />}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail size={15} />}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock size={15} />}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={loading}
              rightIcon={<ArrowRight size={15} />}
            >
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Quick Demo Helper */}
          {mode === 'login' && (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 text-center">
              <button
                type="button"
                onClick={handleFillDemoUser}
                className="text-[11px] text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Sparkles size={12} className="text-indigo-500" />
                Fill existing test credentials
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          Powered by FastAPI backend & PostgreSQL with JWT authentication
        </p>
      </div>
    </div>
  );
};
