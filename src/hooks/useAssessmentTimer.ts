import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAssessmentTimerOptions {
  startedAt: number | null;
  durationMinutes: number | null;
  onTimeUp?: () => void;
}

interface TimerState {
  remainingSeconds: number;
  isExpired: boolean;
  formattedTime: string;
  progressPercent: number;
}

export function useAssessmentTimer({
  startedAt,
  durationMinutes,
  onTimeUp,
}: UseAssessmentTimerOptions): TimerState {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    (durationMinutes ?? 0) * 60
  );
  const [isExpired, setIsExpired] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!startedAt || !durationMinutes) return;

    firedRef.current = false;
    const totalMs = durationMinutes * 60 * 1000;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.floor((totalMs - elapsed) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        setIsExpired(true);
        onTimeUp?.();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes, onTimeUp]);

  const totalSeconds = (durationMinutes ?? 0) * 60;
  const progressPercent =
    totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const formattedTime =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { remainingSeconds, isExpired, formattedTime, progressPercent };
}
