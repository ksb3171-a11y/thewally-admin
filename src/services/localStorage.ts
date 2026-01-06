import { v4 as uuidv4 } from 'uuid';
import type { BudgetData, Transaction, SubCategory, DetailCategory, ItemCategory, SyncStatus, RecentCategory, MainCategory, Asset, AssetData } from '../types';
import { createDefaultCategories } from '../utils/defaultCategories';

const STORAGE_KEYS = {
  BUDGET_DATA: 'budget_data',
  ACCESS_TOKEN: 'google_access_token',
  USER_INFO: 'user_info',
  SYNC_STATUS: 'sync_status',
  DARK_MODE: 'dark_mode',
  RECENT_CATEGORIES: 'recent_categories',
  ASSET_DATA: 'asset_data',
  CHURCH_COLLECTION_PROGRESS: 'church_collection_progress',
};

// 기본 BudgetData 생성
const createDefaultBudgetData = (): BudgetData => {
  const { subCategories, detailCategories } = createDefaultCategories();
  return {
    version: 1,
    transactions: [],
    subCategories,
    detailCategories,
    itemCategories: [],
    lastModifiedAt: new Date().toISOString(),
  };
};

// BudgetData 관련
export const getBudgetData = (): BudgetData => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BUDGET_DATA);
    if (data) {
      const parsed = JSON.parse(data);
      // itemCategories가 없으면 빈 배열로 초기화 (하위 호환성)
      if (!parsed.itemCategories) {
        parsed.itemCategories = [];
      }
      return parsed;
    }
    const defaultData = createDefaultBudgetData();
    saveBudgetData(defaultData);
    return defaultData;
  } catch {
    const defaultData = createDefaultBudgetData();
    saveBudgetData(defaultData);
    return defaultData;
  }
};

export const saveBudgetData = (data: BudgetData): void => {
  const updatedData = {
    ...data,
    lastModifiedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.BUDGET_DATA, JSON.stringify(updatedData));
};

// 통장 잔액 업데이트 헬퍼 함수
const updateAssetBalance = (assetId: string, amount: number, isIncome: boolean): void => {
  const assetData = getAssetData();
  const assetIndex = assetData.assets.findIndex((a) => a.id === assetId);
  if (assetIndex !== -1) {
    // 수입이면 잔액 증가, 지출이면 잔액 감소
    assetData.assets[assetIndex].balance += isIncome ? amount : -amount;
    assetData.assets[assetIndex].updatedAt = new Date().toISOString();
    saveAssetData(assetData);
  }
};

// 중분류 사용 횟수 증가 헬퍼 함수
const incrementSubCategoryUsage = (subCategoryId: string): void => {
  const data = getBudgetData();
  const subIndex = data.subCategories.findIndex((s) => s.id === subCategoryId);
  if (subIndex !== -1) {
    data.subCategories[subIndex].usageCount = (data.subCategories[subIndex].usageCount || 0) + 1;
    data.subCategories[subIndex].updatedAt = new Date().toISOString();
    saveBudgetData(data);
  }
};

