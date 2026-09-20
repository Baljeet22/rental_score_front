import { HttpErrorResponse } from '@angular/common/http';

export function apiErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse)) return { detail: 'Something went wrong. Please try again.' };
  if (error.status === 0) return { detail: 'We could not connect. Check your connection and try again.' };
  if (error.status >= 500) return { detail: 'The service is temporarily unavailable. Please try again shortly.' };
  if (error.status === 429) return { detail: 'Too many attempts. Please wait a moment before trying again.' };
  if (error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(error.error as Record<string, unknown>)) {
      if (typeof value === 'string') fields[key] = value;
      else if (Array.isArray(value)) fields[key] = value.filter((item) => typeof item === 'string').join(' ');
    }
    if (Object.keys(fields).length) return fields;
  }
  return { detail: 'The request could not be completed. Please try again.' };
}
