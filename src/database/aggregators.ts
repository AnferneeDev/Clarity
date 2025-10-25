// src/database/aggregators.ts
import { query } from "./crud";
import { getSessionsForDate, getDailyStatsByDate, getAllSessionsFromStore, getDailyStats } from "./store";
import { localDateString } from "../timeUtils";

/**
 * Returns dashboard data:
 * - sessions: sessions for date (from store)
 * - dailyLog: aggregated totals (time / paused mins) (from store)
 * - subjects: subjects from csv (kept for todo/background compatibility)
 * - todos: from csv (unchanged)
 */
export function getPomodoroDashboardData(date: string = localDateString()) {
  const todaySessions = getSessionsForDate(date);

  const dailyRows = getDailyStatsByDate(date);
  const totalMinutes = dailyRows.reduce((acc: number, r) => acc + (r.timeInSubject || 0), 0);
  const totalPausedMinutes = dailyRows.reduce((acc: number, r) => acc + (r.pauseMinutes || 0), 0);

  const dailyLog = {
    total_minutes: totalMinutes,
    total_paused_minutes: totalPausedMinutes,
  };

  const subjects = query("subjects", {}, { orderBy: "name" });

  const dbTodos = dbQueryTodosForDate(date);

  return {
    sessions: todaySessions,
    dailyLog,
    subjects,
    todos: dbTodos,
  };
}

/* helper that uses the existing CSV for todos (keeps behavior identical) */
function dbQueryTodosForDate(date: string) {
  const todos = query("todos", { date }, { orderBy: "starred DESC, id" }) as any[];
  const subjects = query("subjects") as any[];

  return todos.map((todo) => {
    const subject = subjects.find((sub) => sub.id === todo.subject_id);
    return {
      ...todo,
      category: subject?.name || null,
    };
  });
}

/**
 * getSubjectTimeStats(startDate?, endDate?) - compute totals by subject from store.dailyStats
 */
export function getSubjectTimeStats(startDate?: string, endDate?: string) {
  const daily = getDailyStatsBetweenDates(startDate, endDate);
  const map: Record<string, { subject: string; total_minutes: number; session_count: number }> = {};

  for (const row of daily) {
    const subject = row.subject;
    if (!map[subject]) map[subject] = { subject, total_minutes: 0, session_count: 0 };
    map[subject].total_minutes += row.timeInSubject;
    map[subject].session_count += 1;
  }

  return Object.values(map).sort((a, b) => b.total_minutes - a.total_minutes);
}

/**
 * getSessionsForMonth(year, month)
 * Uses store sessions.
 */
export function getSessionsForMonth(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];
  const all = getAllSessionsFromStore();
  return all
    .filter((s: any) => {
      const d = localDateString(new Date(s.startTime));
      return d >= startDate && d <= endDate;
    })
    .sort((a: any, b: any) => (b.startTime || 0) - (a.startTime || 0));
}

/* helpers */
function getDailyStatsBetweenDates(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return getDailyStats();
  const all = getDailyStats();
  return all.filter((r) => r.date >= startDate && r.date <= endDate);
}
