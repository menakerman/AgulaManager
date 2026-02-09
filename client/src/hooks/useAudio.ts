import { useCallback, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useAudio() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAlert = useCallback((type: 'warning' | 'overdue' | 'emergency') => {
    if (!soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different sounds for different alert types
      switch (type) {
        case 'warning':
          oscillator.frequency.value = 440;
          gainNode.gain.value = 0.3;
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.3);
          break;
        case 'overdue':
          oscillator.frequency.value = 660;
          gainNode.gain.value = 0.5;
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.5);
          break;
        case 'emergency':
          oscillator.type = 'sawtooth';
          oscillator.frequency.value = 880;
          gainNode.gain.value = 0.7;
          oscillator.start();
          // Pulsing effect
          const now = ctx.currentTime;
          for (let i = 0; i < 5; i++) {
            gainNode.gain.setValueAtTime(0.7, now + i * 0.2);
            gainNode.gain.setValueAtTime(0, now + i * 0.2 + 0.1);
          }
          oscillator.stop(now + 1);
          break;
      }
    } catch (err) {
      console.warn('Audio playback failed:', err);
    }
  }, [soundEnabled]);

  return { playAlert };
}
