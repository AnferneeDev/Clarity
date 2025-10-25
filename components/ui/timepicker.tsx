// src/renderer/components/ui/timepicker.tsx
import React, { useEffect, useState } from "react";

interface TimePickerProps {
  date: Date | null;
  setDate: (d: Date | null) => void;
}

/**
 * Simple TimePicker (input version)
 * - Hour: number input 1..12
 * - Minute: number input 0..59
 * - AM/PM toggle
 * - Matches card style used elsewhere (white card, black text; selected = black bg + white text)
 */
export function TimePicker({ date, setDate }: TimePickerProps) {
  const derive = (d: Date | null) => {
    if (!d) return { hour: 12, minute: 0, ampm: "AM" as "AM" | "PM" };
    const h24 = d.getHours();
    const ampm = h24 >= 12 ? "PM" : "AM";
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { hour: hour12, minute: d.getMinutes(), ampm };
  };

  const initial = derive(date);

  const [hour, setHour] = useState<number>(initial.hour);
  const [minute, setMinute] = useState<number>(initial.minute);
  const [ampm, setAmpm] = useState<"AM" | "PM">(initial.ampm);

  // keep in sync if parent changes the date prop
  useEffect(() => {
    const d = derive(date);
    setHour(d.hour);
    setMinute(d.minute);
    setAmpm(d.ampm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // clamp helpers
  const clampHour = (v: number) => Math.max(1, Math.min(12, Math.floor(v || 0)));
  const clampMinute = (v: number) => Math.max(0, Math.min(59, Math.floor(v || 0)));

  const apply = (h: number, m: number, am: "AM" | "PM") => {
    const base = date ? new Date(date) : new Date();
    let h24 = h;
    if (h === 12) {
      // Handle midnight and noon
      h24 = am === "AM" ? 0 : 12;
    } else {
      h24 = am === "PM" ? h + 12 : h;
    }
    base.setHours(h24, m, 0, 0);
    setDate(base);
  };

  const onHourChange = (raw: string) => {
    const n = raw === "" ? NaN : Number(raw);
    const v = Number.isFinite(n) ? clampHour(n) : hour;
    setHour(v);
    if (Number.isFinite(n)) apply(v, minute, ampm);
  };

  const onMinuteChange = (raw: string) => {
    const n = raw === "" ? NaN : Number(raw);
    const v = Number.isFinite(n) ? clampMinute(n) : minute;
    setMinute(v);
    if (Number.isFinite(n)) apply(hour, v, ampm);
  };

  const onAmpmToggle = (next: "AM" | "PM") => {
    setAmpm(next);
    apply(hour, minute, next);
  };

  // CHANGED: Create a readable display string from the full date object.
  const displayString = date
    ? date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "No time selected";

  return (
    <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 w-auto max-w-md">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-700">Pick time</div>
      </div>

      <div className="flex gap-3 items-center">
        {/* Hour input */}
        <div className="flex flex-col items-center">
          <div className="text-xs text-gray-600 mb-1">Hour</div>
          <input
            aria-label="hour"
            inputMode="numeric"
            pattern="[0-9]*"
            type="number"
            min={1}
            max={12}
            value={String(hour)}
            onChange={(e) => onHourChange(e.target.value)}
            onBlur={() => {
              const v = clampHour(Number(hour));
              setHour(v);
              apply(v, minute, ampm);
            }}
            className="w-20 text-center rounded-lg border border-gray-100 px-3 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="text-2xl font-semibold text-gray-800">:</div>

        {/* Minute input */}
        <div className="flex flex-col items-center">
          <div className="text-xs text-gray-600 mb-1">Minute</div>
          <input
            aria-label="minute"
            inputMode="numeric"
            pattern="[0-9]*"
            type="number"
            min={0}
            max={59}
            value={String(minute).padStart(2, "0")} // Pad minutes for display
            onChange={(e) => onMinuteChange(e.target.value)}
            onBlur={() => {
              const v = clampMinute(Number(minute));
              setMinute(v);
              apply(hour, v, ampm);
            }}
            className="w-20 text-center rounded-lg border border-gray-100 px-3 py-2 bg-white text-black focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* AM/PM */}
        <div className="flex flex-col items-center ml-2">
          <div className="text-xs text-gray-600 mb-1">AM / PM</div>
          <div className="flex flex-col gap-2">
            <button onClick={() => onAmpmToggle("AM")} className={`px-4 py-1.5 rounded-md text-sm ${ampm === "AM" ? "bg-black text-white" : "bg-white text-black border border-gray-200"}`}>
              AM
            </button>
            <button onClick={() => onAmpmToggle("PM")} className={`px-4 py-1.5 rounded-md text-sm ${ampm === "PM" ? "bg-black text-white" : "bg-white text-black border border-gray-200"}`}>
              PM
            </button>
          </div>
        </div>
      </div>

      {/* CHANGED: Use the new displayString to show the full date and time. */}
      <div className="mt-4 text-sm text-gray-600">
        Selected: <span className="font-medium text-gray-800">{displayString}</span>
      </div>
    </div>
  );
}

export default TimePicker;
