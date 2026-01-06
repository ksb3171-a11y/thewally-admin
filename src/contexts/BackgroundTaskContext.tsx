import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { CrawlProgress, CrawlResult } from '../services/emailCrawlerService';
import type { CollectionProgress, CollectedOrganization } from '../services/publicDataService';

// 작업 타입
export type TaskType = 'collection' | 'crawling';

// 1차 수집 상태
export interface CollectionTaskState {
  type: 'collection';
  isActive: boolean;
  isMinimized: boolean;
  step: 'select' | 'collecting' | 'done';
  progress: CollectionProgress | null;
  collectedData: CollectedOrganization[];
  sourceName?: string;
}

// 2차 크롤링 상태
export interface CrawlingTaskState {
  type: 'crawling';
  isActive: boolean;
  isMinimized: boolean;
  step: 'ready' | 'crawling' | 'done';
  progress: CrawlProgress | null;
  result: CrawlResult | null;
}

// Context 타입
interface BackgroundTaskContextType {
  // 1차 수집
  collectionTask: CollectionTaskState;
  setCollectionTask: (task: Partial<CollectionTaskState>) => void;
  showCollectionModal: () => void;
  minimizeCollection: () => void;
  closeCollection: () => void;

  // 2차 크롤링
  crawlingTask: CrawlingTaskState;
  setCrawlingTask: (task: Partial<CrawlingTaskState>) => void;
  showCrawlingModal: () => void;
  minimizeCrawling: () => void;
  closeCrawling: () => void;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextType | null>(null);

// 초기 상태
const initialCollectionTask: CollectionTaskState = {
  type: 'collection',
  isActive: false,
  isMinimized: false,
  step: 'select',
  progress: null,
  collectedData: [],
};

const initialCrawlingTask: CrawlingTaskState = {
  type: 'crawling',
  isActive: false,
  isMinimized: false,
  step: 'ready',
  progress: null,
  result: null,
};

export function BackgroundTaskProvider({ children }: { children: ReactNode }) {
  const [collectionTask, setCollectionTaskState] = useState<CollectionTaskState>(initialCollectionTask);
  const [crawlingTask, setCrawlingTaskState] = useState<CrawlingTaskState>(initialCrawlingTask);

  // 1차 수집 관련
  const setCollectionTask = useCallback((task: Partial<CollectionTaskState>) => {
    setCollectionTaskState(prev => ({ ...prev, ...task }));
  }, []);

  const showCollectionModal = useCallback(() => {
    setCollectionTaskState(prev => ({ ...prev, isActive: true, isMinimized: false }));
  }, []);

  const minimizeCollection = useCallback(() => {
    setCollectionTaskState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  const closeCollection = useCallback(() => {
    setCollectionTaskState(initialCollectionTask);
  }, []);

  // 2차 크롤링 관련
  const setCrawlingTask = useCallback((task: Partial<CrawlingTaskState>) => {
    setCrawlingTaskState(prev => ({ ...prev, ...task }));
  }, []);

  const showCrawlingModal = useCallback(() => {
    setCrawlingTaskState(prev => ({ ...prev, isActive: true, isMinimized: false }));
  }, []);

  const minimizeCrawling = useCallback(() => {
    setCrawlingTaskState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  const closeCrawling = useCallback(() => {
    setCrawlingTaskState(initialCrawlingTask);
  }, []);

  return (
    <BackgroundTaskContext.Provider
      value={{
        collectionTask,
        setCollectionTask,
        showCollectionModal,
        minimizeCollection,
        closeCollection,
        crawlingTask,
        setCrawlingTask,
        showCrawlingModal,
        minimizeCrawling,
        closeCrawling,
      }}
    >
      {children}
    </BackgroundTaskContext.Provider>
  );
}

export function useBackgroundTask() {
  const context = useContext(BackgroundTaskContext);
  if (!context) {
    throw new Error('useBackgroundTask must be used within BackgroundTaskProvider');
  }
  return context;
}
