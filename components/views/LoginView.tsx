import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface LoginViewProps {
  onLoginSuccess: (user: { id: string; username: string }) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill all fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        const res = await window.electronAPI.auth.register(username, password);
        if ("error" in res) {
          setError(res.error);
        } else {
          localStorage.setItem("clarity_user_id", res.id);
          localStorage.setItem("clarity_username", res.username);
          onLoginSuccess({ id: res.id, username: res.username });
        }
      } else {
        const user = await window.electronAPI.auth.login(username, password);
        if (user) {
          localStorage.setItem("clarity_user_id", user.id);
          localStorage.setItem("clarity_username", user.username);
          onLoginSuccess(user);
        } else {
          setError("Invalid username or password");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-[350px] glass-card border-glass-border shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-white text-center">
            {isRegistering ? "Create Account" : "Access Clarity"}
          </CardTitle>
          <CardDescription className="text-gray-400 text-center">
            {isRegistering ? "Start your journey" : "Enter your credentials"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-300">Username</Label>
              <Input
                id="username"
                placeholder="Anfernee"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black/20 border-gray-600 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/20 border-gray-600 text-white placeholder:text-gray-500"
              />
            </div>
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
              {loading ? "Processing..." : isRegistering ? "Register" : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" className="text-gray-400 hover:text-white" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Already have an account? Sign In" : "Need an account? Register"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
