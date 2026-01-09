"use client";

import React, { useState } from "react";
import StatsDisplay from "./StatsDisplay";

export default function StatsView() {
  const [viewMode, setViewMode] = useState<"progress" | "table">("table");

  return (
    <div className="h-full w-full overflow-hidden">
      <StatsDisplay viewMode={viewMode} setViewMode={setViewMode} />
    </div>
  );
}
