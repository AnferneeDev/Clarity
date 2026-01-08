// src/renderer/components/SetupCard.tsx
"use client";

import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { useTimerContext } from "./context/TimerContext";

export default function SetupCard({ className }: { className?: string }) {
  const {
    subjects,
    selectedSubject,
    focusMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    allowLongTimers,
    autoStartBreaks,
    isRunning,
    handleSubjectChange,
    handleAddSubject,
    setFocusMinutes,
    setShortBreakMinutes,
    setLongBreakMinutes,
    setAllowLongTimers,
    setAutoStartBreaks,
    handleHideSubject,
  } = useTimerContext();

  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");

  const subjectList = subjects || [];

  const optionActiveClass = "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] transition-all hover:brightness-110";
  const optionInactiveClass = "bg-gray-400/80 text-white/90 border-gray-700/50 hover:bg-[var(--accent-primary)]/50 hover:border-[var(--accent-primary)]/70";

  const focusOptions = [
    { key: "25m", label: "25m", minutes: 25 },
    { key: "30m", label: "30m", minutes: 30 },
    { key: "50m", label: "50m", minutes: 50 },
    { key: "60m", label: "60m", minutes: 60 },
    { key: "70m", label: "70m", minutes: 70 },
    { key: "90m", label: "90m", minutes: 90 },
  ];
  const shortBreakOptions = [
    { key: "5m", label: "5m", minutes: 5 },
    { key: "10m", label: "10m", minutes: 10 },
    { key: "20m", label: "20m", minutes: 20 },
  ];
  const longBreakOptions = [
    { key: "15m", label: "15m", minutes: 15 },
    { key: "20m", label: "20m", minutes: 20 },
    { key: "30m", label: "30m", minutes: 30 },
  ];

  function isActive(a: number, b: number) {
    return Math.abs((a || 0) - (b || 0)) < 0.001;
  }

  const handleDisabledClick = () => {
    if (isRunning) {
      alert("Please pause or reset the timer to change settings.");
    }
  };

  const handleAdd = () => {
    const name = newSubject.trim();
    if (!name) return;
    handleAddSubject(name);
    setNewSubject("");
    setSubjectDialogOpen(false);
  };

  function capitalize(s: string) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return (
    <Card className={`relative glass-card shadow-lg border border-glass-border ${className || ""}`}>
      {isRunning && <div className="absolute inset-0 z-10 cursor-not-allowed" onClick={handleDisabledClick} title="Please pause or reset the timer to change settings." />}

      <CardContent className="space-y-3 pt-1">
        {/* Subjects */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">Subjects</Label>
          <div className="grid grid-cols-2 gap-2">
            {subjectList.map((subject) => (
              <div key={subject} className="relative group">
                <Button size="sm" className={`w-full justify-center text-white ${selectedSubject === subject ? optionActiveClass : optionInactiveClass}`} onClick={() => handleSubjectChange(subject)} disabled={isRunning}>
                  {capitalize(subject)}
                </Button>
                {!isRunning && (
                  <button
                    type="button"
                    title={`Hide ${subject}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHideSubject(subject);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <div className="relative">
              <Button size="sm" className={`w-full justify-center text-white ${optionInactiveClass} flex items-center gap-2`} onClick={() => setSubjectDialogOpen(true)} disabled={isRunning}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Focus Options */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">Focus Duration</Label>
          <div className="grid grid-cols-3 gap-2">
            {focusOptions.map((opt) => (
              <Button key={opt.key} size="sm" className={`w-full text-white ${isActive(opt.minutes, focusMinutes) ? optionActiveClass : optionInactiveClass}`} onClick={() => setFocusMinutes(opt.minutes)} disabled={isRunning}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Short Break Options */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">Short Break</Label>
          <div className="grid grid-cols-3 gap-2">
            {shortBreakOptions.map((opt) => (
              <Button key={opt.key} size="sm" className={`w-full text-white ${isActive(opt.minutes, shortBreakMinutes) ? optionActiveClass : optionInactiveClass}`} onClick={() => setShortBreakMinutes(opt.minutes)} disabled={isRunning}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {allowLongTimers && (
          <div className="space-y-3">
            <Label className="text-white text-sm font-medium">Long Break</Label>
            <div className="grid grid-cols-3 gap-2">
              {longBreakOptions.map((opt) => (
                <Button key={opt.key} size="sm" className={`w-full text-white ${isActive(opt.minutes, longBreakMinutes) ? optionActiveClass : optionInactiveClass}`} onClick={() => setLongBreakMinutes(opt.minutes)} disabled={isRunning}>
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Toggles Row */}
        <div className="flex items-center justify-between pt-4 gap-6">
          <div className="flex items-center gap-2">
            <Label className="text-white text-sm font-medium">Enable Long Breaks</Label>
            <Switch checked={allowLongTimers} onCheckedChange={(v) => setAllowLongTimers(Boolean(v))} disabled={isRunning} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-white text-sm font-medium">Auto Start Pomodoros/Breaks</Label>
            <Switch checked={autoStartBreaks} onCheckedChange={(v) => setAutoStartBreaks(Boolean(v))} disabled={isRunning} />
          </div>
        </div>
      </CardContent>

      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new subject</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input placeholder="Enter subject name" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
          </div>
          <DialogFooter>
            <Button className="bg-gray-400/80 text-white hover:bg-[var(--accent-primary)]/50 hover:border-[var(--accent-primary)]/70" onClick={handleAdd}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
