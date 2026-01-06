import { useState } from 'react';
import type { TabType } from '../../types';
import type { ReactElement } from 'react';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface TabItem {
  id: TabType;
  label: string;
  icon: ReactElement;
}

interface MenuSection {
  id: string;
  label: string;
  icon: ReactElement;
  tabs: TabItem[];
}

// 아이콘 컴포넌트들
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const UserPlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const ChevronDownIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// 메뉴 섹션 정의
const menuSections: MenuSection[] = [
  {
    id: 'budget',
    label: '가계부',
    icon: <WalletIcon />,
    tabs: [
      { id: 'input', label: '입력', icon: <PlusIcon /> },
      { id: 'history', label: '내역', icon: <DocumentIcon /> },
      { id: 'dashboard', label: '분석', icon: <ChartIcon /> },
    ],
  },
  {
    id: 'b2b',
    label: 'B2B 마케팅',
    icon: <MailIcon />,
    tabs: [
      { id: 'b2b-collect', label: '이메일 수집', icon: <UserPlusIcon /> },
      { id: 'b2b-list', label: '이메일 목록', icon: <UsersIcon /> },
      { id: 'b2b-content', label: '콘텐츠 생성', icon: <PencilIcon /> },
      { id: 'b2b-dashboard', label: '대시보드', icon: <ChartIcon /> },
      { id: 'b2b-settings', label: 'Cafe24 연동', icon: <LinkIcon /> },
    ],
  },
];

// 모바일용 간소화된 탭 (가계부 기본, B2B 선택 시 해당 탭만)
const getMobileSection = (activeTab: TabType): TabItem[] => {
  if (activeTab.startsWith('b2b-')) {
    return menuSections.find((s) => s.id === 'b2b')?.tabs || [];
  }
  return menuSections.find((s) => s.id === 'budget')?.tabs || [];
};

// 현재 탭이 속한 섹션 ID 찾기
const getActiveSectionId = (activeTab: TabType): string => {
  if (activeTab.startsWith('b2b-')) return 'b2b';
  if (activeTab === 'settings') return 'settings';
  return 'budget';
};

// Mobile Navigation (Bottom)
export const MobileNavigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const currentTabs = getMobileSection(activeTab);
  const isB2B = activeTab.startsWith('b2b-');

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 md:hidden z-40">
      <div className="flex justify-around">
        {/* 모듈 전환 버튼 */}
        <button
          onClick={() => onTabChange(isB2B ? 'input' : 'b2b-collect')}
          className="flex-1 flex flex-col items-center py-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {isB2B ? <WalletIcon /> : <MailIcon />}
          <span className="text-xs mt-1">{isB2B ? '가계부' : 'B2B'}</span>
        </button>

        {/* 현재 모듈의 탭들 */}
        {currentTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center py-3 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-500'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            <span className="text-xs mt-1">{tab.label}</span>
          </button>
        ))}

        {/* 설정 */}
        <button
          onClick={() => onTabChange('settings')}
          className={`flex-1 flex flex-col items-center py-3 transition-colors ${
            activeTab === 'settings'
              ? 'text-blue-500'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <GearIcon />
          <span className="text-xs mt-1">설정</span>
        </button>
      </div>
    </nav>
  );
};

// Desktop Navigation (Sidebar)
export const DesktopNavigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    // 활성 탭이 속한 섹션을 기본으로 열기
    const activeSectionId = getActiveSectionId(activeTab);
    return { [activeSectionId]: true };
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // activeTab 변경 시 해당 섹션 열기
  const activeSectionId = getActiveSectionId(activeTab);
  if (!expandedSections[activeSectionId]) {
    setExpandedSections((prev) => ({ ...prev, [activeSectionId]: true }));
  }

  return (
    <nav className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen fixed left-0 top-0 pt-16">
      <div className="p-4 space-y-1">
        {/* 메뉴 섹션들 */}
        {menuSections.map((section) => (
          <div key={section.id} className="mb-2">
            {/* 섹션 헤더 */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${
                expandedSections[section.id]
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {section.icon}
                <span className="font-medium">{section.label}</span>
              </div>
              <ChevronDownIcon isOpen={expandedSections[section.id]} />
            </button>

            {/* 섹션 탭들 */}
            {expandedSections[section.id] && (
              <div className="mt-1 ml-4 space-y-1">
                {section.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tab.icon}
                    <span className="text-sm">{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 구분선 */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

        {/* 설정 */}
        <button
          onClick={() => onTabChange('settings')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
            activeTab === 'settings'
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <GearIcon />
          <span className="font-medium">설정</span>
        </button>
      </div>
    </nav>
  );
};
