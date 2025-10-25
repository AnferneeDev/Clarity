// src/renderer/components/views/StatsDisplay.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, Calendar, Check, RefreshCw, Funnel, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { localDateString } from "../../src/timeUtils";

// CHANGED: Simplified interfaces for new timerDb data
interface SubjectStats {
  subject: string;
  total_minutes: number;
}

interface AggregatedSession {
  subject_name: string;
  date: string;
  total_minutes: number;
}

interface DailyAggregatedSession {
  date: string;
  total_minutes: number;
  subjects: string[];
}

interface FilteredData {
  aggregatedSessions: AggregatedSession[];
  dailyAggregatedSessions: DailyAggregatedSession[];
  subjectStats: SubjectStats[];
  totalMinutes: number;
  dateRange: string;
}

interface TableConfig {
  combinePerDay: boolean;
  showSubject: boolean;
  showDate: boolean;
  showFocusTime: boolean;
}

const DEFAULT_TABLE_CONFIG: TableConfig = {
  combinePerDay: false,
  showSubject: true,
  showDate: true,
  showFocusTime: true,
};

const CONFIG_STORAGE_KEY = "pomodoro-table-config";

const loadTableConfig = (): TableConfig => {
  if (typeof window === "undefined") return DEFAULT_TABLE_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_TABLE_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load table config from localStorage:", error);
  }
  return DEFAULT_TABLE_CONFIG;
};

const saveTableConfig = (config: TableConfig) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save table config to localStorage:", error);
  }
};

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function parseYYYYMMDDToDate(dateStr: string): Date {
  const parts = String(dateStr || "").split("-");
  if (parts.length < 3) return new Date(NaN);
  const [y, m, d] = parts.map((p) => Number(p));
  return new Date(y, (Number.isFinite(m) ? m : 1) - 1, Number.isFinite(d) ? d : 1, 0, 0, 0, 0);
}

