import { useBackgroundTask } from '../contexts/BackgroundTaskContext';

// 전역 미니 바 컴포넌트 - 어떤 페이지에서든 표시됨
export const GlobalTaskMiniBars = () => {
  const {
    collectionTask,
    showCollectionModal,
    closeCollection,
    crawlingTask,
    showCrawlingModal,
    closeCrawling,
  } = useBackgroundTask();

  // 최소화된 작업이 없으면 렌더링하지 않음
  const showCollectionMini = collectionTask.isActive && collectionTask.isMinimized;
  const showCrawlingMini = crawlingTask.isActive && crawlingTask.isMinimized;

  if (!showCollectionMini && !showCrawlingMini) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {/* 1차 수집 미니 바 */}
      {showCollectionMini && (
        <CollectionMiniBar
          task={collectionTask}
          onExpand={showCollectionModal}
          onClose={closeCollection}
        />
      )}

      {/* 2차 크롤링 미니 바 */}
      {showCrawlingMini && (
        <CrawlingMiniBar
          task={crawlingTask}
          onExpand={showCrawlingModal}
          onClose={closeCrawling}
        />
      )}
    </div>
  );
};

// 1차 수집 미니 바
interface CollectionMiniBarProps {
  task: ReturnType<typeof useBackgroundTask>['collectionTask'];
  onExpand: () => void;
  onClose: () => void;
}

const CollectionMiniBar = ({ task, onExpand, onClose }: CollectionMiniBarProps) => {
  const getStatusStyle = () => {
    if (task.step === 'collecting') return 'bg-blue-100 dark:bg-blue-900/50';
    if (task.step === 'done') return 'bg-green-100 dark:bg-green-900/50';
    return 'bg-gray-100 dark:bg-gray-700/50';
  };

  const getStatusText = () => {
    if (task.step === 'collecting') return '진행 중';
    if (task.step === 'done') return '완료';
    return '대기 중';
  };

  const getStatusDetail = () => {
    if (task.step === 'collecting') return `${task.progress?.collected.toLocaleString() || 0}개 수집됨`;
    if (task.step === 'done') return `${task.collectedData.length.toLocaleString()}개 완료`;
    return task.sourceName ? `${task.sourceName} 선택됨` : '소스 선택 대기';
  };

  const isRunning = task.step === 'collecting';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[300px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getStatusStyle()}`}>
            {task.step === 'collecting' ? (
              <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : task.step === 'done' ? (
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              1차 수집 {getStatusText()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {getStatusDetail()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onExpand}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="펼치기"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            title="닫기"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* 진행 바 */}
      {task.step === 'collecting' && task.progress?.total && task.progress.total > 0 && (
        <div className="mt-2 h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((task.progress.collected / task.progress.total) * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

// 2차 크롤링 미니 바
interface CrawlingMiniBarProps {
  task: ReturnType<typeof useBackgroundTask>['crawlingTask'];
  onExpand: () => void;
  onClose: () => void;
}

const CrawlingMiniBar = ({ task, onExpand, onClose }: CrawlingMiniBarProps) => {
  const getStatusStyle = () => {
    if (task.step === 'crawling') return 'bg-purple-100 dark:bg-purple-900/50';
    if (task.step === 'done') return 'bg-green-100 dark:bg-green-900/50';
    return 'bg-gray-100 dark:bg-gray-700/50';
  };

  const getStatusText = () => {
    if (task.step === 'crawling') return '진행 중';
    if (task.step === 'done') return '완료';
    return '대기 중';
  };

  const getStatusDetail = () => {
    if (task.step === 'crawling') {
      const current = task.progress?.current || 0;
      const total = task.progress?.total || 0;
      const success = task.progress?.success || 0;
      const failed = task.progress?.failed || 0;
      return `${current}/${total} (성공: ${success} / 실패: ${failed})`;
    }
    if (task.step === 'done') return `성공: ${task.result?.success || 0} / 실패: ${task.result?.failed || 0}`;
    return '대기 중';
  };

  const isRunning = task.step === 'crawling';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[300px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getStatusStyle()}`}>
            {task.step === 'crawling' ? (
              <svg className="w-4 h-4 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : task.step === 'done' ? (
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              2차 크롤링 {getStatusText()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {getStatusDetail()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onExpand}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="펼치기"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
            title="닫기"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* 진행 바 */}
      {task.step === 'crawling' && task.progress?.total && task.progress.total > 0 && (
        <div className="mt-2 h-1.5 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${(task.progress.current / task.progress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};
