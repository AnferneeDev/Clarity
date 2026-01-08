"use client";

import React, { useState, useEffect } from "react";
import StatsDisplay from "./StatsDisplay";
import dataService from "../../src/services/dataService";

interface Session {
  id: string;
  subject_name: string;
  date: string;
  duration_minutes: number;
}

export default function StatsView() {
  const [viewMode, setViewMode] = useState<"progress" | "table">("table");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Load sessions from dataService
  const loadSessions = () => {
    const allSessions = dataService.getTimerSessions();
    // Map to the format expected by StatsDisplay
    setSessions(allSessions.map(s => ({
      id: s.id,
      subject_name: s.subjectName,
      date: s.date,
      duration_minutes: s.minutes,
    })));
  };

  useEffect(() => {
    setLoading(true);
    loadSessions();
    setLoading(false);
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
