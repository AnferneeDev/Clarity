"use client";

import React, { useState, useEffect } from "react";
import StatsDisplay from "./StatsDisplay";

interface Session {
  id: number;
  subject_name: string;
  phase: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  paused_seconds: number;
  pomodoros?: number;
}

export default function StatsView() {
  const [viewMode, setViewMode] = useState<"progress" | "table">("table"); // Changed from "progress" to "table"
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Load sessions for current month
  const loadSessions = async () => {
    try {
      const now = new Date();
      const sessionsData = await window.electronAPI.getSessionsForMonth(now.getFullYear(), now.getMonth() + 1);
      setSessions(sessionsData);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadSessions();
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-glass-text-muted"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatsDisplay sessions={sessions} viewMode={viewMode} setViewMode={setViewMode} />
    </div>
  );
}
