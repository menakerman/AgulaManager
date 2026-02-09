import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM/yyyy HH:mm:ss');
}

export function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm:ss');
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'dd/MM/yyyy');
}

export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: he });
}

export function formatTimerDisplay(totalSeconds: number): string {
  const isNegative = totalSeconds < 0;
  const abs = Math.abs(totalSeconds);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  const prefix = isNegative ? '-' : '';
  return `${prefix}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatClockTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm');
}

export function getTodayDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
