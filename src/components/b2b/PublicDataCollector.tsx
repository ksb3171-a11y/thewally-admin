import { useState, useEffect, useRef } from 'react';
import {
  getAvailableSources,
  getSidoList,
  collectByRegion,
  collectAll,
  getRawDataStats,
  saveToRawDataSheet,
  type PublicDataSource,
  type CollectionProgress,
  type CollectedOrganization,
  type CollectionLog,
  type CollectionOptions,
} from '../../services/publicDataService';
import { getAccessToken, getChurchCollectionProgress, clearChurchProgress } from '../../services/localStorage';
import { useBackgroundTask } from '../../contexts/BackgroundTaskContext';

interface PublicDataCollectorProps {
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

type Step = 'select' | 'collecting' | 'done';

export const PublicDataCollector = ({ onClose, onSuccess }: PublicDataCollectorProps) => {
  const { collectionTask, setCollectionTask, minimizeCollection, closeCollection } = useBackgroundTask();

  const [sources] = useState<PublicDataSource[]>(() => getAvailableSources());
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedSido, setSelectedSido] = useState<string>('전국');
  const [isCollecting, setIsCollecting] = useState(false);
  const [progress, setProgress] = useState<CollectionProgress | null>(null);
  const [collectedData, setCollectedData] = useState<CollectedOrganization[]>([]);
  const [step, setStep] = useState<Step>('select');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stats, setStats] = useState<{ total: number; pending: number } | null>(null);

  // 실제 저장된 개수 추적
  const [savedCount, setSavedCount] = useState<number>(0);

  // 상세 로그
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 수집 중단용 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // 수집 옵션
  const [maxItems, setMaxItems] = useState<number>(0); // 0 = 무제한
  const [establishmentFilter, setEstablishmentFilter] = useState<string[]>([]); // 설립유형 필터 (빈 배열 = 전체)

  // 교회 수집 진행 상황
  const [churchProgress, setChurchProgress] = useState<Record<string, { lastPage: number; lastUpdated: string }>>({});

  // 교회 진행 상황 로드
  useEffect(() => {
    if (selectedSource === 'church') {
      setChurchProgress(getChurchCollectionProgress());
    }
  }, [selectedSource]);

  // 교회 진행 상황 초기화 핸들러
  const handleResetChurchProgress = (sido?: string) => {
    clearChurchProgress(sido);
    setChurchProgress(getChurchCollectionProgress());
    addLog({
      timestamp: new Date(),
      type: 'info',
      message: sido ? `${sido} 수집 진행 상황 초기화됨` : '전체 수집 진행 상황 초기화됨',
    });
  };

  // 전역 상태 동기화
  useEffect(() => {
    const sourceName = selectedSource ? sources.find(s => s.id === selectedSource)?.name : undefined;
    setCollectionTask({
      isActive: true,
      step,
      progress,
      collectedData,
      sourceName,
    });
  }, [step, progress, collectedData, selectedSource, sources, setCollectionTask]);

  // 전역 상태에서 isMinimized 가져오기
  const isMinimized = collectionTask.isMinimized;

  // 로그인 상태 확인
  useEffect(() => {
    const token = getAccessToken();
    setIsLoggedIn(!!token);
  }, []);

  // 원본데이터 통계 조회
  useEffect(() => {
    const loadStats = async () => {
      if (isLoggedIn) {
        try {
          const rawStats = await getRawDataStats();
          setStats({ total: rawStats.total, pending: rawStats.pending });
        } catch {
          // 통계 조회 실패 무시
        }
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

  // 데이터 소스 선택
  const handleSourceSelect = (sourceId: string) => {
    setSelectedSource(sourceId);
    setSelectedSido('전국');
  };

  // 수집 시작 (시도별 즉시 저장 방식)
  const handleStartCollection = async () => {
    if (!selectedSource) return;

    if (!isLoggedIn) {
      setMessage({ type: 'error', text: '구글 로그인이 필요합니다. 상단 헤더에서 로그인해주세요.' });
      return;
    }

    // AbortController 생성
    abortControllerRef.current = new AbortController();

    setIsCollecting(true);
    setStep('collecting');
    setMessage(null);
    setCollectedData([]);
    setLogs([]);

    const source = sources.find((s) => s.id === selectedSource);
    if (!source) return;

    const options: CollectionOptions = {
      maxItems: maxItems > 0 ? maxItems : undefined,
      savePerRegion: true,
      delayBetweenRegions: 1000,
      abortSignal: abortControllerRef.current.signal,
      establishmentFilter: establishmentFilter.length > 0 ? establishmentFilter : undefined,
    };

    try {
      let results: CollectedOrganization[];

      if (selectedSido === '전국') {
        results = await collectAll(selectedSource, setProgress, addLog, options);
      } else {
        // 단일 시도 수집
        addLog({
          timestamp: new Date(),
          type: 'info',
          message: `${selectedSido} 수집 시작`,
        });
        results = await collectByRegion(selectedSource, selectedSido, setProgress, abortControllerRef.current?.signal, establishmentFilter.length > 0 ? establishmentFilter : undefined);

        // 중단 여부 확인
        const wasAborted = abortControllerRef.current?.signal.aborted;

        addLog({
          timestamp: new Date(),
          type: wasAborted ? 'warning' : 'success',
          message: wasAborted
            ? `${selectedSido} 수집 중단됨: ${results.length}개 수집됨`
            : `${selectedSido} 수집 완료: ${results.length}개`,
        });

        // 단일 시도도 구글시트에 저장 (중단되어도 수집된 데이터는 저장)
        if (results.length > 0) {
          addLog({
            timestamp: new Date(),
            type: 'saving',
            message: `구글시트 저장 중... (${results.length}개)`,
          });
          const saveResult = await saveToRawDataSheet(results, source.category, (msg) => {
            addLog({ timestamp: new Date(), type: 'info', message: msg });
          });
          setSavedCount(saveResult.saved);
          addLog({
            timestamp: new Date(),
            type: 'success',
            message: `저장 완료: ${saveResult.saved}개 (중복 ${saveResult.skipped}개 제외)`,
          });
        } else {
          setSavedCount(0);
        }
      }

      setCollectedData(results);
      setStep('done');
      onSuccess?.(results.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      const isAborted = errorMessage.includes('중단');

      addLog({
        timestamp: new Date(),
        type: isAborted ? 'warning' : 'error',
        message: isAborted ? '수집이 중단되었습니다' : '수집 중 오류 발생',
        details: errorMessage,
      });

      if (isAborted) {
        // 중단된 경우 현재까지 수집된 데이터로 완료 처리
        // collectedData에서 저장된 개수 계산 (progress에서 가져옴)
        const collectedCount = progress?.collected || 0;
        if (collectedCount > 0) {
          setSavedCount(collectedCount);
        }
        setStep('done');
        setMessage({ type: 'success', text: '수집이 중단되었습니다. 중단 전까지 수집된 데이터는 저장되었습니다.' });
      } else {
        setMessage({
          type: 'error',
          text: errorMessage,
        });
        setStep('select');
      }
    } finally {
      setIsCollecting(false);
      abortControllerRef.current = null;
    }
  };

  // 수집 중단
  const handleStopCollection = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog({
        timestamp: new Date(),
        type: 'warning',
        message: '수집 중단 요청...',
      });
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

  const sidoList = selectedSource ? ['전국', ...getSidoList(selectedSource)] : [];

  // 닫기 핸들러 (전역 상태도 함께 정리)
  const handleClose = () => {
    closeCollection();
    onClose();
  };

  // 최소화 핸들러
  const handleMinimize = () => {
    minimizeCollection();
  };

  // 최소화된 상태일 때는 전역 미니바에서 표시되므로 렌더링하지 않음
  if (isMinimized) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            공공데이터 가져오기
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
              disabled={isCollecting}
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
          {!isLoggedIn && step === 'select' && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                구글 로그인이 필요합니다. 상단 헤더에서 먼저 로그인해주세요.
              </p>
            </div>
          )}

          {/* 기존 데이터 통계 */}
          {isLoggedIn && stats && stats.total > 0 && step === 'select' && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                원본데이터: {stats.total.toLocaleString()}개 | 크롤링 대기: {stats.pending.toLocaleString()}개
              </p>
            </div>
          )}

          {/* STEP 1: 데이터 소스 선택 */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                수집할 공공데이터를 선택하세요. 시도별로 즉시 구글시트에 저장됩니다.
              </p>

              {/* 데이터 소스 목록 */}
              <div className="grid gap-3">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handleSourceSelect(source.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedSource === source.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{source.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {source.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {source.description}
                        </div>
                      </div>
                      {selectedSource === source.id && (
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* 옵션 */}
              {selectedSource && (
                <div className="mt-6 space-y-4">
                  {/* 지역 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      수집 지역
                    </label>
                    <select
                      value={selectedSido}
                      onChange={(e) => setSelectedSido(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {sidoList.map((sido) => (
                        <option key={sido} value={sido}>
                          {sido}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 설립유형 필터 (초중고, 대학 표시) */}
                  {['elementary', 'middle', 'high', 'university'].includes(selectedSource) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        설립유형 필터
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: '', label: '전체', desc: '공립/사립 모두' },
                          { value: '사립', label: '사립만', desc: '이메일 공개율 높음' },
                        ].map((option) => {
                          const isSelected = option.value === ''
                            ? establishmentFilter.length === 0
                            : establishmentFilter.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              onClick={() => {
                                if (option.value === '') {
                                  setEstablishmentFilter([]);
                                } else {
                                  setEstablishmentFilter([option.value]);
                                }
                              }}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-start ${
                                isSelected
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              <span>{option.label}</span>
                              <span className={`text-xs ${isSelected ? 'text-purple-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                {option.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                        * 국공립 교육기관은 이메일을 공개하지 않는 경우가 많습니다. 사립만 수집 권장
                      </p>
                    </div>
                  )}

                  {/* 교회 선택 시 안내 */}
                  {selectedSource === 'church' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">✉️</span>
                          <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              이메일이 포함된 데이터입니다
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                              대한예수교장로회총회 교회주소록에서 이메일이 포함된 데이터를 직접 수집합니다.
                              별도의 2차 크롤링이 필요하지 않습니다.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 이전 수집 진행 상황 표시 */}
                      {Object.keys(churchProgress).length > 0 && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <span className="text-lg">📍</span>
                              <div>
                                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                  이전 수집 기록이 있습니다
                                </p>
                                <div className="text-xs text-blue-600 dark:text-blue-500 mt-1 space-y-0.5">
                                  {Object.entries(churchProgress).map(([sido, info]) => (
                                    <div key={sido} className="flex items-center gap-2">
                                      <span>{sido}: {info.lastPage}페이지부터 시작</span>
                                      <button
                                        onClick={() => handleResetChurchProgress(sido)}
                                        className="text-red-500 hover:text-red-700 text-xs underline"
                                        title={`${sido} 진행 상황 초기화`}
                                      >
                                        초기화
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleResetChurchProgress()}
                              className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded"
                              title="전체 진행 상황 초기화"
                            >
                              전체 초기화
                            </button>
                          </div>
                          <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                            * 이어서 수집하면 이전에 수집한 페이지는 건너뛰고 다음 페이지부터 수집합니다.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 수집 개수 제한 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      수집 범위 선택
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 100, label: '테스트 (100개)', desc: '빠른 테스트용' },
                        { value: 500, label: '소량 (500개)', desc: '중간 테스트' },
                        { value: 1000, label: '중량 (1,000개)', desc: '본격 수집' },
                        { value: 0, label: '전국 전체', desc: '전체 수집' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setMaxItems(option.value)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-start ${
                            maxItems === option.value
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <span>{option.label}</span>
                          <span className={`text-xs ${maxItems === option.value ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {option.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                    {/* 예상 API 호출 안내 */}
                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        📊 <strong>예상 정보:</strong>
                        {maxItems === 0 ? (
                          selectedSido === '전국' ? (
                            <> 전국 17개 시도 × 약 15회 = <span className="text-blue-600 dark:text-blue-400 font-medium">약 250회 API 호출</span> (약 8,000~9,000개)</>
                          ) : (
                            <> {selectedSido} 전체 = <span className="text-blue-600 dark:text-blue-400 font-medium">약 15회 API 호출</span></>
                          )
                        ) : (
                          <> 최대 {maxItems.toLocaleString()}개 수집 (API 호출 최소화)</>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        * 시도별 1초 딜레이, 공공데이터포털 제한 내 안전 운영
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: 수집 중 (로그 표시) */}
          {step === 'collecting' && (
            <div className="space-y-4">
              {/* 진행 상태 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {progress?.message || '수집 중...'}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      수집: {progress?.collected.toLocaleString() || 0}개
                      {progress?.total ? ` | 진행: ${Math.round((progress.collected / progress.total) * 100)}%` : ''}
                    </div>
                  </div>
                </div>

                {/* 진행 바 */}
                {progress?.total && progress.total > 0 && (
                  <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((progress.collected / progress.total) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {/* 상세 로그 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    진행 로그 ({logs.length})
                  </span>
                </div>
                <div
                  ref={logContainerRef}
                  className="h-64 overflow-y-auto p-3 font-mono text-xs space-y-1 bg-gray-900 text-gray-100"
                >
                  {logs.map((log, idx) => (
                    <div key={idx} className={`flex gap-2 ${getLogStyle(log.type)}`}>
                      <span className="text-gray-500 w-16 flex-shrink-0">
                        {log.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="w-4">{getLogIcon(log.type)}</span>
                      <span className="flex-1">
                        {log.message}
                        {log.details && (
                          <span className="text-gray-500 ml-2">({log.details})</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-gray-500">로그 대기 중...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 완료 */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="py-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  1차 수집 완료!
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  총 {(savedCount || collectedData.length).toLocaleString()}개가 구글시트(원본데이터V1.0)에 저장되었습니다.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  홈페이지 있음: {collectedData.filter((d) => d.homepage).length.toLocaleString()}개
                </p>
              </div>

              {/* 수집 로그 요약 */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">수집 로그 요약</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                  {logs.filter(l => l.type === 'success').slice(-10).map((log, idx) => (
                    <div key={idx}>{getLogIcon(log.type)} {log.message}</div>
                  ))}
                </div>
              </div>

              {/* 다음 단계 안내 */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <p className="text-sm text-purple-700 dark:text-purple-400 font-medium mb-1">
                  다음 단계: 이메일 크롤링 (별도 실행)
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  [이메일 크롤링] 버튼을 눌러 홈페이지에서 이메일을 추출하세요.
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
          {step === 'select' && (
            <>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleStartCollection}
                disabled={!selectedSource || !isLoggedIn}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                수집 시작
              </button>
            </>
          )}

          {step === 'collecting' && (
            <button
              onClick={handleStopCollection}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              ⏹ 수집 중단
            </button>
          )}

          {step === 'done' && (
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
