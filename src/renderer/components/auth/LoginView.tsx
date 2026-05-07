import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Lock, LogIn, Github, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import logo from '@/assets/icon.ico';

export default function LoginView() {
  const { login, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthStatus, setOauthStatus] = useState('');

  useEffect(() => {
    const cleanup = window.electronAPI.auth.onOAuthComplete((result) => {
      if (result.success) {
        setOauthStatus('Login successful! Redirecting...');
        setTimeout(() => {
          window.electronAPI.auth.getSession().then(session => {
            if (session) {
              // Let AuthProvider pick up the session
              window.location.reload();
            }
          });
        }, 500);
      } else {
        setOauthStatus('');
        setError(result.error || 'OAuth login failed');
      }
    });
    return cleanup;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = isSignUp
      ? await signUp(email, password)
      : await login(email, password);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'Authentication failed');
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('');
    setOauthStatus(`Opening ${provider}...`);
    const result = await window.electronAPI.auth.oauth(provider);
    if (!result.success) {
      setError(result.error || 'Failed to start OAuth flow');
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-[#0a0810] border-gray-700/50 text-white">
        <CardHeader className="text-center pb-2">
          <img src={logo} alt="Clarity" className="w-12 h-12 mx-auto mb-3 rounded" />
          <CardTitle className="text-xl font-bold">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <p className="text-sm text-gray-400 mt-1">
            {isSignUp ? 'Sign up to start tracking your time' : 'Sign in to continue'}
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-gray-600 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/5 border-gray-600 text-white placeholder:text-gray-500"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-2 rounded">
                {error}
              </div>
            )}
            {oauthStatus && !error && (
              <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm p-2 rounded flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {oauthStatus}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#2a1636] hover:bg-[#3a2050] text-white"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#0a0810] px-2 text-gray-500">or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuth('google')}
                className="border-gray-600 text-white hover:bg-white/5"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuth('github')}
                className="border-gray-600 text-white hover:bg-white/5"
              >
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </div>

            <p className="text-center text-sm text-gray-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                className="text-purple-400 hover:underline"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
