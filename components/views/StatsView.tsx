"use client";

import React, { useState } from "react";
import StatsDisplay from "./StatsDisplay";

export default function StatsView() {
  const [viewMode, setViewMode] = useState<"progress" | "table">("table");

  return (
    <div className="space-y-6">
      <StatsDisplay viewMode={viewMode} setViewMode={setViewMode} />
    </div>
  );
}
