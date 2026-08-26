import { useEffect, useState } from "react";

export function useElapsedSeconds(running: boolean) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;

    const startedAt = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );

    return () => {
      clearInterval(timer);
      setSeconds(0);
    };
  }, [running]);

  return running ? seconds : 0;
}
