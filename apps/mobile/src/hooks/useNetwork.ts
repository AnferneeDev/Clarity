import { useState, useEffect } from 'react';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { getNetworkStateAsync } = await import('expo-network');
        const state = await getNetworkStateAsync();
        if (!cancelled) setIsOnline(state.isConnected ?? true);
      } catch {}
    };
    check();
    const interval = setInterval(check, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return isOnline;
}
