import type { BudgetData, SyncStatus } from '../types';
import { getBudgetData, saveBudgetData, saveSyncStatus } from '../services/localStorage';
import { readFromDrive, saveToDrive } from '../services/googleDrive';

export const mergeData = (local: BudgetData, remote: BudgetData): BudgetData => {
  const localTime = new Date(local.lastModifiedAt).getTime();
  const remoteTime = new Date(remote.lastModifiedAt).getTime();
  return remoteTime > localTime ? remote : local;
};

export const performSync = async (accessToken: string): Promise<{ success: boolean; status: SyncStatus }> => {
  try {
    const syncingStatus: SyncStatus = { status: 'syncing', lastSyncedAt: null, error: null };
    saveSyncStatus(syncingStatus);

    const localData = getBudgetData();
    const remoteData = await readFromDrive(accessToken);

    if (remoteData) {
      const mergedData = mergeData(localData, remoteData);
      saveBudgetData(mergedData);
      await saveToDrive(accessToken, mergedData);
    } else {
      await saveToDrive(accessToken, localData);
    }

    const syncedStatus: SyncStatus = { status: 'synced', lastSyncedAt: new Date().toISOString(), error: null };
    saveSyncStatus(syncedStatus);
    return { success: true, status: syncedStatus };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStatus: SyncStatus = { status: 'error', lastSyncedAt: null, error: errorMessage };
    saveSyncStatus(errorStatus);
    return { success: false, status: errorStatus };
  }
};

export const isOnline = (): boolean => navigator.onLine;