// 거래 내역 관련
export const addTransaction = (
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
): Transaction => {
  const now = new Date().toISOString();
  const newTransaction: Transaction = {
    ...transaction,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  const data = getBudgetData();
  data.transactions.push(newTransaction);
  saveBudgetData(data);

  // 통장 잔액 업데이트
  if (transaction.assetId) {
    updateAssetBalance(
      transaction.assetId,
      transaction.amount,
      transaction.mainCategory === 'income'
    );
  }

  // 중분류 사용 횟수 증가
  incrementSubCategoryUsage(transaction.subCategoryId);

  // 최근 사용 카테고리 업데이트
  updateRecentCategory({
    mainCategory: transaction.mainCategory,
    subCategoryId: transaction.subCategoryId,
    detailCategoryId: transaction.detailCategoryId,
    itemCategoryId: transaction.itemCategoryId,
    subCategoryName: transaction.subCategoryName,
    detailCategoryName: transaction.detailCategoryName,
    itemCategoryName: transaction.itemCategoryName,
    usedAt: now,
  });

  return newTransaction;
};

export const updateTransaction = (
  id: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Transaction | null => {
  const data = getBudgetData();
  const index = data.transactions.findIndex((t) => t.id === id);

  if (index === -1) return null;

  const oldTransaction = data.transactions[index];
  const updatedTransaction: Transaction = {
    ...oldTransaction,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 통장 잔액 롤백 및 재적용
  // 1. 기존 거래의 통장 잔액 롤백
  if (oldTransaction.assetId) {
    updateAssetBalance(
      oldTransaction.assetId,
      oldTransaction.amount,
      oldTransaction.mainCategory !== 'income' // 반대로 적용하여 롤백
    );
  }
  // 2. 새 거래의 통장 잔액 적용
  if (updatedTransaction.assetId) {
    updateAssetBalance(
      updatedTransaction.assetId,
      updatedTransaction.amount,
      updatedTransaction.mainCategory === 'income'
    );
  }

  data.transactions[index] = updatedTransaction;
  saveBudgetData(data);

  return updatedTransaction;
};

export const deleteTransaction = (id: string): boolean => {
  const data = getBudgetData();
  const transaction = data.transactions.find((t) => t.id === id);

  if (!transaction) return false;

  // 통장 잔액 롤백
  if (transaction.assetId) {
    updateAssetBalance(
      transaction.assetId,
      transaction.amount,
      transaction.mainCategory !== 'income' // 반대로 적용하여 롤백
    );
  }

  data.transactions = data.transactions.filter((t) => t.id !== id);
  saveBudgetData(data);
  return true;
};

// 중분류 관련
export const addSubCategory = (
  name: string,
  mainCategory: MainCategory
): SubCategory => {
  const now = new Date().toISOString();
  const data = getBudgetData();
  const maxOrder = Math.max(
    ...data.subCategories
      .filter((s) => s.mainCategory === mainCategory)
      .map((s) => s.order),
    -1
  );

  const newSubCategory: SubCategory = {
    id: uuidv4(),
    name,
    mainCategory,
    order: maxOrder + 1,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  data.subCategories.push(newSubCategory);
  saveBudgetData(data);

  return newSubCategory;
};

export const updateSubCategory = (
  id: string,
  updates: Partial<Omit<SubCategory, 'id' | 'createdAt'>>
): SubCategory | null => {
  const data = getBudgetData();
  const index = data.subCategories.findIndex((s) => s.id === id);

  if (index === -1) return null;

  const updatedSubCategory: SubCategory = {
    ...data.subCategories[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  data.subCategories[index] = updatedSubCategory;
  saveBudgetData(data);

  return updatedSubCategory;
};

// 중분류 순서 일괄 업데이트
export const reorderSubCategories = (orderedIds: string[]): void => {
  const data = getBudgetData();
  orderedIds.forEach((id, index) => {
    const subIndex = data.subCategories.findIndex((s) => s.id === id);
    if (subIndex !== -1) {
      data.subCategories[subIndex].order = index;
      data.subCategories[subIndex].updatedAt = new Date().toISOString();
    }
  });
  saveBudgetData(data);
};

export const deleteSubCategory = (id: string): boolean => {
  const data = getBudgetData();
  const initialSubLength = data.subCategories.length;

  // 중분류 삭제
  data.subCategories = data.subCategories.filter((s) => s.id !== id);

  // 하위 소분류의 ID들 수집
  const detailIdsToDelete = data.detailCategories
    .filter((d) => d.subCategoryId === id)
    .map((d) => d.id);

  // 하위 소분류도 삭제
  data.detailCategories = data.detailCategories.filter(
    (d) => d.subCategoryId !== id
  );

  // 하위 세부항목도 삭제
  data.itemCategories = data.itemCategories.filter(
    (i) => !detailIdsToDelete.includes(i.detailCategoryId)
  );

  if (data.subCategories.length < initialSubLength) {
    saveBudgetData(data);
    return true;
  }
  return false;
};

// 소분류 관련
export const addDetailCategory = (
  name: string,
  subCategoryId: string
): DetailCategory => {
  const now = new Date().toISOString();
  const data = getBudgetData();
  const maxOrder = Math.max(
    ...data.detailCategories
      .filter((d) => d.subCategoryId === subCategoryId)
      .map((d) => d.order),
    -1
  );

  const newDetailCategory: DetailCategory = {
    id: uuidv4(),
    name,
    subCategoryId,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  data.detailCategories.push(newDetailCategory);
  saveBudgetData(data);

  return newDetailCategory;
};

export const updateDetailCategory = (
  id: string,
  updates: Partial<Omit<DetailCategory, 'id' | 'createdAt'>>
): DetailCategory | null => {
  const data = getBudgetData();
  const index = data.detailCategories.findIndex((d) => d.id === id);

  if (index === -1) return null;

  const updatedDetailCategory: DetailCategory = {
    ...data.detailCategories[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  data.detailCategories[index] = updatedDetailCategory;
  saveBudgetData(data);

  return updatedDetailCategory;
};

export const deleteDetailCategory = (id: string): boolean => {
  const data = getBudgetData();
  const initialLength = data.detailCategories.length;
  data.detailCategories = data.detailCategories.filter((d) => d.id !== id);

  // 하위 세부항목도 삭제
  data.itemCategories = data.itemCategories.filter((i) => i.detailCategoryId !== id);

  if (data.detailCategories.length < initialLength) {
    saveBudgetData(data);
    return true;
  }
  return false;
};

// 세부항목 관련
export const addItemCategory = (
  name: string,
  detailCategoryId: string
): ItemCategory => {
  const now = new Date().toISOString();
  const data = getBudgetData();
  const maxOrder = Math.max(
    ...data.itemCategories
      .filter((i) => i.detailCategoryId === detailCategoryId)
      .map((i) => i.order),
    -1
  );

  const newItemCategory: ItemCategory = {
    id: uuidv4(),
    name,
    detailCategoryId,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  data.itemCategories.push(newItemCategory);
  saveBudgetData(data);

  return newItemCategory;
};

export const updateItemCategory = (
  id: string,
  updates: Partial<Omit<ItemCategory, 'id' | 'createdAt'>>
): ItemCategory | null => {
  const data = getBudgetData();
  const index = data.itemCategories.findIndex((i) => i.id === id);

  if (index === -1) return null;

  const updatedItemCategory: ItemCategory = {
    ...data.itemCategories[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  data.itemCategories[index] = updatedItemCategory;
  saveBudgetData(data);

  return updatedItemCategory;
};

export const deleteItemCategory = (id: string): boolean => {
  const data = getBudgetData();
  const initialLength = data.itemCategories.length;
  data.itemCategories = data.itemCategories.filter((i) => i.id !== id);

  if (data.itemCategories.length < initialLength) {
    saveBudgetData(data);
    return true;
  }
  return false;
};

// 카테고리 초기화
export const resetCategoriesToDefault = (): void => {
  const data = getBudgetData();
  const { subCategories, detailCategories } = createDefaultCategories();
  data.subCategories = subCategories;
  data.detailCategories = detailCategories;
  data.itemCategories = [];
  saveBudgetData(data);
};

// 최근 사용 카테고리 관련
export const getRecentCategories = (): RecentCategory[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECENT_CATEGORIES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const updateRecentCategory = (category: RecentCategory): void => {
  const recentCategories = getRecentCategories();

  // 중복 제거 후 추가
  const filtered = recentCategories.filter(
    (c) => c.detailCategoryId !== category.detailCategoryId
  );
  filtered.unshift(category);

  // 최대 10개 유지
  const trimmed = filtered.slice(0, 10);
  localStorage.setItem(STORAGE_KEYS.RECENT_CATEGORIES, JSON.stringify(trimmed));
};

// 인증 관련
export const getAccessToken = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
};

export const saveAccessToken = (token: string): void => {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
};

export const removeAccessToken = (): void => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
};

export const getUserInfo = (): { email: string; name: string; picture: string } | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_INFO);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const saveUserInfo = (userInfo: { email: string; name: string; picture: string }): void => {
  localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
};

export const removeUserInfo = (): void => {
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
};

// 동기화 상태 관련
export const getSyncStatus = (): SyncStatus => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SYNC_STATUS);
    return data ? JSON.parse(data) : { status: 'pending', lastSyncedAt: null, error: null };
  } catch {
    return { status: 'pending', lastSyncedAt: null, error: null };
  }
};

export const saveSyncStatus = (status: SyncStatus): void => {
  localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, JSON.stringify(status));
};

// 다크모드 관련
export const getDarkMode = (): boolean => {
  const stored = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
  if (stored !== null) {
    return stored === 'true';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const saveDarkMode = (isDark: boolean): void => {
  localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(isDark));
};

// 데이터 내보내기/가져오기
export const exportData = (): string => {
  const data = getBudgetData();
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString) as BudgetData;
    if (data.version && data.transactions && data.subCategories && data.detailCategories) {
      saveBudgetData(data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// 전체 데이터 삭제
export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.BUDGET_DATA);
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_INFO);
  localStorage.removeItem(STORAGE_KEYS.SYNC_STATUS);
  localStorage.removeItem(STORAGE_KEYS.RECENT_CATEGORIES);
  localStorage.removeItem(STORAGE_KEYS.ASSET_DATA);
};

// 자산 관련
const createDefaultAssetData = (): AssetData => ({
  assets: [],
  lastModifiedAt: new Date().toISOString(),
});

export const getAssetData = (): AssetData => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ASSET_DATA);
    if (data) {
      return JSON.parse(data);
    }
    const defaultData = createDefaultAssetData();
    saveAssetData(defaultData);
    return defaultData;
  } catch {
    const defaultData = createDefaultAssetData();
    saveAssetData(defaultData);
    return defaultData;
  }
};

export const saveAssetData = (data: AssetData): void => {
  const updatedData = {
    ...data,
    lastModifiedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.ASSET_DATA, JSON.stringify(updatedData));
};

export const addAsset = (name: string, balance: number): Asset => {
  const now = new Date().toISOString();
  const data = getAssetData();
  const maxOrder = Math.max(...data.assets.map((a) => a.order), -1);

  const newAsset: Asset = {
    id: uuidv4(),
    name,
    balance,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  data.assets.push(newAsset);
  saveAssetData(data);
  return newAsset;
};

export const updateAsset = (
  id: string,
  updates: Partial<Omit<Asset, 'id' | 'createdAt'>>
): Asset | null => {
  const data = getAssetData();
  const index = data.assets.findIndex((a) => a.id === id);

  if (index === -1) return null;

  const updatedAsset: Asset = {
    ...data.assets[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  data.assets[index] = updatedAsset;
  saveAssetData(data);
  return updatedAsset;
};

export const deleteAsset = (id: string): boolean => {
  const data = getAssetData();
  const initialLength = data.assets.length;
  data.assets = data.assets.filter((a) => a.id !== id);

  if (data.assets.length < initialLength) {
    saveAssetData(data);
    return true;
  }
  return false;
};

export const getTotalAssets = (): number => {
  const data = getAssetData();
  return data.assets.reduce((sum, asset) => sum + asset.balance, 0);
};

// 교회 수집 진행 상황 관련
// 구조: { [시도명]: { lastPage: number, lastUpdated: string } }
interface ChurchCollectionProgress {
  [sido: string]: {
    lastPage: number;
    lastUpdated: string;
  };
}

// 교회 수집 진행 상황 전체 가져오기
export const getChurchCollectionProgress = (): ChurchCollectionProgress => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CHURCH_COLLECTION_PROGRESS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

// 특정 시도의 마지막 수집 페이지 가져오기 (없으면 1 반환)
export const getChurchLastPage = (sido: string): number => {
  const progress = getChurchCollectionProgress();
  return progress[sido]?.lastPage || 1;
};

// 특정 시도의 수집 페이지 저장
export const saveChurchLastPage = (sido: string, page: number): void => {
  const progress = getChurchCollectionProgress();
  progress[sido] = {
    lastPage: page,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.CHURCH_COLLECTION_PROGRESS, JSON.stringify(progress));
};

// 특정 시도의 진행 상황 초기화
export const clearChurchProgress = (sido?: string): void => {
  if (sido) {
    const progress = getChurchCollectionProgress();
    delete progress[sido];
    localStorage.setItem(STORAGE_KEYS.CHURCH_COLLECTION_PROGRESS, JSON.stringify(progress));
  } else {
    // 전체 초기화
    localStorage.removeItem(STORAGE_KEYS.CHURCH_COLLECTION_PROGRESS);
  }
};
