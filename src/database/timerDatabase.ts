// src/main/timerDatabase.ts
import { app } from "electron";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { localDateString } from "../timeUtils"; // ADDED: Import local time utility

export interface TimerData {
  id: number;
  subject: string; // normalized to lowercase
  date: string; // YYYY-MM-DD in local time
  total_minutes: number;
  last_updated: string;
}

export interface HiddenSubject {
  id: number;
  subject: string; // normalized to lowercase
  hidden_at: string;
}

class TimerDatabase {
  private basePath: string;

  constructor() {
    this.basePath = app.getPath("userData");
    this.ensureFilesExist();
  }

  private ensureFilesExist() {
    const files = {
      "timer_data.csv": "id,subject,date,total_minutes,last_updated",
      "hidden_subjects.csv": "id,subject,hidden_at",
    };

    Object.entries(files).forEach(([filename, headers]) => {
      const filePath = path.join(this.basePath, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, headers);
      }
    });
  }

  private readCSV<T>(filename: string): T[] {
    try {
      const filePath = path.join(this.basePath, filename);
      if (!fs.existsSync(filePath)) return [];

      const csvString = fs.readFileSync(filePath, "utf8");
      const result = Papa.parse<T>(csvString, {
        header: true,
        skipEmptyLines: true,
      });

      return result.data.map((row) => {
        const converted: any = { ...row };
        if ("id" in converted) converted.id = Number(converted.id);
        if ("total_minutes" in converted) converted.total_minutes = Number(converted.total_minutes);
        return converted;
      });
    } catch (error) {
      console.error(`[TimerDB] Error reading ${filename}:`, error);
      return [];
    }
  }

  private writeCSV<T>(filename: string, data: T[]): void {
    const filePath = path.join(this.basePath, filename);
    const tempFilePath = `${filePath}.tmp`;
    const backupFilePath = `${filePath}.bak`;

    try {
      const csvString = Papa.unparse(data);
      fs.writeFileSync(tempFilePath, csvString, "utf8");
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, backupFilePath);
      }
      fs.renameSync(tempFilePath, filePath);
    } catch (error) {
      console.error(`[TimerDB] CRITICAL WRITE ERROR for ${filename}:`, error);
      try {
        if (fs.existsSync(backupFilePath)) {
          fs.renameSync(backupFilePath, filePath);
        }
      } catch (restoreError) {
        console.error(`[TimerDB] FATAL: Could not restore backup for ${filename}:`, restoreError);
      }
      throw error;
    }
  }

  private getNextId<T extends { id: number }>(data: T[]): number {
    if (data.length === 0) return 1;
    return Math.max(...data.map((item) => item.id)) + 1;
  }

  private normalizeSubject(subject: string): string {
    return subject.trim().toLowerCase();
  }

  // CHANGED: Use localDateString to ensure local time
  private getCurrentLocalDate(): string {
    return localDateString();
  }

  // Check if subject exists (case-insensitive)
  checkIfSubjectExists(subject: string): boolean {
    const normalized = this.normalizeSubject(subject);
    const timerData = this.readCSV<TimerData>("timer_data.csv");
    return timerData.some((entry) => this.normalizeSubject(entry.subject) === normalized);
  }

  // Add or update timer data for a subject on a specific date
  addOrUpdateTimerData(subject: string, date?: string, minutesToAdd: number = 1): TimerData {
    const normalizedSubject = this.normalizeSubject(subject);
    // CHANGED: Use provided date or current local date
    const actualDate = date || this.getCurrentLocalDate();

    const timerData = this.readCSV<TimerData>("timer_data.csv");

    // Find existing entry for this subject and date
    const existingEntry = timerData.find((entry) => this.normalizeSubject(entry.subject) === normalizedSubject && entry.date === actualDate);

    if (existingEntry) {
      // Update existing entry
      existingEntry.total_minutes += minutesToAdd;
      existingEntry.last_updated = new Date().toISOString();
      this.writeCSV("timer_data.csv", timerData);
      console.log(`[TimerDB] Updated subject "${normalizedSubject}" on ${actualDate}: +${minutesToAdd} minutes = ${existingEntry.total_minutes} total`);
      return existingEntry;
    } else {
      // Create new entry
      const id = this.getNextId(timerData);
      const newEntry: TimerData = {
        id,
        subject: normalizedSubject,
        date: actualDate,
        total_minutes: minutesToAdd,
        last_updated: new Date().toISOString(),
      };
      timerData.push(newEntry);
      this.writeCSV("timer_data.csv", timerData);
      console.log(`[TimerDB] Created new subject "${normalizedSubject}" on ${actualDate}: ${minutesToAdd} minutes`);
      return newEntry;
    }
  }

  // Get all timer data (for stats)
  getAllTimerData(): TimerData[] {
    return this.readCSV<TimerData>("timer_data.csv");
  }

  // Get timer data by date range (dates should be in YYYY-MM-DD local format)
  getTimerDataByDateRange(startDate: string, endDate: string): TimerData[] {
    const allData = this.getAllTimerData();
    return allData.filter((entry) => entry.date >= startDate && entry.date <= endDate);
  }

  // Get all unique subjects (for timer view dropdown)
  getAllSubjects(): string[] {
    const timerData = this.getAllTimerData();
    const hiddenSubjects = this.getHiddenSubjects();

    const allSubjects = [...new Set(timerData.map((entry) => entry.subject))];

    // Filter out hidden subjects
    return allSubjects.filter((subject) => !hiddenSubjects.includes(subject));
  }

  // Hide a subject (frontend only)
  hideSubject(subject: string): boolean {
    const normalizedSubject = this.normalizeSubject(subject);
    const hiddenSubjects = this.readCSV<HiddenSubject>("hidden_subjects.csv");

    // Check if already hidden
    if (hiddenSubjects.some((hs) => hs.subject === normalizedSubject)) {
      console.log(`[TimerDB] Subject "${normalizedSubject}" is already hidden`);
      return false;
    }

    const id = this.getNextId(hiddenSubjects);
    const newHiddenSubject: HiddenSubject = {
      id,
      subject: normalizedSubject,
      hidden_at: new Date().toISOString(),
    };

    hiddenSubjects.push(newHiddenSubject);
    this.writeCSV("hidden_subjects.csv", hiddenSubjects);
    console.log(`[TimerDB] Hidden subject: "${normalizedSubject}"`);
    return true;
  }

  // Unhide a subject
  unhideSubject(subject: string): boolean {
    const normalizedSubject = this.normalizeSubject(subject);
    const hiddenSubjects = this.readCSV<HiddenSubject>("hidden_subjects.csv");

    const filtered = hiddenSubjects.filter((hs) => hs.subject !== normalizedSubject);

    if (filtered.length === hiddenSubjects.length) {
      console.log(`[TimerDB] Subject "${normalizedSubject}" was not hidden`);
      return false;
    }

    this.writeCSV("hidden_subjects.csv", filtered);
    console.log(`[TimerDB] Unhidden subject: "${normalizedSubject}"`);
    return true;
  }

  // Get all hidden subjects
  getHiddenSubjects(): string[] {
    const hiddenSubjects = this.readCSV<HiddenSubject>("hidden_subjects.csv");
    return hiddenSubjects.map((hs) => hs.subject);
  }

  // Completely delete a subject and all its data
  deleteSubjectCompletely(subject: string): boolean {
    const normalizedSubject = this.normalizeSubject(subject);

    // Remove from timer data
    const timerData = this.readCSV<TimerData>("timer_data.csv");
    const filteredTimerData = timerData.filter((entry) => entry.subject !== normalizedSubject);

    // Remove from hidden subjects
    const hiddenSubjects = this.readCSV<HiddenSubject>("hidden_subjects.csv");
    const filteredHiddenSubjects = hiddenSubjects.filter((hs) => hs.subject !== normalizedSubject);

    let deleted = false;

    if (filteredTimerData.length < timerData.length) {
      this.writeCSV("timer_data.csv", filteredTimerData);
      deleted = true;
      console.log(`[TimerDB] Deleted all timer data for subject: "${normalizedSubject}"`);
    }

    if (filteredHiddenSubjects.length < hiddenSubjects.length) {
      this.writeCSV("hidden_subjects.csv", filteredHiddenSubjects);
      console.log(`[TimerDB] Removed subject "${normalizedSubject}" from hidden subjects`);
    }

    if (!deleted) {
      console.log(`[TimerDB] No data found for subject: "${normalizedSubject}"`);
    }

    return deleted;
  }

  // Get subject totals by date range (for stats display)
  getSubjectTotalsByDateRange(startDate?: string, endDate?: string): Array<{ subject: string; total_minutes: number }> {
    let data: TimerData[];

    if (startDate && endDate) {
      data = this.getTimerDataByDateRange(startDate, endDate);
    } else {
      data = this.getAllTimerData();
    }

    const totals = new Map<string, number>();

    data.forEach((entry) => {
      const current = totals.get(entry.subject) || 0;
      totals.set(entry.subject, current + entry.total_minutes);
    });

    return Array.from(totals.entries())
      .map(([subject, total_minutes]) => ({
        subject,
        total_minutes,
      }))
      .sort((a, b) => b.total_minutes - a.total_minutes);
  }

  // Get daily aggregated data (for table view with dates)
  getDailyAggregatedData(startDate?: string, endDate?: string): Array<{ date: string; total_minutes: number; subjects: string[] }> {
    let data: TimerData[];

    if (startDate && endDate) {
      data = this.getTimerDataByDateRange(startDate, endDate);
    } else {
      data = this.getAllTimerData();
    }

    const dailyMap = new Map<string, { total_minutes: number; subjects: Set<string> }>();

    data.forEach((entry) => {
      if (!dailyMap.has(entry.date)) {
        dailyMap.set(entry.date, { total_minutes: 0, subjects: new Set() });
      }

      const dayData = dailyMap.get(entry.date)!;
      dayData.total_minutes += entry.total_minutes;
      dayData.subjects.add(entry.subject);
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        total_minutes: data.total_minutes,
        subjects: Array.from(data.subjects),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // Get subject-date aggregated data (for detailed table view)
  getSubjectDateAggregatedData(startDate?: string, endDate?: string): Array<{ subject: string; date: string; total_minutes: number }> {
    let data: TimerData[];

    if (startDate && endDate) {
      data = this.getTimerDataByDateRange(startDate, endDate);
    } else {
      data = this.getAllTimerData();
    }

    return data
      .map((entry) => ({
        subject: entry.subject,
        date: entry.date,
        total_minutes: entry.total_minutes,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // ADDED: Helper to get current week range (Monday to Sunday)
  getCurrentWeekRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust so Monday is first day of week

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: localDateString(monday),
      endDate: localDateString(sunday),
    };
  }

  // ADDED: Helper to get current month range
  getCurrentMonthRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const startDate = localDateString(new Date(year, month, 1));
    const endDate = localDateString(new Date(year, month + 1, 0)); // Last day of month

    return { startDate, endDate };
  }

  // ADDED: Helper to get current year range
  getCurrentYearRange(): { startDate: string; endDate: string } {
    const year = new Date().getFullYear();
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }
}

export const timerDb = new TimerDatabase();
