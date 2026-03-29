import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '…';
}

export function phaseForRound(round: number, phaseConfig: { diverge: number; challenge: number; converge: number }): string {
  if (round <= phaseConfig.diverge) return 'diverge';
  if (round <= phaseConfig.diverge + phaseConfig.challenge) return 'challenge';
  return 'converge';
}

export function totalRounds(phaseConfig: { diverge: number; challenge: number; converge: number }): number {
  return phaseConfig.diverge + phaseConfig.challenge + phaseConfig.converge;
}
