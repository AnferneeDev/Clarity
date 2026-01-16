import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface LoginViewProps {
  onLoginSuccess: (user: { id: string; username: string }) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      setError("Please enter a username");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await window.electronAPI.auth.login(username);
      if (user) {
        localStorage.setItem("clarity_user_id", user.id);
        localStorage.setItem("clarity_username", user.username);
        onLoginSuccess(user);
      } else {
        setError("User not found");
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
            Access Clarity
          </CardTitle>
          <CardDescription className="text-gray-400 text-center">
            Enter your credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-300">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Type your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black/20 border-gray-600 text-white placeholder:text-gray-500"
                autoFocus
              />
            </div>
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
              {loading ? "Processing..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
