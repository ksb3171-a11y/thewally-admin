import { useState, useEffect, useRef } from 'react';
import { getRawDataStats, resetFailedStatus, type CollectionLog, type CategoryStats } from '../../services/publicDataService';
import { runEmailCrawling, type CrawlProgress, type CrawlResult } from '../../services/emailCrawlerService';
import { getAccessToken } from '../../services/localStorage';
import { useBackgroundTask } from '../../contexts/BackgroundTaskContext';

interface EmailCrawlerProps {
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

type Step = 'ready' | 'crawling' | 'done';

export const EmailCrawler = ({ onClose, onSuccess }: EmailCrawlerProps) => {
  const { crawlingTask, setCrawlingTask, minimizeCrawling, closeCrawling } = useBackgroundTask();

  const [step, setStep] = useState<Step>('ready');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    withHomepage: number;
    extracted: number;
    pending: number;
    failed: number;
    byCategory: CategoryStats[];
  } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [maxTargets, setMaxTargets] = useState<number>(0); // 0 = 무제한
  const [isResetting, setIsResetting] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 전역 상태 동기화
  useEffect(() => {
    setCrawlingTask({ isActive: true, step, progress: crawlProgress, result: crawlResult });
  }, [step, crawlProgress, crawlResult, setCrawlingTask]);

  // 전역 상태에서 isMinimized 가져오기
  const isMinimized = crawlingTask.isMinimized;

  // 로그인 상태 확인
  useEffect(() => {
    const token = getAccessToken();
    setIsLoggedIn(!!token);
  }, []);

  // 원본데이터 통계 조회
  useEffect(() => {
    const loadStats = async () => {
      if (isLoggedIn) {
        setIsLoading(true);
        try {
          const rawStats = await getRawDataStats();
          setStats(rawStats);
        } catch {
          setMessage({ type: 'error', text: '통계 조회에 실패했습니다.' });
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    loadStats();
  }, [isLoggedIn]);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 로그 추가 함수
  const addLog = (log: CollectionLog) => {
    setLogs((prev) => [...prev, log]);
  };

  // 실패 상태 초기화
  const handleResetFailed = async () => {
    if (!stats || stats.failed === 0) return;

    setIsResetting(true);
    try {
      const resetCount = await resetFailedStatus();
      setMessage({ type: 'success', text: `${resetCount}개 항목이 초기화되었습니다.` });
      // 통계 갱신
      const newStats = await getRawDataStats();
      setStats(newStats);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '초기화 실패',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // 크롤링 중단
  const handleStopCrawling = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog({
        timestamp: new Date(),
        type: 'warning',
        message: '크롤링 중단 요청...',
      });
    }
  };

  // 크롤링 시작
  const handleStartCrawling = async () => {
    if (!isLoggedIn) {
      setMessage({ type: 'error', text: '구글 로그인이 필요합니다.' });
      return;
    }

    if (!stats || stats.pending === 0) {
      setMessage({ type: 'error', text: '크롤링 대상이 없습니다.' });
      return;
    }

    // AbortController 생성
    abortControllerRef.current = new AbortController();

    setStep('crawling');
    setCrawlProgress(null);
    setCrawlResult(null);
    setLogs([]);

    // 선택된 카테고리 정보
    const categoryText = selectedCategories.length === 0
      ? '전체 카테고리'
      : selectedCategories.join(', ');

    addLog({
      timestamp: new Date(),
      type: 'info',
      message: '이메일 크롤링 시작',
      details: `카테고리: ${categoryText}, 대상: ${maxTargets > 0 ? `${maxTargets}개` : '전체'}`,
    });

    try {
      const result = await runEmailCrawling(
        (progress) => {
          setCrawlProgress(progress);
          if (progress.message) {
            addLog({
              timestamp: new Date(),
              type: 'info',
              message: progress.message,
            });
          }
        },
        maxTargets > 0 ? maxTargets : undefined,
        abortControllerRef.current.signal,
        selectedCategories.length > 0 ? selectedCategories : undefined
      );

      setCrawlResult(result);

      // 중단 여부 확인
      const wasAborted = abortControllerRef.current?.signal.aborted;

      addLog({
        timestamp: new Date(),
        type: wasAborted ? 'warning' : 'success',
        message: wasAborted ? '이메일 크롤링 중단됨' : '이메일 크롤링 완료',
        details: `성공: ${result.success}, 실패: ${result.failed}`,
      });
      setStep('done');
      onSuccess?.(result.success);
    } catch (error) {
      addLog({
        timestamp: new Date(),
        type: 'error',
        message: '크롤링 오류',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      });
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '크롤링 중 오류가 발생했습니다.',
      });
      setStep('ready');
    } finally {
      abortControllerRef.current = null;
    }
  };

  // 로그 타입별 스타일
  const getLogStyle = (type: CollectionLog['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'saving':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getLogIcon = (type: CollectionLog['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'saving':
        return '💾';
      default:
        return '→';
    }
  };

  // 최소화된 상태일 때는 전역 미니바에서 표시되므로 렌더링하지 않음
  if (isMinimized) {
    return null;
  }

  // 닫기 핸들러 (전역 상태도 함께 정리)
  const handleClose = () => {
    closeCrawling();
    onClose();
  };

  // 최소화 핸들러
  const handleMinimize = () => {
    minimizeCrawling();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            이메일 크롤링 (2차 작업)
          </h3>
          <div className="flex items-center gap-1">
            {/* 최소화 버튼 */}
            <button
              onClick={handleMinimize}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="최소화"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              disabled={step === 'crawling'}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 로그인 필요 안내 */}
          {!isLoggedIn && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                구글 로그인이 필요합니다. 상단 헤더에서 먼저 로그인해주세요.
              </p>
            </div>
          )}

