// B2B 마케팅 모듈 타입 정의

// 기본 연락처 분류 (문자열로 확장 가능)
export type ContactCategory = string;

// 기본 분류 옵션
export const DEFAULT_CONTACT_CATEGORIES: string[] = [
  '학교',
  '기업',
  '관공서',
  '협회',
  '종교단체',
  '동호회',
  '기타'
];

// 시즌 태그
export type SeasonTag =
  | '졸업'
  | '입학'
  | '운동회'
  | '연말'
  | '창립기념'
  | '워크샵'
  | '기타';

// B2B 연락처
export interface B2BContact {
  id: string;
  name: string;                    // 단체명
  category: ContactCategory;       // 분류
  email: string;
  phone?: string;
  address?: string;
  seasonTags: SeasonTag[];
  collectedAt: string;             // ISO 날짜 문자열
  memo?: string;
  unsubscribed?: boolean;          // 수신거부 여부
  unsubscribedAt?: string;         // 수신거부 일시
}

// 이메일 템플릿
export interface EmailTemplate {
  id: string;
  name: string;
  targetCategory: ContactCategory;
  season: SeasonTag;
  subject: string;                 // {{변수}} 포함
  body: string;                    // {{변수}} 포함
}

// 캠페인
export interface Campaign {
  id: string;
  name: string;
  targetCategory: ContactCategory;
  templateId: string;
  generatedSubject: string;
  generatedBody: string;
  createdAt: string;
  sentAt?: string;
  sentCount?: number;
}

// 템플릿 변수
export interface TemplateVariables {
  단체명: string;
  분류: string;
  시즌: string;
  상품1?: string;
  가격1?: string;
  할인율?: string;
  [key: string]: string | undefined;
}

// B2B 전체 데이터
export interface B2BData {
  version: number;
  contacts: B2BContact[];
  templates: EmailTemplate[];
  campaigns: Campaign[];
  customCategories: string[];      // 사용자 정의 분류
  customSeasons: string[];         // 사용자 정의 시즌/이벤트
  lastModifiedAt: string;
}

// B2B 탭 타입
export type B2BTabType =
  | 'collect'     // 이메일 수집
  | 'list'        // 이메일 목록
  | 'content'     // 콘텐츠 생성
  | 'campaign'    // 캠페인
  | 'dashboard';  // 대시보드

// B2B 필터 상태
export interface B2BFilterState {
  category?: ContactCategory;
  seasonTag?: SeasonTag;
  searchQuery?: string;
}

// B2B 통계
export interface B2BStats {
  totalContacts: number;
  byCategory: Record<string, number>;
  bySeason: Record<SeasonTag, number>;
  recentContacts: B2BContact[];
  totalCampaigns: number;
}

// 분류 옵션 (UI용) - 하위 호환성
export const CONTACT_CATEGORIES: string[] = DEFAULT_CONTACT_CATEGORIES;

// 시즌 옵션 (UI용)
export const SEASON_TAGS: SeasonTag[] = [
  '졸업',
  '입학',
  '운동회',
  '연말',
  '창립기념',
  '워크샵',
  '기타'
];
