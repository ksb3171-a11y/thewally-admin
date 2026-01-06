// 대분류 타입 (고정)
export type MainCategory = 'income' | 'expense';

// 중분류
export interface SubCategory {
  id: string;
  name: string;
  mainCategory: MainCategory;
  order: number;
  usageCount: number; // 사용 횟수
  createdAt: string;
  updatedAt: string;
}

// 소분류
export interface DetailCategory {
  id: string;
  name: string;
  subCategoryId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// 세부항목 (4단계)
export interface ItemCategory {
  id: string;
  name: string;
  detailCategoryId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// 거래 내역
export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  mainCategory: MainCategory;
  subCategoryId: string;
  detailCategoryId: string;
  itemCategoryId?: string; // 세부항목 ID (선택)
  subCategoryName: string; // 중분류명 스냅샷
  detailCategoryName: string; // 소분류명 스냅샷
  itemCategoryName?: string; // 세부항목명 스냅샷 (선택)
  assetId?: string; // 연결된 통장/계좌 ID
  assetName?: string; // 통장/계좌명 스냅샷
  amount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

// 전체 데이터 구조
export interface BudgetData {
  version: number;
  transactions: Transaction[];
  subCategories: SubCategory[];
  detailCategories: DetailCategory[];
  itemCategories: ItemCategory[];
  lastModifiedAt: string;
}

// 동기화 상태
export type SyncStatusType = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncStatus {
  status: SyncStatusType;
  lastSyncedAt: string | null;
  error: string | null;
}

// 필터
export type FilterPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'custom';
export type FilterType = 'all' | 'income' | 'expense';

export interface FilterState {
  period: FilterPeriod;
  type: FilterType;
  subCategoryIds: string[];
  detailCategoryIds: string[];
  searchKeyword: string;
  startDate: string;
  endDate: string;
}

// 사용자 정보
export interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

// 인증 상태
export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  accessToken: string | null;
  isLoading: boolean;
}

// 카테고리 트리 구조 (UI 렌더링용)
export interface CategoryTreeItem {
  id: string;
  name: string;
  detailCategories: Array<{
    id: string;
    name: string;
  }>;
}

export interface CategoryTree {
  income: {
    subCategories: CategoryTreeItem[];
  };
  expense: {
    subCategories: CategoryTreeItem[];
  };
}

// 분석 관련
export interface CategoryBreakdown {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface SubCategoryAnalysis {
  subCategoryId: string;
  subCategoryName: string;
  totalAmount: number;
  percentage: number;
  count: number;
  detailBreakdown: CategoryBreakdown[];
}

export interface MonthlyAnalysis {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  incomeBySubCategory: SubCategoryAnalysis[];
  expenseBySubCategory: SubCategoryAnalysis[];
  previousMonth: {
    income: number;
    expense: number;
    netProfit: number;
  };
  comparison: {
    incomeChange: number;
    expenseChange: number;
    netProfitChange: number;
  };
  insights: {
    topExpenseSubCategories: CategoryBreakdown[];
    topExpenseDetailCategories: CategoryBreakdown[];
    topIncomeSubCategories: CategoryBreakdown[];
    topIncomeDetailCategories: CategoryBreakdown[];
    mostIncreasedExpense: { name: string; change: number } | null;
    mostDecreasedExpense: { name: string; change: number } | null;
  };
}

// 차트 데이터
export interface ChartDataPoint {
  name: string;
  income: number;
  expense: number;
  netProfit?: number;
}

export interface PieChartDataPoint {
  name: string;
  value: number;
  color: string;
}

// 토스트 메시지
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// 탭 타입 (가계부 + B2B)
export type TabType = 'input' | 'history' | 'dashboard' | 'settings' | 'b2b-collect' | 'b2b-list' | 'b2b-content' | 'b2b-dashboard' | 'b2b-settings';

// 모듈 타입
export type ModuleType = 'budget' | 'b2b';

// 최근 사용 카테고리
export interface RecentCategory {
  mainCategory: MainCategory;
  subCategoryId: string;
  detailCategoryId: string;
  itemCategoryId?: string;
  subCategoryName: string;
  detailCategoryName: string;
  itemCategoryName?: string;
  usedAt: string;
}

// 자산 (통장/계좌)
export interface Asset {
  id: string;
  name: string;
  balance: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// 자산 데이터
export interface AssetData {
  assets: Asset[];
  lastModifiedAt: string;
}
