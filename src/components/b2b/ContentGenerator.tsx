import { useState, useEffect, memo, useCallback } from 'react';
import type { B2BContact } from '../../types/b2b';
import {
  getAllContacts,
  getAllCategories,
  getAllSeasons,
  addCustomSeason,
  addCampaign,
  syncUnsubscribeList,
} from '../../services/b2bStorage';
import {
  type Product,
  formatPrice,
} from '../../services/cafe24Products';
import {
  getSavedProducts,
  type SavedProduct,
  convertToAppProduct,
} from '../../services/cafe24Api';
import {
  generateEmail,
  generateEmailSubjects,
  isGeminiConfigured,
  loadCompanyInfo,
  saveCompanyInfo,
  defaultCompanyInfo,
  loadCumulativeUsage,
  resetCumulativeUsage,
  type CompanyInfo,
  type ProductForEmail,
  type TokenUsage,
  type CumulativeTokenUsage,
} from '../../services/geminiAI';
import {
  sendEmail,
  sendTestEmail,
  isDirectSendConfigured,
  loadDirectSendConfig,
  saveDirectSendConfig,
  validateRecipients,
  estimateCost,
  getErrorMessage,
  type DirectSendConfig,
  type EmailRecipient,
  type SendResultItem,
} from '../../services/directSendApi';

// ========================================
// 행사/이벤트 프로필 정의 (컴포넌트 외부에서 정의하여 재사용)
// ========================================
interface EventProfile {
  // 기본 정보
  type: 'academic' | 'celebration' | 'seasonal' | 'corporate' | 'sports' | 'memorial' | 'retreat' | 'religious';
  mood: 'festive' | 'professional' | 'warm' | 'energetic' | 'solemn' | 'spiritual';
  giftPurpose: 'souvenir' | 'prize' | 'appreciation' | 'promotion' | 'commemoration' | 'practical';

  // 행사 상세 분석
  description?: string;           // 행사 설명
  duration?: 'short' | 'day' | 'overnight' | 'multi-day';  // 행사 기간
  location?: 'indoor' | 'outdoor' | 'mixed';               // 장소
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'any'; // 계절
  participants?: 'children' | 'youth' | 'adults' | 'seniors' | 'family' | 'mixed';  // 참여자
  activities?: string[];          // 주요 활동
  essentialItems?: string[];      // 필수 준비물/기념품 키워드
  preferredCategories: string[];
  excludedCategories: string[];
  keywords: string[];
  priceBonus: number; // 가격대 조정 (1.0 = 기본, 1.5 = 고급)
}

const eventProfiles: Record<string, EventProfile> = {
  // 학술/전문 행사
  '학술발표': {
    type: 'academic',
    mood: 'professional',
    giftPurpose: 'souvenir',
    preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
    excludedCategories: ['악세사리', '의류·잡화', '포토·액자', '가방·지갑류'],
    keywords: ['학술', '발표', '세미나', '컨퍼런스', '논문'],
    priceBonus: 1.3
  },
  '워크샵': {
    type: 'corporate',
    mood: 'professional',
    giftPurpose: 'souvenir',
    preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
    excludedCategories: ['악세사리', '포토·액자'],
    keywords: ['워크샵', '연수', '교육', '세미나'],
    priceBonus: 1.1
  },
  // 기념 행사
  '입학': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'souvenir',
    preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
    excludedCategories: [],
    keywords: ['입학', '새학기', '신입생', '환영'],
    priceBonus: 1.0
  },
  '졸업': {
    type: 'celebration',
    mood: 'warm',
    giftPurpose: 'commemoration',
    preferredCategories: ['포토·액자', '컵·텀블러', '문구·데스크'],
    excludedCategories: [],
    keywords: ['졸업', '축하', '기념', '감사'],
    priceBonus: 1.2
  },
  '창립기념일': {
    type: 'corporate',
    mood: 'festive',
    giftPurpose: 'commemoration',
    preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
    excludedCategories: ['악세사리'],
    keywords: ['창립', '기념', '주년', '역사'],
    priceBonus: 1.3
  },
  // 시즌 행사
  '신년': {
    type: 'seasonal',
    mood: 'festive',
    giftPurpose: 'appreciation',
    preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
    excludedCategories: [],
    keywords: ['신년', '새해', '다이어리', '플래너'],
    priceBonus: 1.1
  },
  '크리스마스': {
    type: 'seasonal',
    mood: 'festive',
    giftPurpose: 'appreciation',
    preferredCategories: ['악세사리', '컵·텀블러', '생활·디지털'],
    excludedCategories: [],
    keywords: ['크리스마스', '선물', '파티'],
    priceBonus: 1.0
  },
  '송년회': {
    type: 'corporate',
    mood: 'festive',
    giftPurpose: 'appreciation',
    preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
    excludedCategories: [],
    keywords: ['송년', '한해', '감사', '새해'],
    priceBonus: 1.2
  },
  // 어린이/청소년 행사
  '어린이날': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'prize',
    preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
    excludedCategories: ['생활·디지털'],
    keywords: ['어린이', '어린이날', '선물'],
    priceBonus: 0.9
  },
  '스승의날': {
    type: 'celebration',
    mood: 'warm',
    giftPurpose: 'appreciation',
    preferredCategories: ['컵·텀블러', '문구·데스크', '포토·액자'],
    excludedCategories: [],
    keywords: ['스승', '선생님', '감사', '존경'],
    priceBonus: 1.1
  },
  // 활동적 행사
  '체육대회': {
    type: 'sports',
    mood: 'energetic',
    giftPurpose: 'prize',
    preferredCategories: ['컵·텀블러', '의류·잡화', '가방·지갑류'],
    excludedCategories: ['문구·데스크', '포토·액자', '생활·디지털'],
    keywords: ['체육', '운동회', '스포츠', '대회'],
    priceBonus: 1.0
  },
  '운동회': {
    type: 'sports',
    mood: 'energetic',
    giftPurpose: 'prize',
    preferredCategories: ['컵·텀블러', '의류·잡화', '가방·지갑류'],
    excludedCategories: ['문구·데스크', '포토·액자', '생활·디지털'],
    keywords: ['체육', '운동회', '스포츠', '대회'],
    priceBonus: 1.0
  },
  '수학여행': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'souvenir',
    preferredCategories: ['가방·지갑류', '컵·텀블러', '악세사리'],
    excludedCategories: ['문구·데스크', '포토·액자'],
    keywords: ['여행', '수학여행', '소풍', '현장학습'],
    priceBonus: 0.9
  },
  '축제': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'souvenir',
    preferredCategories: ['의류·잡화', '악세사리', '컵·텀블러'],
    excludedCategories: ['문구·데스크'],
    keywords: ['축제', '페스티벌', '이벤트', '행사'],
    priceBonus: 1.0
  },
  // ========================================
  // 교회 시즌 (상세 행사 분석 포함)
  // ========================================
  '신년감사예배': {
    type: 'religious',
    mood: 'spiritual',
    giftPurpose: 'appreciation',
    description: '새해 첫 주일에 드리는 감사예배. 한 해를 시작하며 계획을 세우고 감사를 나누는 시간.',
    duration: 'short',
    location: 'indoor',
    season: 'winter',
    participants: 'mixed',
    activities: ['예배', '송구영신', '새해 다짐', '덕담 나누기'],
    essentialItems: ['다이어리', '플래너', '달력', '머그컵', '텀블러', '수건'],
    preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
    excludedCategories: ['의류·잡화', '악세사리'],
    keywords: ['신년', '새해', '감사', '다이어리', '플래너', '머그컵', '달력', '캘린더'],
    priceBonus: 1.1
  },
  '겨울수련회': {
    type: 'retreat',
    mood: 'spiritual',
    giftPurpose: 'practical',
    description: '1박2일~2박3일 숙박하며 진행하는 겨울철 신앙훈련 프로그램. 추운 날씨에 야외/실내 활동 병행.',
    duration: 'multi-day',
    location: 'mixed',
    season: 'winter',
    participants: 'youth',
    activities: ['예배', '찬양', '소그룹 모임', '레크레이션', '눈썰매', '캠프파이어'],
    essentialItems: ['담요', '보온텀블러', '핫팩', '수건', '머플러', '장갑', '모자', '보조배터리'],
    preferredCategories: ['컵·텀블러', '생활·디지털', '의류·잡화'],
    excludedCategories: ['포토·액자', '문구·데스크', '악세사리'],
    keywords: ['수련회', '겨울', '담요', '텀블러', '보온', '따뜻', '핫팩', '방한', '머플러'],
    priceBonus: 1.0
  },
  '새학기/주일학교': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'souvenir',
    description: '3월 새학기를 맞아 주일학교 어린이들에게 새 출발을 축하하고 격려하는 시간.',
    duration: 'short',
    location: 'indoor',
    season: 'spring',
    participants: 'children',
    activities: ['예배', '반 배정', '선생님 소개', '새친구 환영'],
    essentialItems: ['가방', '필통', '연필세트', '색연필', '물병', '이름표'],
    preferredCategories: ['가방·지갑류', '문구·데스크', '컵·텀블러'],
    excludedCategories: ['생활·디지털', '포토·액자'],
    keywords: ['어린이', '주일학교', '새학기', '가방', '필통', '연필', '물병', '학용품'],
    priceBonus: 0.8
  },
  '부활절': {
    type: 'religious',
    mood: 'festive',
    giftPurpose: 'souvenir',
    description: '예수 그리스도의 부활을 기념하는 기독교 최대 명절. 달걀 나눔과 축하 행사가 특징.',
    duration: 'day',
    location: 'indoor',
    season: 'spring',
    participants: 'family',
    activities: ['부활절 예배', '달걀 나눔', '세례식', '찬양'],
    essentialItems: ['달걀케이스', '에코백', '머그컵', '손수건', '키링'],
    preferredCategories: ['컵·텀블러', '악세사리', '가방·지갑류'],
    excludedCategories: ['문구·데스크', '생활·디지털'],
    keywords: ['부활절', '달걀', '에코백', '머그컵', '선물', '봄', '키링'],
    priceBonus: 0.9
  },
  '어버이날': {
    type: 'celebration',
    mood: 'warm',
    giftPurpose: 'appreciation',
    description: '부모님께 감사를 표현하는 날. 교회에서는 어버이주일로 특별히 기념.',
    duration: 'short',
    location: 'indoor',
    season: 'spring',
    participants: 'seniors',
    activities: ['감사예배', '카네이션 달아드리기', '효도 프로그램'],
    essentialItems: ['카네이션', '머그컵', '손수건', '안마기', '건강용품'],
    preferredCategories: ['컵·텀블러', '생활·디지털', '포토·액자'],
    excludedCategories: ['의류·잡화', '가방·지갑류'],
    keywords: ['어버이날', '부모님', '감사', '카네이션', '효도', '건강', '안마'],
    priceBonus: 1.2
  },
  '어린이주일': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'prize',
    description: '어린이날 전후로 교회에서 어린이들을 축복하고 선물을 나눠주는 특별한 주일.',
    duration: 'day',
    location: 'indoor',
    season: 'spring',
    participants: 'children',
    activities: ['어린이 축복 예배', '장기자랑', '게임', '선물 나눔'],
    essentialItems: ['물병', '가방', '장난감', '학용품', '간식'],
    preferredCategories: ['컵·텀블러', '가방·지갑류', '악세사리'],
    excludedCategories: ['생활·디지털', '포토·액자'],
    keywords: ['어린이', '어린이날', '선물', '장난감', '물병', '가방'],
    priceBonus: 0.8
  },
  '맥추감사절': {
    type: 'religious',
    mood: 'warm',
    giftPurpose: 'appreciation',
    description: '초여름 첫 수확에 감사하는 절기. 구약의 칠칠절에서 유래.',
    duration: 'short',
    location: 'indoor',
    season: 'summer',
    participants: 'mixed',
    activities: ['감사예배', '헌물', '친교'],
    essentialItems: ['선풍기', '부채', '텀블러', '손수건'],
    preferredCategories: ['컵·텀블러', '생활·디지털', '문구·데스크'],
    excludedCategories: ['의류·잡화'],
    keywords: ['감사', '수확', '여름', '시원', '부채', '선풍기'],
    priceBonus: 1.0
  },
  '여름수련회': {
    type: 'retreat',
    mood: 'energetic',
    giftPurpose: 'practical',
    description: '청소년/청년 대상 여름철 신앙훈련 캠프. 물놀이, 야외활동 등 활동적인 프로그램 진행.',
    duration: 'multi-day',
    location: 'outdoor',
    season: 'summer',
    participants: 'youth',
    activities: ['예배', '수영', '물놀이', '캠프파이어', '체육대회', '레크레이션'],
    essentialItems: ['티셔츠', '모자', '물병', '텀블러', '수건', '선크림', '부채', '아이스팩'],
    preferredCategories: ['컵·텀블러', '의류·잡화', '가방·지갑류'],
    excludedCategories: ['포토·액자', '문구·데스크', '생활·디지털'],
    keywords: ['수련회', '여름', '티셔츠', '모자', '물병', '텀블러', '시원', '캠프'],
    priceBonus: 1.0
  },
  '여름성경학교': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'prize',
    description: '방학 중 어린이 대상 1주일 내외 성경공부 프로그램. 게임, 만들기 등 활동 중심.',
    duration: 'day',
    location: 'indoor',
    season: 'summer',
    participants: 'children',
    activities: ['성경공부', '찬양', '율동', '만들기', '게임', '간식'],
    essentialItems: ['물병', '가방', '필통', '색연필', '스티커', '부채'],
    preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
    excludedCategories: ['생활·디지털', '포토·액자'],
    keywords: ['어린이', '성경학교', '여름', '물병', '가방', '학용품', 'VBS'],
    priceBonus: 0.8
  },
  '추석': {
    type: 'seasonal',
    mood: 'warm',
    giftPurpose: 'appreciation',
    description: '한가위 명절. 교회에서는 성도들에게 감사의 선물을 전달하기도 함.',
    duration: 'short',
    location: 'indoor',
    season: 'fall',
    participants: 'mixed',
    activities: ['감사예배', '친교', '선물 나눔'],
    essentialItems: ['선물세트', '머그컵', '텀블러', '손수건'],
    preferredCategories: ['컵·텀블러', '생활·디지털', '문구·데스크'],
    excludedCategories: ['의류·잡화', '악세사리'],
    keywords: ['추석', '명절', '선물', '감사', '한가위'],
    priceBonus: 1.2
  },
  '종교개혁기념주일': {
    type: 'memorial',
    mood: 'solemn',
    giftPurpose: 'commemoration',
    description: '10월 31일 마틴 루터의 종교개혁을 기념하는 주일. 개신교의 정체성을 되새기는 시간.',
    duration: 'short',
    location: 'indoor',
    season: 'fall',
    participants: 'adults',
    activities: ['기념예배', '역사 강의'],
    essentialItems: ['책', '노트', '머그컵'],
    preferredCategories: ['문구·데스크', '컵·텀블러'],
    excludedCategories: ['악세사리', '의류·잡화', '가방·지갑류'],
    keywords: ['기념', '역사', '개혁', '책', '노트'],
    priceBonus: 1.0
  },
  '추수감사절': {
    type: 'religious',
    mood: 'warm',
    giftPurpose: 'appreciation',
    description: '11월 셋째 주일. 한 해 농사와 삶의 결실에 감사하는 절기.',
    duration: 'short',
    location: 'indoor',
    season: 'fall',
    participants: 'family',
    activities: ['감사예배', '헌물', '바자회', '친교'],
    essentialItems: ['머그컵', '텀블러', '담요', '감사카드'],
    preferredCategories: ['컵·텀블러', '생활·디지털', '문구·데스크'],
    excludedCategories: [],
    keywords: ['감사', '추수', '가을', '풍성', '수확', '담요'],
    priceBonus: 1.1
  },
  '성탄절': {
    type: 'religious',
    mood: 'festive',
    giftPurpose: 'appreciation',
    description: '12월 25일 예수 그리스도의 탄생을 기념하는 날. 선물 교환과 축하 행사가 특징.',
    duration: 'day',
    location: 'indoor',
    season: 'winter',
    participants: 'family',
    activities: ['성탄예배', '성가대 공연', '선물 교환', '캐롤', '촛불예배'],
    essentialItems: ['머그컵', '키링', '캘린더', '양초', '오너먼트', '담요'],
    preferredCategories: ['컵·텀블러', '악세사리', '생활·디지털'],
    excludedCategories: [],
    keywords: ['크리스마스', '성탄', '선물', '머그컵', '키링', '캘린더', '겨울', '따뜻'],
    priceBonus: 1.0
  },
  // 기타 (기본값)
  '기타': {
    type: 'celebration',
    mood: 'festive',
    giftPurpose: 'souvenir',
    preferredCategories: ['컵·텀블러', '문구·데스크', '가방·지갑류'],
    excludedCategories: [],
    keywords: [],
    priceBonus: 1.0
  },
  '연말': {
    type: 'seasonal',
    mood: 'warm',
    giftPurpose: 'appreciation',
    preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
    excludedCategories: [],
    keywords: ['연말', '송년', '감사', '한해'],
    priceBonus: 1.1
  },
  '창립기념': {
    type: 'corporate',
    mood: 'festive',
    giftPurpose: 'commemoration',
    preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
    excludedCategories: ['악세사리'],
    keywords: ['창립', '기념', '주년', '역사'],
    priceBonus: 1.3
  },
};

