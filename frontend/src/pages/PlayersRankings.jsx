import React, { useEffect } from "react";
import Players from "./Players";

export default function PlayersRankings() {
  // Force Analyze tab on mount via query string for now
  useEffect(() => {
    const hasTab = new URLSearchParams(window.location.search).get('tab');
    if (!hasTab) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'analyze');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);
  return <Players />;
}


