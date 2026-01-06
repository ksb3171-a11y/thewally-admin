import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { BudgetData, Transaction, SubCategory, DetailCategory, ItemCategory, SyncStatus, Toast, MainCategory } from '../types';
import {
  getBudgetData,
  addTransaction as addTransactionToStorage,
  updateTransaction as updateTransactionInStorage,
  deleteTransaction as deleteTransactionFromStorage,
  addSubCategory as addSubCategoryToStorage,
  updateSubCategory as updateSubCategoryInStorage,
  deleteSubCategory as deleteSubCategoryFromStorage,
  reorderSubCategories as reorderSubCategoriesToStorage,
  addDetailCategory as addDetailCategoryToStorage,
  updateDetailCategory as updateDetailCategoryInStorage,
  deleteDetailCategory as deleteDetailCategoryFromStorage,
  addItemCategory as addItemCategoryToStorage,
  updateItemCategory as updateItemCategoryInStorage,
  deleteItemCategory as deleteItemCategoryFromStorage,
  resetCategoriesToDefault,
  getSyncStatus, saveSyncStatus,
} from '../services/localStorage';
import { performSync, isOnline } from '../utils/sync';
import { useAuth } from './AuthContext';

interface DataContextType {
  data: BudgetData;
  syncStatus: SyncStatus;
  toasts: Toast[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => void;
  deleteTransaction: (id: string) => void;
  addSubCategory: (name: string, mainCategory: MainCategory) => SubCategory;
  updateSubCategory: (id: string, updates: Partial<Omit<SubCategory, 'id' | 'createdAt'>>) => void;
  deleteSubCategory: (id: string) => void;
  reorderSubCategories: (orderedIds: string[]) => void;
  addDetailCategory: (name: string, subCategoryId: string) => DetailCategory;
  updateDetailCategory: (id: string, updates: Partial<Omit<DetailCategory, 'id' | 'createdAt'>>) => void;
  deleteDetailCategory: (id: string) => void;
  addItemCategory: (name: string, detailCategoryId: string) => ItemCategory;
  updateItemCategory: (id: string, updates: Partial<Omit<ItemCategory, 'id' | 'createdAt'>>) => void;
  deleteItemCategory: (id: string) => void;
  resetCategories: () => void;
  manualSync: () => Promise<void>;
  showToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

const SYNC_DEBOUNCE_MS = 5000;
const AUTO_SYNC_INTERVAL_MS = 600000;

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, isAuthenticated } = useAuth();
  const [data, setData] = useState<BudgetData>(getBudgetData());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshData = useCallback(() => setData(getBudgetData()), []);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleSyncDebounced = useCallback(() => {
    if (!isAuthenticated || !accessToken) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    const pendingStatus: SyncStatus = { status: 'pending', lastSyncedAt: syncStatus.lastSyncedAt, error: null };
    setSyncStatus(pendingStatus);
    saveSyncStatus(pendingStatus);

    syncTimeoutRef.current = setTimeout(async () => {
      if (isOnline()) {
        const result = await performSync(accessToken);
        setSyncStatus(result.status);
        if (result.success) refreshData();
      } else {
        const offlineStatus: SyncStatus = { status: 'offline', lastSyncedAt: syncStatus.lastSyncedAt, error: null };
        setSyncStatus(offlineStatus);
        saveSyncStatus(offlineStatus);
      }
    }, SYNC_DEBOUNCE_MS);
  }, [isAuthenticated, accessToken, syncStatus.lastSyncedAt, refreshData]);

