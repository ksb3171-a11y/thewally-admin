import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { UserProfile } from '../auth/UserProfile';
import { GoogleLoginButton } from '../auth/GoogleLoginButton';
import { CategoryManager } from '../category/CategoryManager';
import { AssetManager } from './AssetManager';
import { ConfirmModal } from '../common/Modal';
import { exportData, importData, clearAllData, getDarkMode, saveDarkMode } from '../../services/localStorage';

export const Settings = () => {
  const { isAuthenticated } = useAuth();
  const { manualSync, refreshData, showToast } = useData();
  const [showClearConfirm1, setShowClearConfirm1] = useState(false);
  const [showClearConfirm2, setShowClearConfirm2] = useState(false);
  const [darkMode, setDarkMode] = useState(getDarkMode());
  const [assetUpdateKey, setAssetUpdateKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAssetUpdate = () => {
    setAssetUpdateKey((prev) => prev + 1);
  };

  const handleDarkModeToggle = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    saveDarkMode(newValue);
    document.documentElement.classList.toggle('dark', newValue);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', '데이터가 다운로드되었습니다.');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importData(content);
      if (success) {
        refreshData();
        showToast('success', '데이터를 가져왔습니다.');
      } else {
        showToast('error', '올바른 백업 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearData = () => {
    clearAllData();
    refreshData();
    setShowClearConfirm2(false);
    showToast('success', '모든 데이터가 삭제되었습니다.');
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* 계정 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">계정</h2>
        {isAuthenticated ? (
          <UserProfile />
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Google 계정으로 로그인하면 데이터가 자동으로 동기화됩니다.</p>
            <GoogleLoginButton />
          </div>
        )}
      </div>

      {/* 동기화 */}
      {isAuthenticated && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">동기화</h2>
          <button
            onClick={manualSync}
            className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            수동 동기화
          </button>
        </div>
      )}

      {/* 다크모드 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">화면 설정</h2>
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300">다크 모드</span>
          <button
            onClick={handleDarkModeToggle}
            className={`relative w-14 h-7 rounded-full transition-colors ${darkMode ? 'bg-blue-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${darkMode ? 'left-8' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* 자산 관리 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">자산 관리</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">통장/계좌별 잔액을 등록하세요. 총 자산이 메인 화면에 표시됩니다.</p>
        <AssetManager key={assetUpdateKey} onUpdate={handleAssetUpdate} />
      </div>

      {/* 카테고리 관리 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">카테고리 관리</h2>
        <CategoryManager />
      </div>

      {/* 데이터 관리 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">데이터 관리</h2>
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            데이터 내보내기 (JSON)
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            데이터 가져오기 (JSON)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => setShowClearConfirm1(true)}
            className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            전체 데이터 삭제
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 1차 */}
      <ConfirmModal
        isOpen={showClearConfirm1}
        onClose={() => setShowClearConfirm1(false)}
        onConfirm={() => { setShowClearConfirm1(false); setShowClearConfirm2(true); }}
        title="데이터 삭제"
        message="정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="계속"
      />

      {/* 삭제 확인 모달 2차 */}
      <ConfirmModal
        isOpen={showClearConfirm2}
        onClose={() => setShowClearConfirm2(false)}
        onConfirm={handleClearData}
        title="최종 확인"
        message="모든 거래 내역, 카테고리, 설정이 삭제됩니다. 정말 진행하시겠습니까?"
        confirmText="삭제"
      />
    </div>
  );
};
