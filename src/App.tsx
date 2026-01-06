import { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { BackgroundTaskProvider } from './contexts/BackgroundTaskContext';
import { Header } from './components/common/Header';
import { MobileNavigation, DesktopNavigation } from './components/common/Navigation';
import { ToastContainer } from './components/common/Toast';
import { GlobalTaskMiniBars } from './components/GlobalTaskMiniBars';
import { InputDashboard } from './components/transaction/InputDashboard';
import { TransactionList } from './components/transaction/TransactionList';
import { Dashboard } from './components/dashboard/Dashboard';
import { Settings } from './components/settings/Settings';
import { GoogleLoginButton } from './components/auth/GoogleLoginButton';
import { EmailCollector } from './components/b2b/EmailCollector';
import { EmailList } from './components/b2b/EmailList';
import { ContentGenerator } from './components/b2b/ContentGenerator';
import { B2BDashboard } from './components/b2b/B2BDashboard';
import { Cafe24Settings } from './components/b2b/Cafe24Settings';
import type { TabType } from './types';
import { getCurrentYearMonth } from './utils/format';
import { getDarkMode } from './services/localStorage';
import { getAllContacts } from './services/b2bStorage';
import type { B2BContact } from './types/b2b';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const AppWithOptionalAuth = () => {
  const { isAuthenticated } = useAuth();
  const { toasts, removeToast } = useData();
  const [skipLogin, setSkipLogin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('input');
  const { year, month } = getCurrentYearMonth();
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMonth, setSelectedMonth] = useState(month);

  // B2B 연락처 상태
  const [b2bContacts, setB2bContacts] = useState<B2BContact[]>([]);

  const refreshB2BContacts = useCallback(() => {
    setB2bContacts(getAllContacts());
  }, []);

  useEffect(() => {
    refreshB2BContacts();
  }, [refreshB2BContacts]);

  useEffect(() => {
    const isDark = getDarkMode();
    document.documentElement.classList.toggle('dark', isDark);
    const hasData = localStorage.getItem('budget_data');
    if (hasData || isAuthenticated) {
      setSkipLogin(true);
    }
  }, [isAuthenticated]);

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
  };

  if (!skipLogin && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">내 가계부</h1>
          <p className="text-gray-500 dark:text-gray-400">수입과 지출을 쉽게 관리하세요</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">시작하기</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Google 계정으로 로그인하면<br />데이터가 클라우드에 동기화됩니다
            </p>
          </div>

          <GoogleLoginButton />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-700"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-gray-800 text-gray-500">또는</span></div>
          </div>

          <button
            onClick={() => setSkipLogin(true)}
            className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            로그인 없이 시작하기
          </button>
          <p className="text-xs text-center text-gray-400 mt-3">로컬 저장소에만 데이터가 저장됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header selectedYear={selectedYear} selectedMonth={selectedMonth} onMonthChange={handleMonthChange} />
      <DesktopNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="md:ml-64 pb-20 md:pb-8">
        <div className={`mx-auto p-4 ${activeTab === 'input' || activeTab === 'b2b-content' ? 'max-w-6xl' : 'max-w-4xl'}`}>
          {/* 가계부 탭 */}
          {activeTab === 'input' && <InputDashboard selectedYear={selectedYear} selectedMonth={selectedMonth} />}
          {activeTab === 'history' && <TransactionList selectedYear={selectedYear} selectedMonth={selectedMonth} />}
          {activeTab === 'dashboard' && <Dashboard selectedYear={selectedYear} selectedMonth={selectedMonth} />}
          {activeTab === 'settings' && <Settings />}

          {/* B2B 마케팅 탭 */}
          {activeTab === 'b2b-collect' && (
            <EmailCollector onSuccess={refreshB2BContacts} />
          )}
          {activeTab === 'b2b-list' && (
            <EmailList contacts={b2bContacts} onUpdate={refreshB2BContacts} />
          )}
          {activeTab === 'b2b-content' && <ContentGenerator />}
          {activeTab === 'b2b-dashboard' && <B2BDashboard />}
          {activeTab === 'b2b-settings' && <Cafe24Settings />}
        </div>
      </main>

      <MobileNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <GlobalTaskMiniBars />
    </div>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <DataProvider>
          <BackgroundTaskProvider>
            <AppWithOptionalAuth />
          </BackgroundTaskProvider>
        </DataProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