  const manualSync = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      showToast('error', '로그인이 필요합니다.');
      return;
    }
    if (!isOnline()) {
      showToast('error', '인터넷 연결을 확인해주세요.');
      return;
    }
    const result = await performSync(accessToken);
    setSyncStatus(result.status);
    if (result.success) {
      refreshData();
      showToast('success', '동기화가 완료되었습니다.');
    } else {
      showToast('error', '동기화에 실패했습니다.');
    }
  }, [isAuthenticated, accessToken, refreshData, showToast]);

  const addTransaction = useCallback((transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    addTransactionToStorage(transaction);
    refreshData();
    showToast('success', '거래가 추가되었습니다.');
    scheduleSyncDebounced();
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const updateTransaction = useCallback((id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
    const result = updateTransactionInStorage(id, updates);
    if (result) {
      refreshData();
      showToast('success', '거래가 수정되었습니다.');
      scheduleSyncDebounced();
    } else {
      showToast('error', '거래 수정에 실패했습니다.');
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const deleteTransaction = useCallback((id: string) => {
    const result = deleteTransactionFromStorage(id);
    if (result) {
      refreshData();
      showToast('success', '거래가 삭제되었습니다.');
      scheduleSyncDebounced();
    } else {
      showToast('error', '거래 삭제에 실패했습니다.');
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const addSubCategory = useCallback((name: string, mainCategory: MainCategory) => {
    const newSubCategory = addSubCategoryToStorage(name, mainCategory);
    refreshData();
    showToast('success', '중분류가 추가되었습니다.');
    scheduleSyncDebounced();
    return newSubCategory;
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const updateSubCategory = useCallback((id: string, updates: Partial<Omit<SubCategory, 'id' | 'createdAt'>>) => {
    const result = updateSubCategoryInStorage(id, updates);
    if (result) {
      refreshData();
      showToast('success', '중분류가 수정되었습니다.');
      scheduleSyncDebounced();
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const deleteSubCategory = useCallback((id: string) => {
    const result = deleteSubCategoryFromStorage(id);
    if (result) {
      refreshData();
      showToast('success', '중분류가 삭제되었습니다.');
      scheduleSyncDebounced();
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const reorderSubCategories = useCallback((orderedIds: string[]) => {
    reorderSubCategoriesToStorage(orderedIds);
    refreshData();
    scheduleSyncDebounced();
  }, [refreshData, scheduleSyncDebounced]);

  const addDetailCategory = useCallback((name: string, subCategoryId: string) => {
    const newDetailCategory = addDetailCategoryToStorage(name, subCategoryId);
    refreshData();
    showToast('success', '소분류가 추가되었습니다.');
    scheduleSyncDebounced();
    return newDetailCategory;
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const updateDetailCategory = useCallback((id: string, updates: Partial<Omit<DetailCategory, 'id' | 'createdAt'>>) => {
    const result = updateDetailCategoryInStorage(id, updates);
    if (result) {
      refreshData();
      showToast('success', '소분류가 수정되었습니다.');
      scheduleSyncDebounced();
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const deleteDetailCategory = useCallback((id: string) => {
    const result = deleteDetailCategoryFromStorage(id);
    if (result) {
      refreshData();
      showToast('success', '소분류가 삭제되었습니다.');
      scheduleSyncDebounced();
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const addItemCategory = useCallback((name: string, detailCategoryId: string) => {
    const newItemCategory = addItemCategoryToStorage(name, detailCategoryId);
    refreshData();
    showToast('success', '세부항목이 추가되었습니다.');
    scheduleSyncDebounced();
    return newItemCategory;
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const updateItemCategory = useCallback((id: string, updates: Partial<Omit<ItemCategory, 'id' | 'createdAt'>>) => {
    const result = updateItemCategoryInStorage(id, updates);
    if (result) {
      refreshData();
      showToast('success', '세부항목이 수정되었습니다.');
      scheduleSyncDebounced();
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const deleteItemCategory = useCallback((id: string) => {
    const result = deleteItemCategoryFromStorage(id);
    if (result) {
      refreshData();
      showToast('success', '세부항목이 삭제되었습니다.');
      scheduleSyncDebounced();
    }
  }, [refreshData, showToast, scheduleSyncDebounced]);

  const resetCategories = useCallback(() => {
    resetCategoriesToDefault();
    refreshData();
    showToast('success', '카테고리가 초기화되었습니다.');
    scheduleSyncDebounced();
  }, [refreshData, showToast, scheduleSyncDebounced]);

  useEffect(() => {
    const handleOnline = () => {
      if (syncStatus.status === 'offline') scheduleSyncDebounced();
    };
    const handleOffline = () => {
      const offlineStatus: SyncStatus = { status: 'offline', lastSyncedAt: syncStatus.lastSyncedAt, error: null };
      setSyncStatus(offlineStatus);
      saveSyncStatus(offlineStatus);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncStatus, scheduleSyncDebounced]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      autoSyncIntervalRef.current = setInterval(async () => {
        if (isOnline()) {
          const result = await performSync(accessToken);
          setSyncStatus(result.status);
          if (result.success) refreshData();
        }
      }, AUTO_SYNC_INTERVAL_MS);
    }
    return () => {
      if (autoSyncIntervalRef.current) clearInterval(autoSyncIntervalRef.current);
    };
  }, [isAuthenticated, accessToken, refreshData]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isAuthenticated && accessToken && isOnline() && syncStatus.status === 'pending') {
        performSync(accessToken);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated, accessToken, syncStatus.status]);

  useEffect(() => {
    const initialSync = async () => {
      if (isAuthenticated && accessToken && isOnline()) {
        const result = await performSync(accessToken);
        setSyncStatus(result.status);
        if (result.success) refreshData();
      }
    };
    initialSync();
  }, [isAuthenticated, accessToken, refreshData]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      if (autoSyncIntervalRef.current) clearInterval(autoSyncIntervalRef.current);
    };
  }, []);

  return (
    <DataContext.Provider value={{
      data, syncStatus, toasts,
      addTransaction, updateTransaction, deleteTransaction,
      addSubCategory, updateSubCategory, deleteSubCategory, reorderSubCategories,
      addDetailCategory, updateDetailCategory, deleteDetailCategory,
      addItemCategory, updateItemCategory, deleteItemCategory,
      resetCategories, manualSync, showToast, removeToast, refreshData,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