          {/* STEP 1: 준비 */}
          {step === 'ready' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                원본데이터V1.0 시트에서 홈페이지 주소를 가져와 이메일을 추출합니다.
              </p>

              {/* 통계 */}
              {isLoading ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center">
                  <span className="text-sm text-gray-500">통계 조회 중...</span>
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">전체 데이터</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats.pending.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">크롤링 대기</div>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats.extracted.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">추출 완료</div>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center relative">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {stats.failed.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">추출 실패</div>
                    {stats.failed > 0 && (
                      <button
                        onClick={handleResetFailed}
                        disabled={isResetting}
                        className="mt-1 text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
                      >
                        {isResetting ? '초기화 중...' : '초기화'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center">
                  <span className="text-sm text-gray-500">데이터가 없습니다. 먼저 1차 수집을 진행해주세요.</span>
                </div>
              )}

              {/* 카테고리 선택 */}
              {stats && stats.byCategory.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    크롤링 대상 선택 (카테고리)
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                    {stats.byCategory.map((cat) => (
                      <label
                        key={cat.category}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedCategories.includes(cat.category)
                            ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700'
                            : 'bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.category)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([...selectedCategories, cat.category]);
                              } else {
                                setSelectedCategories(selectedCategories.filter((c) => c !== cat.category));
                              }
                            }}
                            className="w-4 h-4 text-purple-500 rounded border-gray-300 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{cat.category}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-blue-600 dark:text-blue-400">{cat.pending}개 대기</span>
                          {cat.failed > 0 && (
                            <span className="text-red-500">{cat.failed}개 실패</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      선택: {selectedCategories.length === 0 ? '전체' : selectedCategories.join(', ')}
                      {' '}({selectedCategories.length === 0
                        ? stats.pending
                        : stats.byCategory
                            .filter((c) => selectedCategories.includes(c.category))
                            .reduce((sum, c) => sum + c.pending, 0)}개)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedCategories(stats.byCategory.map((c) => c.category))}
                        className="text-xs text-purple-500 hover:text-purple-700"
                      >
                        전체선택
                      </button>
                      <button
                        onClick={() => setSelectedCategories([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        선택해제
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 크롤링 개수 옵션 */}
              {stats && stats.pending > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    최대 크롤링 수
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 10, label: '테스트 (10개)' },
                      { value: 50, label: '소량 (50개)' },
                      { value: 100, label: '중량 (100개)' },
                      { value: 0, label: '전체' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setMaxTargets(option.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          maxTargets === option.value
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    * CORS 프록시를 통해 홈페이지에 접속하여 이메일을 추출합니다. 사이트당 약 1초 소요됩니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: 크롤링 중 */}
          {step === 'crawling' && (
            <div className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      이메일 크롤링 중...
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {crawlProgress?.currentTarget || '준비 중...'}
                    </div>
                  </div>
                </div>

                {crawlProgress && crawlProgress.total > 0 && (
                  <>
                    <div className="h-2 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${(crawlProgress.current / crawlProgress.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>진행: {crawlProgress.current}/{crawlProgress.total}</span>
                      <span className="text-green-600">성공: {crawlProgress.success}</span>
                      <span className="text-red-500">실패: {crawlProgress.failed}</span>
                    </div>
                  </>
                )}
              </div>

              {/* 로그 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    크롤링 로그 ({logs.length})
                  </span>
                </div>
                <div
                  ref={logContainerRef}
                  className="h-48 overflow-y-auto p-3 font-mono text-xs space-y-1 bg-gray-900 text-gray-100"
                >
                  {logs.map((log, idx) => (
                    <div key={idx} className={`flex gap-2 ${getLogStyle(log.type)}`}>
                      <span className="text-gray-500 w-16 flex-shrink-0">
                        {log.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="w-4">{getLogIcon(log.type)}</span>
                      <span className="flex-1 truncate">
                        {log.message}
                        {log.details && <span className="text-gray-500 ml-2">({log.details})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 완료 */}
          {step === 'done' && crawlResult && (
            <div className="space-y-4">
              <div className="py-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  이메일 크롤링 완료!
                </h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>총 {crawlResult.total}개 사이트 처리</p>
                  <p className="text-green-600 font-medium">성공: {crawlResult.success}개</p>
                  <p className="text-red-500">실패: {crawlResult.failed}개</p>
                </div>
              </div>

              {/* 추출된 이메일 미리보기 */}
              {crawlResult.emails.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      추출된 이메일 (최근 10개)
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">단체명</th>
                          <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">이메일</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {crawlResult.emails.slice(-10).map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-2 text-gray-900 dark:text-white truncate max-w-[150px]">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-blue-600 dark:text-blue-400">
                              {item.email}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 안내 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  추출된 이메일은 구글시트(이메일데이타V1.0)에 저장되었습니다.
                </p>
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {message?.type === 'error' && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">{message.text}</p>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          {step === 'ready' && (
            <>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleStartCrawling}
                disabled={!isLoggedIn || !stats || stats.pending === 0}
                className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                크롤링 시작
              </button>
            </>
          )}

          {step === 'crawling' && (
            <button
              onClick={handleStopCrawling}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              ⏹ 크롤링 중단
            </button>
          )}

          {step === 'done' && (
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