// 콘텐츠 생성기 상태 저장/복원 키
const CONTENT_STATE_KEY = 'b2b_content_generator_state';

// 저장할 상태 타입
interface ContentGeneratorState {
  selectedCategory: string;
  selectedSeason: string;
  selectedProducts: Product[];
  emailProductIds: string[];
  excludedProductIds: string[];
  emailSubject: string;
  emailBody: string;
  emailHtml: string;
  viewMode: 'text' | 'html';
  bannerTitle: string;
  bannerSubtitle: string;
}

// 상태 저장 함수
const saveContentState = (state: ContentGeneratorState) => {
  try {
    localStorage.setItem(CONTENT_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('콘텐츠 상태 저장 실패:', e);
  }
};

// 상태 복원 함수
const loadContentState = (): ContentGeneratorState | null => {
  try {
    const stored = localStorage.getItem(CONTENT_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('콘텐츠 상태 복원 실패:', e);
  }
  return null;
};

// 테스트 이메일 입력 컴포넌트 (메모이제이션으로 성능 최적화)
const TestEmailInput = memo(({
  onSend,
  isSending
}: {
  onSend: (email: string) => void;
  isSending: boolean;
}) => {
  const [email, setEmail] = useState('');

  const handleSend = useCallback(() => {
    if (email) {
      onSend(email);
    }
  }, [email, onSend]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="테스트 이메일 주소"
        className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={handleSend}
        disabled={isSending || !email}
        className="px-4 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSending ? '발송 중...' : '테스트 발송'}
      </button>
    </div>
  );
});

export const ContentGenerator = () => {
  // 저장된 상태 복원
  const savedState = loadContentState();

  // 연락처 관련 상태
  const [categories] = useState<string[]>(() => getAllCategories());
  const [selectedCategory, setSelectedCategory] = useState<string>(savedState?.selectedCategory || '');
  const [contacts, setContacts] = useState<B2BContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // 시즌/이벤트 관련 상태
  const [seasons, setSeasons] = useState<string[]>(() => getAllSeasons());
  const [selectedSeason, setSelectedSeason] = useState<string>(savedState?.selectedSeason || '');
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [newSeason, setNewSeason] = useState('');

  // Cafe24 저장된 상품 상태
  const [cafe24SavedProducts, setCafe24SavedProducts] = useState<SavedProduct[]>([]);

  // AI 선정 상품
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(savedState?.selectedProducts || []);

  // 이메일에 포함할 상품 ID (체크박스로 선택)
  const [emailProductIds, setEmailProductIds] = useState<Set<string>>(
    new Set(savedState?.emailProductIds || [])
  );

  // 이미 선정된 상품 ID 기록 (재선정 시 제외용)
  const [excludedProductIds, setExcludedProductIds] = useState<Set<string>>(
    new Set(savedState?.excludedProductIds || [])
  );

  // 이메일 콘텐츠 상태
  const [emailSubject, setEmailSubject] = useState(savedState?.emailSubject || '');
  const [emailBody, setEmailBody] = useState(savedState?.emailBody || '');
  const [emailHtml, setEmailHtml] = useState(savedState?.emailHtml || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'html'>(savedState?.viewMode || 'html');
  const [htmlEditMode, setHtmlEditMode] = useState<'preview' | 'edit' | 'split'>('preview');
  const [bannerTitle, setBannerTitle] = useState(savedState?.bannerTitle || '');
  const [bannerSubtitle, setBannerSubtitle] = useState(savedState?.bannerSubtitle || '');

  // 회사 정보 상태
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => loadCompanyInfo());
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  // 다이렉트센드 상태
  const [directSendConfig, setDirectSendConfig] = useState<DirectSendConfig>(() =>
    loadDirectSendConfig() || { userId: '', apiKey: '' }
  );
  const [showDirectSendModal, setShowDirectSendModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);

  // 발송 현황 상태 (로컬 세션 기록만 유지 - API 미지원으로 대시보드 안내)
  const [dsSendResults, setDsSendResults] = useState<SendResultItem[]>([]);

  // 메시지
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 토큰 사용량 상태
  const [lastTokenUsage, setLastTokenUsage] = useState<TokenUsage | null>(null);
  const [cumulativeUsage, setCumulativeUsage] = useState<CumulativeTokenUsage>(() => loadCumulativeUsage());
  const [showUsagePanel, setShowUsagePanel] = useState(false);

  // AI 제목 제안 상태
  const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
  const [isGeneratingSubjects, setIsGeneratingSubjects] = useState(false);
  const [showSubjectSelector, setShowSubjectSelector] = useState(false);

  // 상태 변경 시 localStorage에 저장
  useEffect(() => {
    saveContentState({
      selectedCategory,
      selectedSeason,
      selectedProducts,
      emailProductIds: Array.from(emailProductIds),
      excludedProductIds: Array.from(excludedProductIds),
      emailSubject,
      emailBody,
      emailHtml,
      viewMode,
      bannerTitle,
      bannerSubtitle,
    });
  }, [selectedCategory, selectedSeason, selectedProducts, emailProductIds, excludedProductIds, emailSubject, emailBody, emailHtml, viewMode, bannerTitle, bannerSubtitle]);

  // Cafe24 저장된 상품 로드 및 수신거부 동기화
  useEffect(() => {
    const savedProducts = getSavedProducts();
    setCafe24SavedProducts(savedProducts);

    // 서버에서 수신거부 목록 동기화
    syncUnsubscribeList().then(({ synced, total }) => {
      if (synced > 0) {
        console.log(`[수신거부] ${synced}건 동기화 완료 (전체 ${total}건)`);
      }
    });
  }, []);

  // 분류 선택 시 연락처 로드
  useEffect(() => {
    if (selectedCategory) {
      const allContacts = getAllContacts();
      const filtered = allContacts.filter((c) => c.category === selectedCategory);
      setContacts(filtered);
      setSelectedContactIds(new Set());
    } else {
      setContacts([]);
      setSelectedContactIds(new Set());
    }
  }, [selectedCategory]);

  // 연락처 전체 선택/해제
  const toggleSelectAllContacts = () => {
    if (selectedContactIds.size === contacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(contacts.map((c) => c.id)));
    }
  };

  // 연락처 개별 선택
  const toggleContactSelect = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 이메일에 포함할 상품 전체 선택/해제
  const toggleSelectAllProducts = () => {
    if (emailProductIds.size === selectedProducts.length) {
      setEmailProductIds(new Set());
    } else {
      setEmailProductIds(new Set(selectedProducts.map((p) => p.id)));
    }
  };

  // 이메일에 포함할 상품 개별 선택
  const toggleProductSelect = (id: string) => {
    setEmailProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 시즌 추가
  const handleAddSeason = () => {
    const trimmed = newSeason.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: '시즌/이벤트명을 입력해주세요.' });
      return;
    }
    if (addCustomSeason(trimmed)) {
      setSeasons(getAllSeasons());
      setSelectedSeason(trimmed);
      setNewSeason('');
      setShowSeasonModal(false);
      setMessage({ type: 'success', text: `"${trimmed}" 시즌이 추가되었습니다.` });
    } else {
      setMessage({ type: 'error', text: '이미 존재하는 시즌입니다.' });
    }
  };

  // 상품 자동 선정 로직 (단체 성격 + 행사 컨셉 종합 분석)
  const selectProductsForTarget = (category: string, season: string, excludeIds: Set<string> = new Set()): SavedProduct[] => {

    // ========================================
    // 1. 단체 성격 정의 (전문성, 연령대, 용도)
    // ========================================
    interface OrganizationProfile {
      type: 'education_child' | 'education_teen' | 'education_adult' | 'professional' | 'religious' | 'sports' | 'community';
      formality: 'casual' | 'semi-formal' | 'formal' | 'professional';
      ageGroup: 'child' | 'teen' | 'adult' | 'mixed';
      priceRange: { min: number; max: number };
      preferredCategories: string[];
      excludedCategories: string[]; // 절대 선정하면 안 되는 카테고리
      keywords: string[];
    }

    const organizationProfiles: Record<string, OrganizationProfile> = {
      // 교육기관 - 어린이
      '어린이집': {
        type: 'education_child',
        formality: 'casual',
        ageGroup: 'child',
        priceRange: { min: 2000, max: 12000 },
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
        excludedCategories: ['생활·디지털', '포토·액자'],
        keywords: ['어린이', '유아', '아이', '키즈', '귀여운']
      },
      '유치원': {
        type: 'education_child',
        formality: 'casual',
        ageGroup: 'child',
        priceRange: { min: 2000, max: 15000 },
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
        excludedCategories: ['생활·디지털'],
        keywords: ['어린이', '유아', '아이', '키즈']
      },
      // 교육기관 - 청소년
      '초등학교': {
        type: 'education_teen',
        formality: 'casual',
        ageGroup: 'child',
        priceRange: { min: 3000, max: 18000 },
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크', '악세사리'],
        excludedCategories: [],
        keywords: ['학교', '학생', '초등']
      },
      '중학교': {
        type: 'education_teen',
        formality: 'semi-formal',
        ageGroup: 'teen',
        priceRange: { min: 5000, max: 22000 },
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크', '의류·잡화'],
        excludedCategories: [],
        keywords: ['학교', '학생', '중학']
      },
      '고등학교': {
        type: 'education_teen',
        formality: 'semi-formal',
        ageGroup: 'teen',
        priceRange: { min: 5000, max: 28000 },
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크', '의류·잡화'],
        excludedCategories: [],
        keywords: ['학교', '학생', '고등']
      },
      // 교육기관 - 성인
      '대학교': {
        type: 'education_adult',
        formality: 'semi-formal',
        ageGroup: 'adult',
        priceRange: { min: 8000, max: 35000 },
        preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털', '가방·지갑류'],
        excludedCategories: [],
        keywords: ['대학', '캠퍼스', '학과']
      },
      // 전문/비즈니스 조직
      '회사': {
        type: 'professional',
        formality: 'professional',
        ageGroup: 'adult',
        priceRange: { min: 10000, max: 50000 },
        preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
        excludedCategories: ['악세사리'],
        keywords: ['기업', '사무', '비즈니스', '오피스', '회의']
      },
      '협회': {
        type: 'professional',
        formality: 'professional',
        ageGroup: 'adult',
        priceRange: { min: 12000, max: 60000 },
        preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
        excludedCategories: ['악세사리', '가방·지갑류'],
        keywords: ['협회', '학회', '전문', '세미나', '컨퍼런스']
      },
      '병원': {
        type: 'professional',
        formality: 'professional',
        ageGroup: 'adult',
        priceRange: { min: 10000, max: 45000 },
        preferredCategories: ['컵·텀블러', '생활·디지털', '문구·데스크'],
        excludedCategories: ['악세사리', '의류·잡화'],
        keywords: ['의료', '건강', '병원', '클리닉']
      },
      // 종교 단체
      '교회': {
        type: 'religious',
        formality: 'semi-formal',
        ageGroup: 'mixed',
        priceRange: { min: 5000, max: 25000 },
        preferredCategories: ['컵·텀블러', '가방·지갑류', '포토·액자', '악세사리'],
        excludedCategories: [],
        keywords: ['교회', '성당', '절', '종교', '신앙']
      },
      // 스포츠/동호회
      '스포츠팀': {
        type: 'sports',
        formality: 'casual',
        ageGroup: 'mixed',
        priceRange: { min: 5000, max: 30000 },
        preferredCategories: ['컵·텀블러', '의류·잡화', '가방·지갑류'],
        excludedCategories: ['문구·데스크', '포토·액자'],
        keywords: ['스포츠', '팀', '운동', '클럽', '동호회']
      },
    };

    // eventProfiles는 파일 상단에 정의됨 (컴포넌트 외부에서 재사용)

    // 기존 eventProfiles에 없는 항목 추가 (로컬에서만 사용)
    const localEventProfiles: Record<string, EventProfile> = {
      ...eventProfiles,
      '세미나': {
        type: 'academic',
        mood: 'professional',
        giftPurpose: 'souvenir',
        preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
        excludedCategories: ['악세사리', '의류·잡화', '포토·액자'],
        keywords: ['세미나', '워크숍', '교육', '강연'],
        priceBonus: 1.2
      },
      '컨퍼런스': {
        type: 'academic',
        mood: 'professional',
        giftPurpose: 'souvenir',
        preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
        excludedCategories: ['악세사리', '의류·잡화', '포토·액자'],
        keywords: ['컨퍼런스', '학회', '포럼'],
        priceBonus: 1.4
      },
      // 축하 행사
      '입학': {
        type: 'celebration',
        mood: 'warm',
        giftPurpose: 'souvenir',
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
        excludedCategories: [],
        keywords: ['입학', '새학기', '신입생', '환영'],
        priceBonus: 1.0
      },
      '졸업': {
        type: 'celebration',
        mood: 'warm',
        giftPurpose: 'commemoration',
        preferredCategories: ['포토·액자', '컵·텀블러', '문구·데스크'],
        excludedCategories: [],
        keywords: ['졸업', '축하', '기념', '감사'],
        priceBonus: 1.2
      },
      '창립기념일': {
        type: 'corporate',
        mood: 'festive',
        giftPurpose: 'commemoration',
        preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
        excludedCategories: ['악세사리'],
        keywords: ['창립', '기념', '주년', '역사'],
        priceBonus: 1.3
      },
      // 시즌 행사
      '신년': {
        type: 'seasonal',
        mood: 'festive',
        giftPurpose: 'appreciation',
        preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
        excludedCategories: [],
        keywords: ['신년', '새해', '다이어리', '플래너'],
        priceBonus: 1.1
      },
      '크리스마스': {
        type: 'seasonal',
        mood: 'festive',
        giftPurpose: 'appreciation',
        preferredCategories: ['악세사리', '컵·텀블러', '생활·디지털'],
        excludedCategories: [],
        keywords: ['크리스마스', '선물', '파티'],
        priceBonus: 1.0
      },
      '송년회': {
        type: 'corporate',
        mood: 'festive',
        giftPurpose: 'appreciation',
        preferredCategories: ['문구·데스크', '컵·텀블러', '생활·디지털'],
        excludedCategories: [],
        keywords: ['송년', '한해', '감사', '새해'],
        priceBonus: 1.2
      },
      // 어린이/청소년 행사
      '어린이날': {
        type: 'celebration',
        mood: 'festive',
        giftPurpose: 'prize',
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
        excludedCategories: ['생활·디지털'],
        keywords: ['어린이', '어린이날', '선물'],
        priceBonus: 0.9
      },
      '스승의날': {
        type: 'celebration',
        mood: 'warm',
        giftPurpose: 'appreciation',
        preferredCategories: ['컵·텀블러', '문구·데스크', '포토·액자'],
        excludedCategories: [],
        keywords: ['스승', '선생님', '감사', '존경'],
        priceBonus: 1.1
      },
      // 활동적 행사
      '체육대회': {
        type: 'sports',
        mood: 'energetic',
        giftPurpose: 'prize',
        preferredCategories: ['컵·텀블러', '의류·잡화', '가방·지갑류'],
        excludedCategories: ['문구·데스크', '포토·액자', '생활·디지털'],
        keywords: ['체육', '운동회', '스포츠', '대회'],
        priceBonus: 1.0
      },
      '수학여행': {
        type: 'celebration',
        mood: 'festive',
        giftPurpose: 'souvenir',
        preferredCategories: ['가방·지갑류', '컵·텀블러', '악세사리'],
        excludedCategories: ['문구·데스크', '포토·액자'],
        keywords: ['여행', '수학여행', '소풍', '현장학습'],
        priceBonus: 0.9
      },
      '축제': {
        type: 'celebration',
        mood: 'festive',
        giftPurpose: 'souvenir',
        preferredCategories: ['의류·잡화', '악세사리', '컵·텀블러'],
        excludedCategories: ['문구·데스크'],
        keywords: ['축제', '페스티벌', '이벤트', '행사'],
        priceBonus: 1.0
      },
      // ========================================
      // 교회 시즌 (상세 행사 분석 포함)
      // ========================================
      '신년감사예배': {
        type: 'religious',
        mood: 'spiritual',
        giftPurpose: 'appreciation',
        description: '새해 첫 주일에 드리는 감사예배. 한 해를 시작하며 계획을 세우고 감사를 나누는 시간.',
        duration: 'short',
        location: 'indoor',
        season: 'winter',
        participants: 'mixed',
        activities: ['예배', '송구영신', '새해 다짐', '덕담 나누기'],
        essentialItems: ['다이어리', '플래너', '달력', '머그컵', '텀블러', '수건'],
        preferredCategories: ['컵·텀블러', '문구·데스크', '생활·디지털'],
        excludedCategories: ['의류·잡화', '악세사리'],
        keywords: ['신년', '새해', '감사', '다이어리', '플래너', '머그컵', '달력', '캘린더'],
        priceBonus: 1.1
      },
      '겨울수련회': {
        type: 'retreat',
        mood: 'spiritual',
        giftPurpose: 'practical',
        description: '1박2일~2박3일 숙박하며 진행하는 겨울철 신앙훈련 프로그램. 추운 날씨에 야외/실내 활동 병행.',
        duration: 'multi-day',
        location: 'mixed',
        season: 'winter',
        participants: 'youth',
        activities: ['예배', '찬양', '소그룹 모임', '레크레이션', '눈썰매', '캠프파이어'],
        essentialItems: ['담요', '보온텀블러', '핫팩', '수건', '머플러', '장갑', '모자', '보조배터리'],
        preferredCategories: ['컵·텀블러', '생활·디지털', '의류·잡화'],
        excludedCategories: ['포토·액자', '문구·데스크', '악세사리'],
        keywords: ['수련회', '겨울', '담요', '텀블러', '보온', '따뜻', '핫팩', '방한', '머플러'],
        priceBonus: 1.0
      },
      '새학기/주일학교': {
        type: 'celebration',
        mood: 'festive',
        giftPurpose: 'souvenir',
        description: '3월 새학기를 맞아 주일학교 어린이들에게 새 출발을 축하하고 격려하는 시간.',
        duration: 'short',
        location: 'indoor',
        season: 'spring',
        participants: 'children',
        activities: ['예배', '반 배정', '선생님 소개', '새친구 환영'],
        essentialItems: ['가방', '필통', '연필세트', '색연필', '물병', '이름표'],
        preferredCategories: ['가방·지갑류', '문구·데스크', '컵·텀블러'],
        excludedCategories: ['생활·디지털', '포토·액자'],
        keywords: ['어린이', '주일학교', '새학기', '가방', '필통', '연필', '물병', '학용품'],
        priceBonus: 0.8
      },
      '부활절': {
        type: 'religious',
        mood: 'festive',
        giftPurpose: 'souvenir',
        description: '예수 그리스도의 부활을 기념하는 기독교 최대 명절. 달걀 나눔과 축하 행사가 특징.',
        duration: 'day',
        location: 'indoor',
        season: 'spring',
        participants: 'family',
        activities: ['부활절 예배', '달걀 나눔', '세례식', '찬양'],
        essentialItems: ['달걀케이스', '에코백', '머그컵', '손수건', '키링'],
        preferredCategories: ['컵·텀블러', '악세사리', '가방·지갑류'],
        excludedCategories: ['문구·데스크', '생활·디지털'],
        keywords: ['부활절', '달걀', '에코백', '머그컵', '선물', '봄', '키링'],
        priceBonus: 0.9
      },
      '어버이날': {
        type: 'celebration',
        mood: 'warm',
        giftPurpose: 'appreciation',
        description: '부모님께 감사를 표현하는 날. 교회에서는 어버이주일로 특별히 기념.',
        duration: 'short',
        location: 'indoor',
        season: 'spring',
        participants: 'seniors',
        activities: ['감사예배', '카네이션 달아드리기', '효도 프로그램'],
        essentialItems: ['카네이션', '머그컵', '손수건', '안마기', '건강용품'],
        preferredCategories: ['컵·텀블러', '생활·디지털', '포토·액자'],
        excludedCategories: ['의류·잡화', '가방·지갑류'],
        keywords: ['어버이날', '부모님', '감사', '카네이션', '효도', '건강', '안마'],
        priceBonus: 1.2
      },
      '어린이주일': {
        type: 'celebration',
        mood: 'festive',
        giftPurpose: 'prize',
        description: '어린이날 전후로 교회에서 어린이들을 축복하고 선물을 나눠주는 특별한 주일.',
        duration: 'day',
        location: 'indoor',
        season: 'spring',
        participants: 'children',
        activities: ['어린이 축복 예배', '장기자랑', '게임', '선물 나눔'],
        essentialItems: ['물병', '가방', '장난감', '학용품', '간식'],
        preferredCategories: ['컵·텀블러', '가방·지갑류', '악세사리'],
        excludedCategories: ['생활·디지털', '포토·액자'],
        keywords: ['어린이', '어린이날', '선물', '장난감', '물병', '가방'],
        priceBonus: 0.8
      },
      '맥추감사절': {
        type: 'religious',
        mood: 'warm',
        giftPurpose: 'appreciation',
        description: '초여름 첫 수확에 감사하는 절기. 구약의 칠칠절에서 유래.',
        duration: 'short',
        location: 'indoor',
        season: 'summer',
        participants: 'mixed',
        activities: ['감사예배', '헌물', '친교'],
        essentialItems: ['선풍기', '부채', '텀블러', '손수건'],
        preferredCategories: ['컵·텀블러', '생활·디지털', '문구·데스크'],
        excludedCategories: ['의류·잡화'],
        keywords: ['감사', '수확', '여름', '시원', '부채', '선풍기'],
        priceBonus: 1.0
      },
      '여름수련회': {
        type: 'retreat',
        mood: 'energetic',
        giftPurpose: 'practical',
        description: '청소년/청년 대상 여름철 신앙훈련 캠프. 물놀이, 야외활동 등 활동적인 프로그램 진행.',
        duration: 'multi-day',
        location: 'outdoor',
        season: 'summer',
        participants: 'youth',
        activities: ['예배', '수영', '물놀이', '캠프파이어', '체육대회', '레크레이션'],
        essentialItems: ['티셔츠', '모자', '물병', '텀블러', '수건', '선크림', '부채', '아이스팩'],
        preferredCategories: ['컵·텀블러', '의류·잡화', '가방·지갑류'],
        excludedCategories: ['포토·액자', '문구·데스크', '생활·디지털'],
        keywords: ['수련회', '여름', '티셔츠', '모자', '물병', '텀블러', '시원', '캠프'],
        priceBonus: 1.0
      },
      '여름성경학교': {
        type: 'celebration',
        mood: 'festive',
        giftPurpose: 'prize',
        description: '방학 중 어린이 대상 1주일 내외 성경공부 프로그램. 게임, 만들기 등 활동 중심.',
        duration: 'day',
        location: 'indoor',
        season: 'summer',
        participants: 'children',
        activities: ['성경공부', '찬양', '율동', '만들기', '게임', '간식'],
        essentialItems: ['물병', '가방', '필통', '색연필', '스티커', '부채'],
        preferredCategories: ['컵·텀블러', '가방·지갑류', '문구·데스크'],
        excludedCategories: ['생활·디지털', '포토·액자'],
        keywords: ['어린이', '성경학교', '여름', '물병', '가방', '학용품', 'VBS'],
        priceBonus: 0.8
      },
      '추석': {
        type: 'seasonal',
        mood: 'warm',
        giftPurpose: 'appreciation',
        description: '한가위 명절. 교회에서는 성도들에게 감사의 선물을 전달하기도 함.',
        duration: 'short',
        location: 'indoor',
        season: 'fall',
        participants: 'mixed',
        activities: ['감사예배', '친교', '선물 나눔'],
        essentialItems: ['선물세트', '머그컵', '텀블러', '손수건'],
        preferredCategories: ['컵·텀블러', '생활·디지털', '문구·데스크'],
        excludedCategories: ['의류·잡화', '악세사리'],
        keywords: ['추석', '명절', '선물', '감사', '한가위'],
        priceBonus: 1.2
      },
      '종교개혁기념주일': {
        type: 'memorial',
        mood: 'solemn',
        giftPurpose: 'commemoration',
        description: '10월 31일 마틴 루터의 종교개혁을 기념하는 주일. 개신교의 정체성을 되새기는 시간.',
        duration: 'short',
        location: 'indoor',
        season: 'fall',
        participants: 'adults',
        activities: ['기념예배', '역사 강의'],
        essentialItems: ['책', '노트', '머그컵'],
        preferredCategories: ['문구·데스크', '컵·텀블러'],
        excludedCategories: ['악세사리', '의류·잡화', '가방·지갑류'],
        keywords: ['기념', '역사', '개혁', '책', '노트'],
        priceBonus: 1.0
      },
      '추수감사절': {
        type: 'religious',
        mood: 'warm',
        giftPurpose: 'appreciation',
        description: '11월 셋째 주일. 한 해 농사와 삶의 결실에 감사하는 절기.',
        duration: 'short',
        location: 'indoor',
        season: 'fall',
        participants: 'family',
        activities: ['감사예배', '헌물', '바자회', '친교'],
        essentialItems: ['머그컵', '텀블러', '담요', '감사카드'],
        preferredCategories: ['컵·텀블러', '생활·디지털', '문구·데스크'],
        excludedCategories: [],
        keywords: ['감사', '추수', '가을', '풍성', '수확', '담요'],
        priceBonus: 1.1
      },
      '성탄절': {
        type: 'religious',
        mood: 'festive',
        giftPurpose: 'appreciation',
        description: '12월 25일 예수 그리스도의 탄생을 기념하는 날. 선물 교환과 축하 행사가 특징.',
        duration: 'day',
        location: 'indoor',
        season: 'winter',
        participants: 'family',
        activities: ['성탄예배', '성가대 공연', '선물 교환', '캐롤', '촛불예배'],
        essentialItems: ['머그컵', '키링', '캘린더', '양초', '오너먼트', '담요'],
        preferredCategories: ['컵·텀블러', '악세사리', '생활·디지털'],
        excludedCategories: [],
        keywords: ['크리스마스', '성탄', '선물', '머그컵', '키링', '캘린더', '겨울', '따뜻'],
        priceBonus: 1.0
      },
    };

    // ========================================
    // 3. 프로필 가져오기 (기본값 포함)
    // ========================================
    const orgProfile = organizationProfiles[category] || {
      type: 'community',
      formality: 'semi-formal',
      ageGroup: 'mixed',
      priceRange: { min: 5000, max: 30000 },
      preferredCategories: ['컵·텀블러', '문구·데스크', '가방·지갑류'],
      excludedCategories: [],
      keywords: []
    };

    const eventProfile = localEventProfiles[season] || {
      type: 'celebration',
      mood: 'festive',
      giftPurpose: 'souvenir',
      preferredCategories: ['컵·텀블러', '문구·데스크', '가방·지갑류'],
      excludedCategories: [],
      keywords: [],
      priceBonus: 1.0
    };

    // ========================================
    // 4. 종합 분석하여 최종 조건 결정
    // ========================================

    // 가격대 계산 (행사 프로필의 보너스 적용)
    const finalPriceRange = {
      min: Math.round(orgProfile.priceRange.min * eventProfile.priceBonus),
      max: Math.round(orgProfile.priceRange.max * eventProfile.priceBonus)
    };

    // 제외 카테고리 합산 (단체 + 행사에서 모두 제외하는 것)
    const excludedCategories = new Set([
      ...orgProfile.excludedCategories,
      ...eventProfile.excludedCategories
    ]);

    // 우선순위 카테고리 결정 (행사 > 단체, 제외된 것 필터링)
    const priorityCategories = [
      ...eventProfile.preferredCategories,
      ...orgProfile.preferredCategories
    ].filter((cat, idx, arr) => arr.indexOf(cat) === idx && !excludedCategories.has(cat));

    // 키워드 합산
    const relevantKeywords = [...orgProfile.keywords, ...eventProfile.keywords];

    // ========================================
    // 5. 상품 점수 계산 및 선정
    // ========================================
    const scoredProducts: Array<{ product: SavedProduct; score: number; reason: string[] }> = [];

    cafe24SavedProducts
      .filter(product => !excludeIds.has(product.id))
      .forEach(product => {
        const productCategory = product.category.large;
        const price = product.salePrice || product.price;
        const reasons: string[] = [];

        // 제외 카테고리 체크 (절대 선정 안 함)
        if (excludedCategories.has(productCategory)) {
          return; // 완전히 제외
        }

        let score = 0;

        // 1. 가격대 적합성 (40점)
        if (price >= finalPriceRange.min && price <= finalPriceRange.max) {
          score += 40;
          reasons.push('적정가격');
        } else if (price >= finalPriceRange.min * 0.7 && price <= finalPriceRange.max * 1.3) {
          score += 20;
          reasons.push('가격근접');
        } else if (price < finalPriceRange.min * 0.5 || price > finalPriceRange.max * 2) {
          // 가격이 너무 벗어나면 제외
          return;
        }

        // 2. 우선순위 카테고리 점수 (30점)
        const priorityIndex = priorityCategories.indexOf(productCategory);
        if (priorityIndex === 0) {
          score += 30;
          reasons.push('최우선카테고리');
        } else if (priorityIndex === 1) {
          score += 25;
          reasons.push('우선카테고리');
        } else if (priorityIndex >= 2 && priorityIndex < 4) {
          score += 15;
          reasons.push('권장카테고리');
        } else if (priorityIndex >= 0) {
          score += 10;
        }

        // 3. 단체주문 카테고리 보너스 (15점)
        if (productCategory === '단체주문') {
          score += 15;
          reasons.push('단체주문용');
        }

        // 4. 할인 상품 보너스 (15점)
        if (product.salePrice && product.salePrice < product.price) {
          const discountRate = (product.price - product.salePrice) / product.price;
          score += Math.round(discountRate * 15);
          if (discountRate >= 0.1) reasons.push('할인상품');
        }

        // 5. 키워드 매칭 보너스 (10점)
        const nameUpper = product.name.toLowerCase();
        const matchedKeywords = relevantKeywords.filter(kw => nameUpper.includes(kw.toLowerCase()));
        if (matchedKeywords.length > 0) {
          score += Math.min(matchedKeywords.length * 5, 10);
          reasons.push('키워드매칭');
        }

        // 6. 전문성/격식 매칭 (행사-단체 조합 시너지)
        if (orgProfile.formality === 'professional' && eventProfile.mood === 'professional') {
          // 전문적인 조직 + 전문적인 행사 = 실용적 상품 선호
          if (['문구·데스크', '생활·디지털', '컵·텀블러'].includes(productCategory)) {
            score += 10;
            reasons.push('전문성매칭');
          }
        }
        if (orgProfile.ageGroup === 'child' && eventProfile.mood === 'festive') {
          // 어린이 단체 + 축제 분위기 = 재미있는 상품 선호
          if (['컵·텀블러', '가방·지갑류', '악세사리'].includes(productCategory)) {
            score += 10;
            reasons.push('어린이축제');
          }
        }

        // 최소 점수 필터 (너무 낮은 점수는 제외)
        if (score < 25) {
          return;
        }

        scoredProducts.push({ product, score, reason: reasons });
      });

    // 점수순 정렬
    scoredProducts.sort((a, b) => b.score - a.score);

    // ========================================
    // 6. 다양성 보장하면서 최종 선정
    // ========================================
    const selected: SavedProduct[] = [];
    const usedCategories = new Set<string>();

    // 1단계: 각 우선순위 카테고리에서 최고 점수 상품 1개씩
    for (const cat of priorityCategories.slice(0, 4)) {
      if (selected.length >= 6) break;

      const catProducts = scoredProducts.filter(
        item => item.product.category.large === cat && !selected.find(p => p.id === item.product.id)
      );

      if (catProducts.length > 0) {
        selected.push(catProducts[0].product);
        usedCategories.add(cat);
      }
    }

    // 2단계: 단체주문 카테고리에서 보충 (다양한 상품 확보)
    if (selected.length < 6) {
      const bulkProducts = scoredProducts.filter(
        item => item.product.category.large === '단체주문' && !selected.find(p => p.id === item.product.id)
      );
      for (const item of bulkProducts) {
        if (selected.length >= 6) break;
        selected.push(item.product);
      }
    }

    // 3단계: 점수 높은 순으로 보충 (다양성 유지)
    if (selected.length < 6) {
      for (const item of scoredProducts) {
        if (selected.length >= 6) break;
        if (!selected.find(p => p.id === item.product.id)) {
          // 같은 카테고리 3개 이상 방지
          const catCount = selected.filter(p => p.category.large === item.product.category.large).length;
          if (catCount < 2) {
            selected.push(item.product);
          }
        }
      }
    }

    // 디버깅용 로그 (개발 시 확인용)
    console.log('상품 선정 분석:', {
      organization: category,
      event: season,
      finalPriceRange,
      excludedCategories: Array.from(excludedCategories),
      priorityCategories,
      topProducts: scoredProducts.slice(0, 10).map(p => ({
        name: p.product.name,
        category: p.product.category.large,
        score: p.score,
        reasons: p.reason
      }))
    });

    return selected;
  };

  // 회사 정보 저장
  const handleSaveCompanyInfo = () => {
    saveCompanyInfo(companyInfo);
    setShowCompanyModal(false);
    setMessage({ type: 'success', text: '회사 정보가 저장되었습니다.' });
  };

  // 상품 재선정 함수 (이메일 생성 없이 상품만 다시 선정)
  const handleReselectProducts = () => {
    if (cafe24SavedProducts.length === 0) {
      setMessage({ type: 'error', text: 'Cafe24 상품을 먼저 수집해주세요.' });
      return;
    }

    if (!selectedCategory && !selectedSeason) {
      setMessage({ type: 'error', text: '분류 또는 시즌/이벤트를 선택해주세요.' });
      return;
    }

    // 현재 선정된 상품들의 ID를 제외 목록에 추가
    const newExcludedIds = new Set(excludedProductIds);
    selectedProducts.forEach(p => newExcludedIds.add(p.id));
    setExcludedProductIds(newExcludedIds);

    // 제외 목록을 적용해서 새 상품 선정
    const newSelectedProducts = selectProductsForTarget(selectedCategory, selectedSeason, newExcludedIds);

    if (newSelectedProducts.length === 0) {
      // 더 이상 선정할 상품이 없으면 제외 목록 초기화 후 다시 선정
      setExcludedProductIds(new Set());
      const resetSelectedProducts = selectProductsForTarget(selectedCategory, selectedSeason, new Set());
      setSelectedProducts(resetSelectedProducts.map(p => convertToAppProduct(p) as unknown as Product));
      setEmailProductIds(new Set(resetSelectedProducts.map(p => p.id)));
      setMessage({ type: 'success', text: '모든 상품을 순환했습니다. 처음부터 다시 선정합니다.' });
    } else {
      setSelectedProducts(newSelectedProducts.map(p => convertToAppProduct(p) as unknown as Product));
      setEmailProductIds(new Set(newSelectedProducts.map(p => p.id)));
      setMessage({ type: 'success', text: `${newSelectedProducts.length}개의 새로운 상품이 선정되었습니다.` });
    }

    // 이메일 콘텐츠 초기화 (새 상품 선정 시 기존 이메일 삭제)
    setEmailSubject('');
    setEmailBody('');
    setEmailHtml('');
  };

  // 상품 선정 (이메일 생성 없이 상품만 선정)
  const handleSelectProducts = () => {
    if (cafe24SavedProducts.length === 0) {
      setMessage({ type: 'error', text: 'Cafe24 상품을 먼저 수집해주세요.' });
      return;
    }

    if (!selectedCategory && !selectedSeason) {
      setMessage({ type: 'error', text: '분류 또는 시즌/이벤트를 선택해주세요.' });
      return;
    }

    // 새로 선정할 때는 제외 목록 초기화
    setExcludedProductIds(new Set());

    // AI가 분류와 시즌에 맞는 상품 자동 선정
    const autoSelectedProducts = selectProductsForTarget(selectedCategory, selectedSeason, new Set());
    setSelectedProducts(autoSelectedProducts.map(p => convertToAppProduct(p) as unknown as Product));

    // 자동 선정된 상품 모두 이메일에 포함 (기본 전체 선택)
    setEmailProductIds(new Set(autoSelectedProducts.map(p => p.id)));

    // 이메일 콘텐츠 초기화 (새 상품 선정 시)
    setEmailSubject('');
    setEmailBody('');
    setEmailHtml('');

    setMessage({ type: 'success', text: `${autoSelectedProducts.length}개 상품이 선정되었습니다. 상품을 확인 후 AI 이메일 생성 버튼을 눌러주세요.` });
  };

  // AI 제목 5개 생성
  const handleGenerateSubjects = async () => {
    if (emailProductIds.size === 0) {
      setMessage({ type: 'error', text: '이메일에 포함할 상품을 1개 이상 선택해주세요.' });
      return;
    }

    if (!isGeminiConfigured()) {
      setMessage({ type: 'error', text: 'Gemini API 키를 먼저 설정해주세요.' });
      return;
    }

    setIsGeneratingSubjects(true);
    setMessage(null);

    try {
      const productsToUse = cafe24SavedProducts.filter(p => emailProductIds.has(p.id));
      const productsForEmail: ProductForEmail[] = productsToUse.map(p => ({
        name: p.name,
        price: p.price,
        salePrice: p.salePrice,
        imageUrl: p.imageUrl,
        category: p.category.large,
        url: p.url,
      }));

      const result = await generateEmailSubjects(
        selectedCategory || '단체',
        selectedSeason || '기타',
        productsForEmail
      );

      setSuggestedSubjects(result.subjects);
      setShowSubjectSelector(true);

      if (result.tokenUsage) {
        setLastTokenUsage(result.tokenUsage);
        setCumulativeUsage(loadCumulativeUsage());
      }

      setMessage({ type: 'success', text: 'AI가 5개의 제목을 제안했습니다. 원하는 제목을 선택하세요.' });
    } catch (error) {
      console.error('제목 생성 오류:', error);
      setMessage({ type: 'error', text: `제목 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
    }

    setIsGeneratingSubjects(false);
  };

  // AI 이메일 생성 (선택된 상품으로)
  const handleGenerateEmail = async () => {
    if (emailProductIds.size === 0) {
      setMessage({ type: 'error', text: '이메일에 포함할 상품을 1개 이상 선택해주세요.' });
      return;
    }

    setIsGenerating(true);
    setMessage(null);

    // 선택된 상품만 필터링
    const productsToUse = cafe24SavedProducts.filter(p => emailProductIds.has(p.id));

    // Gemini API 사용 여부 확인
    if (isGeminiConfigured()) {
      try {
        // 상품 정보 변환
        const productsForEmail: ProductForEmail[] = productsToUse.map(p => ({
          name: p.name,
          price: p.price,
          salePrice: p.salePrice,
          imageUrl: p.imageUrl,
          category: p.category.large,
          url: p.url,
        }));

        // 현재 시즌의 EventProfile 가져오기
        const currentEventProfile = selectedSeason ? eventProfiles[selectedSeason] : undefined;

        // EventProfile을 geminiAI에서 사용하는 형식으로 변환
        const eventProfileForEmail = currentEventProfile ? {
          type: currentEventProfile.type,
          mood: currentEventProfile.mood,
          giftPurpose: currentEventProfile.giftPurpose,
          description: currentEventProfile.description,
          duration: currentEventProfile.duration,
          location: currentEventProfile.location,
          season: currentEventProfile.season,
          participants: currentEventProfile.participants,
          activities: currentEventProfile.activities,
          essentialItems: currentEventProfile.essentialItems,
        } : undefined;

        // Gemini API 호출
        const result = await generateEmail({
          category: selectedCategory,
          season: selectedSeason,
          products: productsForEmail,
          companyInfo: companyInfo,
          eventProfile: eventProfileForEmail,
        });

        setEmailSubject(result.subject);
        setEmailBody(result.textBody);
        setEmailHtml(result.htmlBody);

        // HTML에서 배너 제목/부제목 추출 (파란색 배경 헤더 영역에서)
        const headerMatch = result.htmlBody.match(/<td[^>]*background-color:\s*#3B82F6[^>]*>([\s\S]*?)<\/td>/i);
        if (headerMatch) {
          const headerContent = headerMatch[1];
          const titleMatch = headerContent.match(/<h1[^>]*>([^<]*)<\/h1>/i);
          const subtitleMatch = headerContent.match(/<\/h1>[\s\S]*?<p[^>]*>([^<]*)<\/p>/i);
          if (titleMatch) setBannerTitle(titleMatch[1]);
          if (subtitleMatch) setBannerSubtitle(subtitleMatch[1]);
        }

        // 토큰 사용량 업데이트
        if (result.tokenUsage) {
          setLastTokenUsage(result.tokenUsage);
          setCumulativeUsage(loadCumulativeUsage());
        }

        const tokenMsg = result.tokenUsage
          ? ` (토큰: ${result.tokenUsage.totalTokens.toLocaleString()}개, 약 ${result.tokenUsage.estimatedCostKRW.toFixed(2)}원)`
          : '';
        setMessage({ type: 'success', text: `AI가 ${productsToUse.length}개 상품으로 이메일을 생성했습니다.${tokenMsg}` });
      } catch (error) {
        console.error('Gemini API 오류:', error);
        setMessage({ type: 'error', text: `AI 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
        // 폴백: 템플릿 기반 생성
        generateFallbackEmail(productsToUse);
      }
    } else {
      // API 키 없음: 템플릿 기반 생성
      generateFallbackEmail(productsToUse);
      setMessage({ type: 'success', text: `${productsToUse.length}개 상품으로 이메일을 생성했습니다. (Gemini API 키를 설정하면 AI 생성을 사용할 수 있습니다)` });
    }

    setIsGenerating(false);
  };

  // 폴백: 템플릿 기반 이메일 생성
  const generateFallbackEmail = (autoSelectedProducts: SavedProduct[]) => {
    const categoryName = selectedCategory || '단체';
    const seasonName = selectedSeason || '특별';

    // 제목 생성 (광고 표시 필수 + 클릭 유도 문구)
    // 시즌별/분류별 매력적인 제목 템플릿
    const subjectTemplates: Record<string, string[]> = {
      '입학': [
        `(광고) ${categoryName} 입학 준비, 담당자가 가장 많이 묻는 질문 정리`,
        `(광고) 처음 입학 굿즈 제작하는 분들을 위한 체크리스트`,
        `(광고) ${categoryName} 입학 선물, 이런 구성으로 많이 선택합니다`,
      ],
      '졸업': [
        `(광고) ${categoryName} 졸업 선물, 실패 줄이는 체크리스트`,
        `(광고) 졸업 기념품 제작, 견적 전에 꼭 확인해야 할 것`,
        `(광고) ${categoryName} 졸업 굿즈, 이런 구성으로 많이 선택합니다`,
      ],
      '체육대회': [
        `(광고) ${categoryName} 체육대회 준비, 담당자가 가장 고민하는 것`,
        `(광고) 체육대회 굿즈 제작, 일정 꼬이지 않게 준비하는 방법`,
        `(광고) ${categoryName} 체육대회 아이템, 이런 구성이 인기입니다`,
      ],
      '신년': [
        `(광고) ${categoryName} 신년 선물, 고민 없이 선택하는 방법`,
        `(광고) 신년 기념품 제작, 어디까지 맡기면 될까요?`,
      ],
      '크리스마스': [
        `(광고) ${categoryName} 크리스마스 선물, 이런 구성으로 많이 선택합니다`,
        `(광고) 크리스마스 단체 선물, 예산별 추천 사례`,
      ],
    };

    // 기본 템플릿 (시즌이 없거나 매칭 안될 때)
    const defaultTemplates = [
      `(광고) ${categoryName} 단체 주문, 담당자가 가장 많이 묻는 질문 정리`,
      `(광고) ${categoryName} 굿즈 제작, 이것만 알면 실패 없습니다`,
      `(광고) 단체 주문 제작 가이드 - 수량, 로고, 납기 한 번에 정리`,
    ];

    // 시즌에 맞는 템플릿 선택 (없으면 기본 템플릿)
    const templates = subjectTemplates[seasonName] || defaultTemplates;
    // 랜덤하게 하나 선택
    const subject = templates[Math.floor(Math.random() * templates.length)];

    // 텍스트 본문 생성
    let body = `안녕하세요,\n\n`;
    body += `${seasonName}을 맞이하여 ${categoryName} 고객님을 위한 특별한 상품을 소개해 드립니다.\n\n`;

    if (selectedSeason === '입학') {
      body += `새 학기를 맞이하는 아이들에게 꼭 필요한 실용적인 아이템들을 준비했습니다.\n`;
      body += `단체 주문 시 로고 인쇄 및 이름 각인 서비스도 가능합니다.\n\n`;
    } else if (selectedSeason === '졸업') {
      body += `소중한 졸업을 축하하며, 기념이 될 만한 특별한 선물을 준비했습니다.\n`;
      body += `감사의 마음을 담아 전할 수 있는 아이템들입니다.\n\n`;
    } else if (selectedSeason === '체육대회') {
      body += `활기찬 체육대회를 위한 실용적인 아이템들을 소개합니다.\n`;
      body += `팀 로고 인쇄로 단합력도 높여보세요!\n\n`;
    } else {
      body += `특별히 엄선한 인기 상품들을 소개해 드립니다.\n\n`;
    }

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    body += `추천 상품 안내\n`;
    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    autoSelectedProducts.forEach((product, index) => {
      const price = product.salePrice || product.price;
      const originalPrice = product.salePrice ? product.price : null;

      body += `${index + 1}. ${product.name}\n`;
      if (originalPrice) {
        body += `   정가: ${formatPrice(originalPrice)} → 특가: ${formatPrice(price)}\n`;
        const discount = Math.round((1 - price / originalPrice) * 100);
        body += `   ${discount}% 할인!\n`;
      } else {
        body += `   가격: ${formatPrice(price)}\n`;
      }
      body += `   카테고리: ${product.category.large}\n\n`;
    });

    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    body += `단체 주문 혜택\n`;
    body += `• 50개 이상: 5% 추가 할인\n`;
    body += `• 100개 이상: 10% 추가 할인 + 무료 배송\n`;
    body += `• 로고/이름 인쇄 서비스 가능\n\n`;
    body += `궁금하신 점이 있으시면 언제든 연락 주세요.\n\n`;
    body += `감사합니다.\n\n`;
    body += `─────────────────────────────\n`;
    body += `${companyInfo.companyName} | 대표: ${companyInfo.ceoName}\n`;
    body += `전화: ${companyInfo.phone} | 이메일: ${companyInfo.email}\n`;
    body += `사업자등록번호: ${companyInfo.businessNumber}\n`;
    body += `주소: ${companyInfo.address}\n`;
    body += `─────────────────────────────\n`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    body += `본 메일은 ${todayStr} 기준 수신 동의하신 분들에게 발송됩니다.\n`;
    body += `수신을 원치 않으시면 ${companyInfo.email}로 수신거부 요청해 주세요.`;

    // HTML 본문 생성
    const html = generateFallbackHtml(autoSelectedProducts, subject, categoryName, seasonName);

    setEmailSubject(subject);
    setEmailBody(body);
    setEmailHtml(html);

    // 배너 제목/부제목 설정
    setBannerTitle(`${seasonName} 특별 프로모션`);
    setBannerSubtitle(`${categoryName} 고객님을 위한 맞춤 상품`);
  };

  // 폴백 HTML 생성
  const generateFallbackHtml = (products: SavedProduct[], subject: string, categoryName: string, seasonName: string): string => {
    const productCards = products.map(p => {
      const price = p.salePrice || p.price;
      const originalPrice = p.salePrice ? p.price : null;
      const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;

      return `
        <div style="display: inline-block; width: 180px; margin: 10px; text-align: center; vertical-align: top; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 150px; object-fit: cover;" />
          <div style="padding: 12px;">
            <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 8px; height: 40px; overflow: hidden;">${p.name}</div>
            ${originalPrice ? `<div style="font-size: 12px; color: #9ca3af; text-decoration: line-through;">${formatPrice(originalPrice)}</div>` : ''}
            <div style="font-size: 16px; font-weight: 700; color: #3b82f6;">${formatPrice(price)}</div>
            ${discount > 0 ? `<div style="font-size: 12px; color: #10b981; font-weight: 600;">${discount}% 할인</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Noto Sans KR', sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- 헤더 -->
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; margin: 0;">${seasonName} 특별 프로모션</h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 10px 0 0 0;">${categoryName} 고객님을 위한 맞춤 상품</p>
    </div>

    <!-- 본문 -->
    <div style="padding: 30px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.8;">
        안녕하세요,<br><br>
        ${seasonName}을 맞이하여 특별히 준비한 상품들을 소개해 드립니다.<br>
        단체 주문 시 로고 인쇄 및 이름 각인 서비스도 가능합니다.
      </p>

      <!-- 상품 목록 -->
      <h2 style="color: #1f2937; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin: 30px 0 20px 0;">추천 상품</h2>
      <div style="text-align: center;">
        ${productCards}
      </div>

      <!-- 혜택 안내 -->
      <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 30px 0;">
        <h3 style="color: #1e40af; font-size: 16px; margin: 0 0 15px 0;">단체 주문 혜택</h3>
        <ul style="color: #3730a3; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>50개 이상: 5% 추가 할인</li>
          <li>100개 이상: 10% 추가 할인 + 무료 배송</li>
          <li>로고/이름 인쇄 서비스 가능</li>
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${companyInfo.kakaoChannelUrl || 'http://pf.kakao.com/_xdbxoDn/chat'}" style="display: inline-block; background-color: #fae100; color: #3c1e1e; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; margin-right: 10px;">카톡채널상담</a>
        <a href="https://r365.kr" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">Re:365 더 많은 상품보기</a>
      </div>
    </div>

    <!-- 푸터 (정보통신망법 준수) -->
    <div style="background-color: #f9fafb; padding: 25px; border-top: 1px solid #e5e7eb;">
      <div style="text-align: center; color: #6b7280; font-size: 12px; line-height: 1.8;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">${companyInfo.companyName}</p>
        <p style="margin: 0;">대표: ${companyInfo.ceoName} | 사업자등록번호: ${companyInfo.businessNumber}</p>
        <p style="margin: 0;">주소: ${companyInfo.address}</p>
        <p style="margin: 0;">전화: ${companyInfo.phone} | 이메일: ${companyInfo.email}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;" />
        <p style="margin: 0; color: #9ca3af;">
          본 메일은 ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월 ${new Date().getDate()}일 기준 수신 동의하신 분들에게 발송됩니다.<br>
          수신을 원치 않으시면 <a href="${companyInfo.unsubscribeUrl || 'https://re365-proxy-server.onrender.com'}/unsubscribe?email=$$email$$&name=$$name$$" style="color: #3b82f6;">수신거부</a>를 클릭해 주세요.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  // 캠페인 저장
  const handleSaveCampaign = () => {
    if (!emailSubject || !emailBody) {
      setMessage({ type: 'error', text: '이메일 콘텐츠를 먼저 생성해주세요.' });
      return;
    }

    addCampaign({
      name: `${selectedCategory || '전체'} - ${selectedSeason || '일반'}`,
      targetCategory: selectedCategory || '기타',
      templateId: '',
      generatedSubject: emailSubject,
      generatedBody: emailBody,
    });

    setMessage({ type: 'success', text: '캠페인이 저장되었습니다.' });
  };

  // 클립보드 복사
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: `${type}이(가) 클립보드에 복사되었습니다.` });
  };

  // 다이렉트센드 설정 저장
  const handleSaveDirectSendConfig = () => {
    if (!directSendConfig.userId || !directSendConfig.apiKey) {
      setMessage({ type: 'error', text: '아이디와 API 키를 입력해주세요.' });
      return;
    }
    saveDirectSendConfig(directSendConfig);
    setShowDirectSendModal(false);
    setMessage({ type: 'success', text: '다이렉트센드 설정이 저장되었습니다.' });
  };

  // 다이렉트센드 연결 테스트
  const handleTestDirectSendConnection = async () => {
    if (!directSendConfig.userId || !directSendConfig.apiKey) {
      setMessage({ type: 'error', text: '아이디와 API 키를 입력해주세요.' });
      return;
    }

    setIsSending(true);
    try {
      const proxyUrl = import.meta.env.VITE_PROXY_SERVER_URL || '';
      const apiBase = window.location.hostname === 'localhost' ? '' : proxyUrl;
      const response = await fetch(`${apiBase}/api/directsend/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: directSendConfig.userId,
          apiKey: directSendConfig.apiKey,
        }),
      });
      const result = await response.json();

      if (result.status === 0) {
        setMessage({ type: 'success', text: `연결 성공! 잔액: ${result.point?.toLocaleString() || 0}원` });
      } else {
        setMessage({ type: 'error', text: `연결 실패: ${result.msg}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `연결 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
    }
    setIsSending(false);
  };

  // 테스트 이메일 발송 (useCallback으로 메모이제이션)
  const handleSendTestEmail = useCallback(async (testEmailAddress: string) => {
    if (!testEmailAddress) {
      setMessage({ type: 'error', text: '테스트 이메일 주소를 입력해주세요.' });
      return;
    }

    if (!emailSubject || !emailHtml) {
      setMessage({ type: 'error', text: '이메일 콘텐츠를 먼저 생성해주세요.' });
      return;
    }

    if (!isDirectSendConfigured()) {
      setMessage({ type: 'error', text: '다이렉트센드 설정을 먼저 완료해주세요.' });
      setShowDirectSendModal(true);
      return;
    }

    setIsSending(true);
    try {
      // 테스트 발송용 HTML 생성 (변수 직접 치환)
      const personalizedHtml = emailHtml
        .replace(/\$\$email\$\$/g, testEmailAddress)
        .replace(/\$\$name\$\$/g, encodeURIComponent('테스트'));

      const result = await sendTestEmail(
        {
          subject: emailSubject,
          body: personalizedHtml,
          sender: companyInfo.email,
          senderName: companyInfo.companyName,
        },
        testEmailAddress
      );

      if (String(result.status) === '0') {
        setMessage({ type: 'success', text: `테스트 이메일 발송 요청 완료 (${testEmailAddress}) - 다이렉트센드에서 검증 후 발송됩니다.` });
        // 로컬 발송 기록 추가
        setDsSendResults(prev => [{
          seq: Date.now().toString(),
          subject: emailSubject,
          send_date: new Date().toLocaleString('ko-KR'),
          success_cnt: 1,
          total_cnt: 1,
          status: '발송 대기',
        }, ...prev].slice(0, 10));
      } else {
        setMessage({ type: 'error', text: `발송 실패: ${getErrorMessage(Number(result.status))}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `발송 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
    }
    setIsSending(false);
  }, [emailSubject, emailHtml, companyInfo.email, companyInfo.companyName]);

  // 발송 현황은 다이렉트센드 대시보드에서 확인 (API 미지원)
  // loadSendStatus 함수 제거 - 공식 API 문서에 잔액/결과 조회 API 없음

  // 대량 이메일 발송
  const handleSendBulkEmail = async () => {
    if (selectedContactIds.size === 0) {
      setMessage({ type: 'error', text: '수신자를 선택해주세요.' });
      return;
    }

    if (!emailSubject || !emailHtml) {
      setMessage({ type: 'error', text: '이메일 콘텐츠를 먼저 생성해주세요.' });
      return;
    }

    if (!isDirectSendConfigured()) {
      setMessage({ type: 'error', text: '다이렉트센드 설정을 먼저 완료해주세요.' });
      setShowDirectSendModal(true);
      return;
    }

    // 발송 확인 모달 표시
    setShowSendConfirmModal(true);
  };

  // 발송 확인 후 실제 발송
  const handleConfirmSend = async () => {
    setShowSendConfirmModal(false);
    setIsSending(true);

    try {
      // 선택된 연락처 목록 (수신거부되지 않은 연락처만)
      const selectedContacts = contacts
        .filter(c => selectedContactIds.has(c.id) && !c.unsubscribed);

      // 수신자 검증
      const recipients: EmailRecipient[] = selectedContacts.map(c => ({
        email: c.email,
        name: c.name,
      }));
      const validation = validateRecipients(recipients);
      if (!validation.valid) {
        setMessage({ type: 'error', text: validation.errors.join('\n') });
        setIsSending(false);
        return;
      }

      // 수신자별로 개별 발송 (이메일/이름 치환)
      let successCount = 0;
      let failCount = 0;

      for (const contact of selectedContacts) {
        // 각 수신자용 HTML 생성 (변수 직접 치환)
        const personalizedHtml = emailHtml
          .replace(/\$\$email\$\$/g, contact.email)
          .replace(/\$\$name\$\$/g, encodeURIComponent(contact.name));

        try {
          const result = await sendEmail({
            subject: emailSubject,
            body: personalizedHtml,
            sender: companyInfo.email,
            senderName: companyInfo.companyName,
            recipients: [{ email: contact.email, name: contact.name }],
          });

          if (String(result.status) === '0') {
            successCount++;
          } else {
            failCount++;
            console.error(`발송 실패 (${contact.email}):`, result);
          }
        } catch (err) {
          failCount++;
          console.error(`발송 오류 (${contact.email}):`, err);
        }

        // 연속 발송 시 약간의 딜레이 (API 부하 방지)
        if (selectedContacts.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (successCount > 0) {
        setMessage({
          type: failCount > 0 ? 'warning' : 'success',
          text: failCount > 0
            ? `${successCount}명 발송 성공, ${failCount}명 발송 실패`
            : `${successCount}명 발송 완료`,
        });

        // 로컬 발송 기록 추가
        setDsSendResults(prev => [{
          seq: Date.now().toString(),
          subject: emailSubject,
          send_date: new Date().toLocaleString('ko-KR'),
          success_cnt: successCount,
          total_cnt: selectedContacts.length,
          fail_cnt: failCount,
          status: failCount > 0 ? '일부 실패' : '발송 완료',
        }, ...prev].slice(0, 10));

        // 캠페인 저장
        addCampaign({
          name: `${selectedCategory || '전체'} - ${selectedSeason || '일반'} (발송완료)`,
          targetCategory: selectedCategory || '기타',
          templateId: '',
          generatedSubject: emailSubject,
          generatedBody: emailBody,
        });
      } else {
        setMessage({ type: 'error', text: `모든 발송이 실패했습니다.` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `발송 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` });
    }
    setIsSending(false);
  };

  return (
    <div className="space-y-6">
      {/* 상단: 타겟 선택 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 분류별 연락처 선택 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            수신자 선택
          </h2>

          {/* 분류 드롭다운 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              분류
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">분류 선택</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 연락처 목록 */}
          {selectedCategory && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={contacts.length > 0 && selectedContactIds.size === contacts.length}
                    onChange={toggleSelectAllContacts}
                    className="w-4 h-4 text-blue-500 rounded"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    전체 선택 ({selectedContactIds.size}/{contacts.length})
                  </span>
                </label>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {contacts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                    해당 분류의 연락처가 없습니다.
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer ${
                        selectedContactIds.has(contact.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedContactIds.has(contact.id)}
                        onChange={() => toggleContactSelect(contact.id)}
                        className="w-4 h-4 text-blue-500 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {contact.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {contact.email}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 시즌/이벤트 선택 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            시즌/이벤트
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              시즌/이벤트 선택
            </label>
            <select
              value={selectedSeason}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  setShowSeasonModal(true);
                  return;
                }
                setSelectedSeason(e.target.value);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택 안함</option>
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__add__">+ 새 시즌 추가</option>
            </select>
          </div>

          {/* 선택 요약 */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">선택 요약</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>분류: {selectedCategory || '미선택'}</li>
              <li>수신자: {selectedContactIds.size}명</li>
              <li>시즌: {selectedSeason || '미선택'}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* AI 상품 추천 안내 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI 상품 추천
          </h2>
          {cafe24SavedProducts.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {cafe24SavedProducts.length}개 상품 수집됨
            </span>
          )}
        </div>

        {/* AI 추천 안내 및 상품 선정 버튼 */}
        {cafe24SavedProducts.length > 0 && selectedProducts.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              자동으로 맞춤 상품을 선정합니다
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              선택한 분류와 시즌/이벤트에 맞는 최적의 상품을 분석하여 추천합니다.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm mb-6">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                카테고리 매칭
              </span>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                적정 가격대
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                할인 상품
              </span>
            </div>
            {/* 상품 선정 버튼 */}
            <button
              onClick={handleSelectProducts}
              disabled={!selectedCategory && !selectedSeason}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              상품 선정하기
            </button>
            {(!selectedCategory && !selectedSeason) && (
              <p className="text-xs text-gray-400 mt-2">분류 또는 시즌/이벤트를 먼저 선택해주세요</p>
            )}
          </div>
        ) : cafe24SavedProducts.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p>등록된 상품이 없습니다.</p>
            <p className="text-sm mt-1">Cafe24 연동 탭에서 상품을 수집해주세요.</p>
          </div>
        ) : null}

        {/* 선정된 상품 표시 (이메일 생성 후) */}
        {selectedProducts.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  선정 상품 ({selectedProducts.length}개)
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailProductIds.size === selectedProducts.length && selectedProducts.length > 0}
                    onChange={toggleSelectAllProducts}
                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  전체 선택
                </label>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  (이메일에 {emailProductIds.size}개 포함)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReselectProducts}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  다른 상품 보기
                </button>
                <button
                  onClick={() => {
                    // 상품 추천 초기화
                    setExcludedProductIds(new Set());
                    setSelectedProducts([]);
                    setEmailProductIds(new Set());
                    // 수신자 선택 초기화
                    setSelectedCategory('');
                    setSelectedContactIds(new Set());
                    // 시즌/이벤트 초기화
                    setSelectedSeason('');
                    // 이메일 내용 초기화
                    setEmailSubject('');
                    setEmailBody('');
                    setEmailHtml('');
                    // 메시지 초기화
                    setMessage(null);
                  }}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                  title="수신자, 시즌/이벤트, 상품 선정, 이메일 내용을 모두 초기화합니다"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  전체 초기화
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {selectedProducts.map((product) => {
                const isIncluded = emailProductIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProductSelect(product.id)}
                    className={`rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                      isIncluded
                        ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-gray-200 dark:border-gray-600 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=No+Image';
                        }}
                      />
                      <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                        isIncluded ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}>
                        {isIncluded ? (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {product.name}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        {formatPrice(product.salePrice || product.price)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* AI 이메일 생성 버튼 및 회사 정보 설정 (상품 선정 후에만 표시) */}
      {selectedProducts.length > 0 && (
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setShowCompanyModal(true)}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            회사 정보 설정
          </button>
          <button
            onClick={handleGenerateEmail}
            disabled={isGenerating || emailProductIds.size === 0}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all"
          >
            {isGenerating ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI 생성 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {isGeminiConfigured() ? 'AI 이메일 생성' : '이메일 생성 (템플릿)'}
              </>
            )}
          </button>
        </div>
      )}

      {/* API 상태 표시 */}
      <div className="flex justify-center gap-4">
        {isGeminiConfigured() ? (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Gemini AI 연동됨
          </span>
        ) : (
          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-full">
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
            Gemini API 키 미설정
          </span>
        )}
        {isDirectSendConfigured() ? (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            다이렉트센드 연동됨
          </span>
        ) : (
          <button
            onClick={() => setShowDirectSendModal(true)}
            className="flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
          >
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            다이렉트센드 설정 필요
          </button>
        )}
        {/* AI 사용량 표시 버튼 */}
        {isGeminiConfigured() && (
          <button
            onClick={() => setShowUsagePanel(!showUsagePanel)}
            className="flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            AI 사용량 {cumulativeUsage.requestCount > 0 ? `(${cumulativeUsage.requestCount}회)` : ''}
          </button>
        )}
      </div>

      {/* AI 사용량 패널 */}
      {showUsagePanel && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Gemini AI 사용량 통계
            </h3>
            <button
              onClick={() => {
                if (confirm('사용량 통계를 초기화하시겠습니까?')) {
                  resetCumulativeUsage();
                  setCumulativeUsage(loadCumulativeUsage());
                  setLastTokenUsage(null);
                }
              }}
              className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 underline"
            >
              초기화
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 총 요청 수 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">총 요청 수</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{cumulativeUsage.requestCount}회</p>
            </div>
            {/* 총 토큰 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">총 토큰</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{cumulativeUsage.totalTokens.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">입력: {cumulativeUsage.totalPromptTokens.toLocaleString()} / 출력: {cumulativeUsage.totalCompletionTokens.toLocaleString()}</p>
            </div>
            {/* 예상 비용 (USD) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">예상 비용 (USD)</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">${cumulativeUsage.totalCostUSD.toFixed(4)}</p>
            </div>
            {/* 예상 비용 (KRW) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">예상 비용 (KRW)</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{cumulativeUsage.totalCostKRW.toFixed(1)}원</p>
            </div>
          </div>

          {/* 마지막 요청 정보 */}
          {lastTokenUsage && (
            <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">마지막 요청</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                  입력: {lastTokenUsage.promptTokens.toLocaleString()} 토큰
                </span>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                  출력: {lastTokenUsage.completionTokens.toLocaleString()} 토큰
                </span>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">
                  비용: {lastTokenUsage.estimatedCostKRW.toFixed(2)}원
                </span>
              </div>
            </div>
          )}

          {/* 비용 안내 */}
          <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500">
            * gemini-2.0-flash 기준: 입력 $0.10/1M토큰, 출력 $0.40/1M토큰 | 환율 약 1,450원 적용
          </p>
        </div>
      )}

      {/* 이메일 미리보기/편집 */}
      {(emailSubject || emailBody) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              이메일 콘텐츠
            </h2>
            <div className="flex gap-2">
              {/* 보기 모드 전환 */}
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('html')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'html'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  HTML 미리보기
                </button>
                <button
                  onClick={() => setViewMode('text')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    viewMode === 'text'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  텍스트 편집
                </button>
              </div>
              <button
                onClick={() => setShowDirectSendModal(true)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                발송 설정
              </button>
              <button
                onClick={handleSaveCampaign}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                캠페인 저장
              </button>
            </div>
          </div>

          {/* 제목 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                제목
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateSubjects}
                  disabled={isGeneratingSubjects || emailProductIds.size === 0}
                  className="text-xs px-2 py-1 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded flex items-center gap-1"
                >
                  {isGeneratingSubjects ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      생성중...
                    </>
                  ) : (
                    'AI 제목 5개 추천'
                  )}
                </button>
                <button
                  onClick={() => handleCopy(emailSubject, '제목')}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  복사
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="제목을 입력하거나 AI 추천을 받아보세요"
              />
              {/* AI 제목 선택 드롭다운 */}
              {showSubjectSelector && suggestedSubjects.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">AI 추천 제목 (클릭하여 선택)</span>
                    <button
                      onClick={() => setShowSubjectSelector(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {suggestedSubjects.map((subject, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setEmailSubject(subject);
                        setShowSubjectSelector(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded-full text-xs flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{subject}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* HTML 편집 및 미리보기 */}
          {viewMode === 'html' && emailHtml && (
            <div className="space-y-3">
              {/* 편집/미리보기 토글 버튼 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHtmlEditMode('preview')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      htmlEditMode === 'preview'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    미리보기
                  </button>
                  <button
                    onClick={() => setHtmlEditMode('edit')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      htmlEditMode === 'edit'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    HTML 편집
                  </button>
                  <button
                    onClick={() => setHtmlEditMode('split')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      htmlEditMode === 'split'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    분할 보기
                  </button>
                </div>
                <button
                  onClick={() => handleCopy(emailHtml, 'HTML')}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  HTML 복사
                </button>
              </div>

              {/* 미리보기 모드 */}
              {htmlEditMode === 'preview' && (
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={emailHtml}
                    className="w-full h-[600px] border-0"
                    title="이메일 미리보기"
                  />
                </div>
              )}

              {/* HTML 편집 모드 */}
              {htmlEditMode === 'edit' && (
                <div>
                  <textarea
                    value={emailHtml}
                    onChange={(e) => setEmailHtml(e.target.value)}
                    className="w-full h-[600px] px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                    spellCheck={false}
                  />
                </div>
              )}

              {/* 분할 보기 모드 */}
              {htmlEditMode === 'split' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      HTML 코드
                    </label>
                    <textarea
                      value={emailHtml}
                      onChange={(e) => setEmailHtml(e.target.value)}
                      className="w-full h-[550px] px-3 py-2 font-mono text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      미리보기
                    </label>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white h-[550px]">
                      <iframe
                        srcDoc={emailHtml}
                        className="w-full h-full border-0"
                        title="이메일 미리보기"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 텍스트 본문 편집 */}
          {viewMode === 'text' && (
            <div className="space-y-4">
              {/* 배너 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  배너 제목 (상단 파란색 영역)
                </label>
                <input
                  type="text"
                  value={bannerTitle}
                  onChange={(e) => {
                    setBannerTitle(e.target.value);
                    // HTML에도 반영 (파란색 배경 헤더 영역의 h1)
                    if (emailHtml) {
                      const updatedHtml = emailHtml.replace(
                        /(<td[^>]*background-color:\s*#3B82F6[^>]*>[\s\S]*?<h1[^>]*>)([^<]*)(<\/h1>)/gi,
                        `$1${e.target.value}$3`
                      );
                      setEmailHtml(updatedHtml);
                    }
                  }}
                  placeholder="예: 신년감사예배"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 배너 부제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  배너 부제목
                </label>
                <input
                  type="text"
                  value={bannerSubtitle}
                  onChange={(e) => {
                    setBannerSubtitle(e.target.value);
                    // HTML에도 반영 (파란색 배경 헤더 영역의 h1 다음 p)
                    if (emailHtml) {
                      const updatedHtml = emailHtml.replace(
                        /(<td[^>]*background-color:\s*#3B82F6[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>)([^<]*)(<\/p>)/gi,
                        `$1${e.target.value}$3`
                      );
                      setEmailHtml(updatedHtml);
                    }
                  }}
                  placeholder="예: 감사와 기쁨을 나누는 특별한 선물"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 본문 텍스트 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    본문 (텍스트)
                  </label>
                  <button
                    onClick={() => handleCopy(emailBody, '본문')}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    복사
                  </button>
                </div>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={20}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* 발송 현황 패널 */}
          {isDirectSendConfigured() && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  발송 현황
                </h4>
                <a
                  href="https://directsend.co.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  대시보드 열기 →
                </a>
              </div>

              {/* 대시보드 안내 */}
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">잔액 및 발송 결과</span>
                  <a
                    href="https://directsend.co.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    다이렉트센드 대시보드에서 확인 →
                  </a>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  잔액 조회 및 상세 발송 결과는 다이렉트센드 웹사이트에서 확인할 수 있습니다.
                </p>
              </div>

              {/* 최근 발송 결과 (로컬 기록) */}
              {dsSendResults.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">최근 발송 내역 (이 세션)</h5>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {dsSendResults.slice(0, 5).map((result, idx) => (
                      <div
                        key={result.seq || idx}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {result.subject || '(제목 없음)'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {result.send_date || '-'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600 dark:text-green-400" title="발송 수">
                                {result.success_cnt ?? '-'}명
                              </span>
                              {result.status && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded text-xs">
                                  {result.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dsSendResults.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  <p>이 세션에서 발송한 내역이 없습니다.</p>
                  <a
                    href="https://directsend.co.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs mt-1 inline-block"
                  >
                    전체 발송 내역은 다이렉트센드 대시보드에서 확인하세요 →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* 이메일 발송 영역 */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* 테스트 발송 - 별도 컴포넌트로 분리하여 성능 최적화 */}
              <TestEmailInput onSend={handleSendTestEmail} isSending={isSending} />

              {/* 대량 발송 버튼 */}
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  선택된 수신자: <span className="font-medium text-gray-900 dark:text-white">{selectedContactIds.size}명</span>
                  {selectedContactIds.size > 0 && (
                    <span className="ml-2 text-xs">
                      (예상 비용: {estimateCost(selectedContactIds.size).min.toLocaleString()}~{estimateCost(selectedContactIds.size).max.toLocaleString()}원)
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSendBulkEmail}
                  disabled={isSending || selectedContactIds.size === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      발송 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      이메일 발송
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 */}
      {message && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg ${
            message.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 시즌 추가 모달 */}
      {showSeasonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              새 시즌/이벤트 추가
            </h3>
            <input
              type="text"
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
              placeholder="시즌/이벤트명 입력"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleAddSeason()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSeasonModal(false);
                  setNewSeason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleAddSeason}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회사 정보 설정 모달 */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              회사 정보 설정
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              이메일 하단에 표시되는 정보통신망법 준수 필수 정보입니다.
            </p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  상호명 *
                </label>
                <input
                  type="text"
                  value={companyInfo.companyName}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  대표자명 *
                </label>
                <input
                  type="text"
                  value={companyInfo.ceoName}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, ceoName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  사업자등록번호 *
                </label>
                <input
                  type="text"
                  value={companyInfo.businessNumber}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, businessNumber: e.target.value })}
                  placeholder="000-00-00000"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  사업장 주소 *
                </label>
                <input
                  type="text"
                  value={companyInfo.address}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  전화번호 *
                </label>
                <input
                  type="text"
                  value={companyInfo.phone}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                  placeholder="02-0000-0000"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  이메일 *
                </label>
                <input
                  type="email"
                  value={companyInfo.email}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  수신거부 링크 (선택)
                </label>
                <input
                  type="url"
                  value={companyInfo.unsubscribeUrl || ''}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, unsubscribeUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  카카오톡 채널 링크 (선택)
                </label>
                <input
                  type="url"
                  value={companyInfo.kakaoChannelUrl || ''}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, kakaoChannelUrl: e.target.value })}
                  placeholder="http://pf.kakao.com/..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setCompanyInfo(loadCompanyInfo());
                  setShowCompanyModal(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={() => setCompanyInfo(defaultCompanyInfo)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                기본값
              </button>
              <button
                onClick={handleSaveCompanyInfo}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다이렉트센드 설정 모달 */}
      {showDirectSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              다이렉트센드 API 설정
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              대량 이메일 발송을 위한 다이렉트센드 API 연동 설정입니다.<br />
              <a
                href="https://directsend.co.kr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                다이렉트센드 홈페이지
              </a>에서 가입 후 API 키를 발급받으세요.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  아이디 *
                </label>
                <input
                  type="text"
                  value={directSendConfig.userId}
                  onChange={(e) => setDirectSendConfig({ ...directSendConfig, userId: e.target.value })}
                  placeholder="다이렉트센드 아이디"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API 키 *
                </label>
                <input
                  type="password"
                  value={directSendConfig.apiKey}
                  onChange={(e) => setDirectSendConfig({ ...directSendConfig, apiKey: e.target.value })}
                  placeholder="API 인증키"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowDirectSendModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleTestDirectSendConnection}
                disabled={isSending}
                className="px-4 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50"
              >
                {isSending ? '테스트 중...' : '연결 테스트'}
              </button>
              <button
                onClick={handleSaveDirectSendConfig}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 발송 확인 모달 */}
      {showSendConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              이메일 발송 확인
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              <span className="font-medium text-gray-900 dark:text-white">{selectedContactIds.size}명</span>의 수신자에게 이메일을 발송합니다.
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">제목:</span>
                  <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{emailSubject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">발신자:</span>
                  <span className="text-gray-900 dark:text-white">{companyInfo.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">예상 비용:</span>
                  <span className="text-gray-900 dark:text-white">
                    {estimateCost(selectedContactIds.size).min.toLocaleString()}~{estimateCost(selectedContactIds.size).max.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-red-500 text-center mb-4">
              * 발송 후 취소할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSendConfirmModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleConfirmSend}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-medium"
              >
                발송하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
