import { localCache } from '../services/cache';
import { supabase } from '../services/supabase';

const CHECK_INTERVAL_MS = 30_000;

class AlarmChecker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private activeUserId: string | null = null;

  start(userId: string) {
    this.activeUserId = userId;
    if (this.intervalId) return;

    console.log('[Alarms] 🔔 Alarm checker started');

    this.firePastDueAlarms();

    this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  setUserId(userId: string | null) {
    this.activeUserId = userId;
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Alarms] 🔔 Alarm checker stopped');
    }
  }

  private async check() {
    if (!this.activeUserId) return;

    const alarms = localCache.getUnnotifiedAlarms(this.activeUserId);
    for (const alarm of alarms) {
      await this.fireAlarm(alarm);
    }
  }

  private async firePastDueAlarms() {
    if (!this.activeUserId) return;

    const alarms = localCache.getPastUndoneAlarms(this.activeUserId);
    console.log(`[Alarms] 📋 ${alarms.length} past-due alarms on startup`);

    for (const alarm of alarms) {
      await this.fireAlarm(alarm);
    }
  }

  private async fireAlarm(alarm: { task_id: number; user_id: string; text: string; due_date: string }) {
    console.log(`[Alarms] 🔔 Firing alarm: "${alarm.text}" (due: ${alarm.due_date})`);

    localCache.markAlarmNotified(alarm.task_id, alarm.user_id);

    try {
      await supabase.updateTask(alarm.user_id, alarm.task_id, { due_date: null });
      console.log(`[Alarms] ✅ Cleared due_date for task ${alarm.task_id}`);
    } catch (err) {
      console.error('[Alarms] ❌ Failed to clear due_date:', err);
    }
  }
}

export const alarmChecker = new AlarmChecker();