function formatDate(date: string) {
  if (!date) return "—";
  const d = parseYYYYMMDDToDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ADDED: Format subject name for display (first letter uppercase)
function formatSubjectName(subject: string): string {
  if (!subject) return "";
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

// CHANGED: Updated to work with local dates
function getDateRangeDisplay(filter: string, customStartDate?: string, customEndDate?: string): string {
  const now = new Date();
  switch (filter) {
    case "day": {
      return localDateString(now);
    }
    case "week": {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
      endOfWeek.setHours(23, 59, 59, 999);
      return `${localDateString(startOfWeek)} – ${localDateString(endOfWeek)}`;
    }
    case "month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${localDateString(startOfMonth)} – ${localDateString(endOfMonth)}`;
    }
    case "year": {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      return `${localDateString(startOfYear)} – ${localDateString(endOfYear)}`;
    }
    case "custom": {
      if (customStartDate && customEndDate) {
        const start = parseYYYYMMDDToDate(customStartDate);
        const end = parseYYYYMMDDToDate(customEndDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Select Date Range";
        return `${localDateString(start)} – ${localDateString(end)}`;
      }
      return "Select Date Range";
    }
    case "all":
    default: {
      return "All Time";
    }
  }
}

// CHANGED: Get date range for filtering
function getDateRangeForFilter(filter: string, customStartDate?: string, customEndDate?: string): { startDate: string; endDate: string } {
  const now = new Date();
  switch (filter) {
    case "day": {
      const today = localDateString(now);
      return { startDate: today, endDate: today };
    }
    case "week": {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
      return { startDate: localDateString(startOfWeek), endDate: localDateString(endOfWeek) };
    }
    case "month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: localDateString(startOfMonth), endDate: localDateString(endOfMonth) };
    }
    case "year": {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      return { startDate: localDateString(startOfYear), endDate: localDateString(endOfYear) };
    }
    case "custom": {
      if (customStartDate && customEndDate) {
        return { startDate: customStartDate, endDate: customEndDate };
      }
      // If no custom dates provided, show all data
      return { startDate: "1970-01-01", endDate: "2100-12-31" };
    }
    case "all":
    default: {
      return { startDate: "1970-01-01", endDate: "2100-12-31" };
    }
  }
}

export default function StatsDisplay({ viewMode, setViewMode }: { viewMode: "progress" | "table"; setViewMode: (mode: "progress" | "table") => void }) {
  const [dateFilter, setDateFilter] = useState<"all" | "year" | "month" | "week" | "day" | "custom">("day");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [tableConfig, setTableConfig] = useState<TableConfig>(() => loadTableConfig());
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // CHANGED: New state for filtered data from timerDb
  const [filteredData, setFilteredData] = useState<FilteredData>({
    aggregatedSessions: [],
    dailyAggregatedSessions: [],
    subjectStats: [],
    totalMinutes: 0,
    dateRange: "",
  });

  // ADDED: State for all subjects (including hidden ones)
  const [allSubjects, setAllSubjects] = useState<string[]>([]);

  // CHANGED: Load data from new timerDb
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("[StatsDisplay] Loading data from timerDb...");

      const { startDate, endDate } = getDateRangeForFilter(dateFilter, customStartDate, customEndDate);
      console.log(`[StatsDisplay] Date range: ${startDate} to ${endDate}`);

      // Load subject totals for the date range
      const subjectTotals = await window.electronAPI.timerDb.getSubjectTotalsByDateRange(startDate, endDate);
      console.log("[StatsDisplay] Loaded subject totals:", subjectTotals);

      // Load daily aggregated data
      const dailyAggregatedData = await window.electronAPI.timerDb.getDailyAggregatedData(startDate, endDate);
      console.log("[StatsDisplay] Loaded daily aggregated data:", dailyAggregatedData);

      // Load subject-date aggregated data
      const subjectDateData = await window.electronAPI.timerDb.getSubjectDateAggregatedData(startDate, endDate);
      console.log("[StatsDisplay] Loaded subject-date data:", subjectDateData);

      // Load all subjects (including hidden ones) for management
      const allTimeSubjects = await window.electronAPI.timerDb.getSubjectTotalsByDateRange("1970-01-01", "2100-12-31");
      const completeSubjectList = allTimeSubjects.map((item) => item.subject);
      setAllSubjects(completeSubjectList);

      // Transform data to match existing interfaces
      const aggregatedSessions: AggregatedSession[] = subjectDateData.map((item) => ({
        subject_name: item.subject,
        date: item.date,
        total_minutes: item.total_minutes,
      }));

      const dailyAggregatedSessions: DailyAggregatedSession[] = dailyAggregatedData.map((item) => ({
        date: item.date,
        total_minutes: item.total_minutes,
        subjects: item.subjects,
      }));

      const subjectStats: SubjectStats[] = subjectTotals.map((item) => ({
        subject: item.subject,
        total_minutes: item.total_minutes,
      }));

      const totalMinutes = subjectTotals.reduce((acc, stat) => acc + stat.total_minutes, 0);

      setFilteredData({
        aggregatedSessions,
        dailyAggregatedSessions,
        subjectStats,
        totalMinutes,
        dateRange: getDateRangeDisplay(dateFilter, customStartDate, customEndDate),
      });
    } catch (error) {
      console.error("[StatsDisplay] Error loading data:", error);
      setFilteredData({
        aggregatedSessions: [],
        dailyAggregatedSessions: [],
        subjectStats: [],
        totalMinutes: 0,
        dateRange: getDateRangeDisplay(dateFilter, customStartDate, customEndDate),
      });
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    saveTableConfig(tableConfig);
  }, [tableConfig]);

  // ADDED: Function to delete subject completely
  const handleDeleteSubject = async (subject: string) => {
    if (window.confirm(`Are you sure you want to permanently delete "${subject}" and all its data? This action cannot be undone.`)) {
      try {
        console.log(`[StatsDisplay] Deleting subject: "${subject}"`);
        await window.electronAPI.timerDb.deleteSubjectCompletely(subject);
        console.log(`[StatsDisplay] Successfully deleted subject: "${subject}"`);

        // Reload data to reflect changes
        await loadData();
      } catch (error) {
        console.error("[StatsDisplay] Failed to delete subject:", error);
        alert("Failed to delete subject. Please try again.");
      }
    }
  };

  const filterButtons = [
    { key: "day", label: "Today" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "custom", label: "Custom" },
    { key: "all", label: "All Time" },
  ];

  const filterActiveClass = "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]";
  const filterInactiveClass = "bg-gray-400/25 text-white/90 border-gray-700/50 hover:bg-white/20";

  const currentTableData = tableConfig.combinePerDay ? filteredData.dailyAggregatedSessions : filteredData.aggregatedSessions;
  const visibleColumnCount = [tableConfig.showSubject, tableConfig.showDate, tableConfig.showFocusTime].filter(Boolean).length;

  const handleConfigChange = (updates: Partial<TableConfig>) => {
    setTableConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleCustomDateChange = (type: "start" | "end", value: string) => {
    if (type === "start") {
      setCustomStartDate(value);
      if (customEndDate && value > customEndDate) {
        setCustomEndDate(value);
      }
    } else {
      setCustomEndDate(value);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-2">
      <div className="glass-card border border-glass-border rounded-2xl flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-5 w-5 text-white" />
              <h2 className="text-xl font-semibold text-white">Study Analytics</h2>
            </div>
            {/* CHANGED: Updated debug info */}
            <div className="text-xs text-white/60">
              Showing {filteredData.subjectStats.length} subjects • {filteredData.totalMinutes} total minutes
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" className="text-white bg-gray-200/50 border-1 border-gray-700/50 hover:bg-white/20" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Popover open={isConfigOpen} onOpenChange={setIsConfigOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="sm" className="text-white bg-gray-200/50 border-1 border-gray-700/50 hover:bg-white/20">
                  <Funnel className="h-4 w-4" /> Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-gray-800 border border-gray-700 text-white max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  <h4 className="font-medium">Table filters</h4>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="combine-per-day" className="text-sm">
                      Combine subjects per day
                    </Label>
                    <Switch id="combine-per-day" checked={tableConfig.combinePerDay} onCheckedChange={(checked) => handleConfigChange({ combinePerDay: checked })} />
                  </div>
                  <div className="border-t border-gray-700 pt-2">
                    <h5 className="text-sm font-medium mb-2">Visible Columns</h5>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-subject" className="text-sm">
                          Subject
                        </Label>
                        <Switch id="show-subject" checked={tableConfig.showSubject} onCheckedChange={(checked) => handleConfigChange({ showSubject: checked })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-date" className="text-sm">
                          Date
                        </Label>
                        <Switch id="show-date" checked={tableConfig.showDate} onCheckedChange={(checked) => handleConfigChange({ showDate: checked })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-focus-time" className="text-sm">
                          Focus Time
                        </Label>
                        <Switch id="show-focus-time" checked={tableConfig.showFocusTime} onCheckedChange={(checked) => handleConfigChange({ showFocusTime: checked })} />
                      </div>
                    </div>
                  </div>

                  {/* ADDED: Subject Management Section */}
                  <div className="border-t border-gray-700 pt-2">
                    <h5 className="text-sm font-medium mb-2">Manage Subjects</h5>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {allSubjects.map((subject) => (
                        <div key={subject} className="flex items-center justify-between gap-2">
                          {/* CHANGED: Format subject name for display */}
                          <span className="text-sm text-white/80 flex-1 truncate" title={subject}>
                            {formatSubjectName(subject)}
                          </span>
                          <Button variant="destructive" size="sm" className="h-6 w-6 p-0 flex-shrink-0 bg-red-600 hover:bg-red-700" onClick={() => handleDeleteSubject(subject)} title={`Delete ${subject} and all its data`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {allSubjects.length === 0 && <div className="text-sm text-white/60 text-center py-2">No subjects found</div>}
                    </div>
                    <div className="text-xs text-white/40 mt-1">Total: {allSubjects.length} subjects</div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button size="sm" onClick={() => setIsConfigOpen(false)} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80">
                      <Check className="h-4 w-4 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as "progress" | "table")}>
              <TabsList className="bg-gray-200/50 border-1 border-gray-700/50">
                <TabsTrigger value="table" className="text-white data-[state=active]:bg-[var(--accent-primary)] data-[state=active]:text-white">
                  Table
                </TabsTrigger>
                <TabsTrigger value="progress" className="text-white data-[state=active]:bg-[var(--accent-primary)] data-[state=active]:text-white">
                  Progress
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex items-center justify-between mb-0 p-2 bg-gray-100/40 rounded-lg border border-gray-700/50 rounded-b-none">
          <div className="flex gap-2 items-center">
            {filterButtons.map((filter) => (
              <Button
                key={filter.key}
                variant="secondary"
                size="sm"
                className={`text-white border-1 transition-all duration-200 ${dateFilter === filter.key ? filterActiveClass : filterInactiveClass}`}
                onClick={() => setDateFilter(filter.key as any)}
              >
                {filter.label}
              </Button>
            ))}
            {dateFilter === "custom" && (
              <div className="ml-2 flex gap-2 items-center">
                <input type="date" value={customStartDate} onChange={(e) => handleCustomDateChange("start", e.target.value)} className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600" />
                <span className="text-white/60">to</span>
                <input type="date" value={customEndDate} onChange={(e) => handleCustomDateChange("end", e.target.value)} className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Calendar className="h-4 w-4" />
              {filteredData.dateRange}
            </div>
          </div>
        </div>

        <div className="flex-1 mb-4 rounded-xl border overflow-auto max-h-[65vh] rounded-t-none border-gray-700/50 bg-gray-400/30 p-0">
          {viewMode === "table" ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100/30 border-gray-700/50">
                  {tableConfig.showSubject && <TableHead className="text-white font-medium">Subject</TableHead>}
                  {tableConfig.showDate && <TableHead className="text-white font-medium">Date</TableHead>}
                  {tableConfig.showFocusTime && <TableHead className="text-white font-medium">Focus Time</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount || 3} className="text-center py-6 text-white/60">
                      Loading data...
                    </TableCell>
                  </TableRow>
                ) : currentTableData.length > 0 ? (
                  currentTableData.map((session, index) => (
                    <TableRow key={`${tableConfig.combinePerDay ? "daily" : "subject"}-${session.date}-${index}`} className="border-gray-700/50 hover:bg-white/10">
                      {/* CHANGED: Format subject name for display */}
                      {tableConfig.showSubject && <TableCell className="text-white">{tableConfig.combinePerDay ? "All" : formatSubjectName((session as AggregatedSession).subject_name) || "—"}</TableCell>}
                      {tableConfig.showDate && <TableCell className="text-white">{formatDate(session.date)}</TableCell>}
                      {tableConfig.showFocusTime && <TableCell className="text-white">{formatMinutes(session.total_minutes || 0)}</TableCell>}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-gray-700/50">
                    <TableCell colSpan={visibleColumnCount || 3} className="text-center py-6 text-white/60">
                      {dateFilter === "custom" && (!customStartDate || !customEndDate) ? "Please select a date range" : "No data found for this range"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="space-y-3 p-4">
              {filteredData.subjectStats
                .filter((s) => s.total_minutes > 0)
                .map((stat) => {
                  const percent = filteredData.totalMinutes > 0 ? (stat.total_minutes / filteredData.totalMinutes) * 100 : 0;
                  return (
                    <div key={stat.subject} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          {/* CHANGED: Format subject name for display */}
                          <span className="font-medium text-white">{formatSubjectName(stat.subject)}</span>
                          <span className="text-sm text-white/80">{formatMinutes(stat.total_minutes)}</span>
                        </div>
                        <div className="w-full bg-gray-700/50 rounded-full h-2">
                          <div className="bg-[var(--accent-primary)] h-2 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              {filteredData.subjectStats.filter((s) => s.total_minutes > 0).length === 0 && (
                <div className="text-center py-8 text-white/60">{dateFilter === "custom" && (!customStartDate || !customEndDate) ? "Please select a date range" : "No study data recorded for this period"}</div>
              )}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-gray-700/50 bg-gray-300/20 overflow-hidden">
          <Table>
            <TableBody>
              <TableRow className="hover:bg-transparent">
                {tableConfig.showSubject && <TableCell className="text-white font-medium text-sm py-4">{filteredData.dateRange} Total</TableCell>}
                {tableConfig.showDate && <TableCell className="text-white py-4"></TableCell>}
                {tableConfig.showFocusTime && <TableCell className="text-white font-medium text-sm py-4">{formatMinutes(filteredData.totalMinutes)}</TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
