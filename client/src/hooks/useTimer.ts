import { useState, useEffect, useCallback } from 'react';
import type { TimerStatus } from '../types';

interface TimerData {
  minutes: number;
  seconds: number;
  totalSeconds: number;
  status: TimerStatus;
  displayTime: string;
  percentRemaining: number;
}

export function useTimer(deadline: string | null, intervalMinutes: number = 60, warningMinutes: number = 5): TimerData {
  const calcTimer = useCallback((): TimerData => {
    if (!deadline) {
      return { minutes: 0, seconds: 0, totalSeconds: 0, status: 'green', displayTime: '--:--', percentRemaining: 100 };
    }

    const now = new Date().getTime();
    const end = new Date(deadline).getTime();
    const diff = end - now;
    const totalIntervalSeconds = intervalMinutes * 60;

    if (diff <= 0) {
      const overdueSecs = Math.abs(Math.floor(diff / 1000));
      const overMin = Math.floor(overdueSecs / 60);
      const overSec = overdueSecs % 60;
      return {
        minutes: -overMin,
        seconds: overSec,
        totalSeconds: -overdueSecs,
        status: 'expired',
        displayTime: `-${String(overMin).padStart(2, '0')}:${String(overSec).padStart(2, '0')}`,
        percentRemaining: 0,
      };
    }

    const totalSecs = Math.floor(diff / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;

    let status: TimerStatus = 'green';
    if (totalSecs <= 0) {
      status = 'expired';
    } else if (totalSecs <= warningMinutes * 60) {
      status = 'orange';
    }

    return {
      minutes: mins,
      seconds: secs,
      totalSeconds: totalSecs,
      status,
      displayTime: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      percentRemaining: Math.min(100, (totalSecs / totalIntervalSeconds) * 100),
    };
  }, [deadline, intervalMinutes, warningMinutes]);

  const [timer, setTimer] = useState<TimerData>(calcTimer);

  useEffect(() => {
    setTimer(calcTimer());
    const interval = setInterval(() => {
      setTimer(calcTimer());
    }, 1000);
    return () => clearInterval(interval);
  }, [calcTimer]);

  return timer;
}
