import React from "react";
import SetupCard from "../SetupCard";
import TimerCard from "../TimerCard";
import { TimerProvider, useTimerContext } from "../context/TimerContext";

function TimerContent() {
  const { error } = useTimerContext();

  return (
    <div className="h-full flex flex-col p-2 mt-6">
      {error && <div className="bg-red-500 text-white p-2 rounded mb-4 text-center">{error}</div>}
      <div className="flex-1 grid md:grid-cols-2 gap-6">
        <TimerCard className="order-1" />
        <SetupCard className="order-2" />
      </div>
    </div>
  );
}

export default function TimerView() {
  return (
    <TimerProvider>
      <TimerContent />
    </TimerProvider>
  );
}
