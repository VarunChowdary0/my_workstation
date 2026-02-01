import { useEffect, useRef, useCallback } from 'react';
import { assessmentService } from '@/services/assessmentService';
import { FileNode } from '@/types/types';

interface UseAutoSyncOptions {
  token: string | null;
  files: FileNode[];
  enabled: boolean;
  intervalMs?: number;
  onSyncStart?: () => void;
  onSyncSuccess?: (syncCount: number, lastSyncedAt: string) => void;
  onSyncError?: (error: unknown) => void;
  onAlreadySubmitted?: () => void;
}

export function useAutoSync({
  token,
  files,
  enabled,
  intervalMs = 45000,
  onSyncStart,
  onSyncSuccess,
  onSyncError,
  onAlreadySubmitted,
}: UseAutoSyncOptions) {
  const isSyncingRef = useRef(false);
  const filesRef = useRef(files);
  filesRef.current = files;

  const doSync = useCallback(async () => {
    if (!token || !enabled || isSyncingRef.current) return;

    isSyncingRef.current = true;
    onSyncStart?.();
    try {
      const result = await assessmentService.syncFiles(token, filesRef.current);
      onSyncSuccess?.(result.sync_count, result.last_synced_at);
    } catch (error: any) {
      if (error?.response?.status === 410) {
        onAlreadySubmitted?.();
      } else {
        onSyncError?.(error);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [token, enabled, onSyncStart, onSyncSuccess, onSyncError, onAlreadySubmitted]);

  useEffect(() => {
    if (!enabled || !token) return;

    const initialTimeout = setTimeout(doSync, 5000);
    const interval = setInterval(doSync, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [doSync, enabled, token, intervalMs]);

  return { syncNow: doSync };
}
