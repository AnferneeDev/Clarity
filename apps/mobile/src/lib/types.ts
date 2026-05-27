// ============================================
// Shared domain types
// ============================================

export type TimerPhase = 'focus' | 'short' | 'long';

export interface Subject {
  id: string;
  name: string;
  is_hidden: boolean;
}

export interface SubjectTotal {
  subject: string;
  total_minutes: number;
}

export interface SubjectDateRow {
  subject: string;
  date: string;
  total_minutes: number;
}
