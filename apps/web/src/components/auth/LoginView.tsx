'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginView() {
  const { login, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = isSignUp ? await signUp(email, password) : await login(email, password);
    setIsLoading(false);
    if (!result.success) setError(result.error || 'Authentication failed');
  };

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-[#0a0810] border-gray-700/50 text-white">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 mx-auto mb-3 rounded bg-purple-600 flex items-center justify-center text-2xl font-bold">C</div>
          <CardTitle className="text-xl font-bold">{isSignUp ? 'Create Account' : 'Welcome Back'}</CardTitle>
          <p className="text-sm text-gray-400 mt-1">{isSignUp ? 'Sign up to start tracking your time' : 'Sign in to continue'}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300 flex items-center gap-2"><Mail className="w-4 h-4" />Email</label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-gray-600 text-white placeholder:text-gray-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-300 flex items-center gap-2"><Lock className="w-4 h-4" />Password</label>
              <Input type="password" placeholder="........" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-white/5 border-gray-600 text-white placeholder:text-gray-500" />
            </div>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-2 rounded">{error}</div>}
            <Button type="submit" disabled={isLoading} className="w-full bg-[#2a1636] hover:bg-[#3a2050] text-white">
              {isLoading ? 'Loading...' : <><LogIn className="w-4 h-4 mr-2" />{isSignUp ? 'Sign Up' : 'Sign In'}</>}
            </Button>
            <p className="text-center text-sm text-gray-400">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-purple-400 hover:underline">
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
