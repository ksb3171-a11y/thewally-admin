import { v4 as uuidv4 } from 'uuid';
import type {
  B2BData,
  B2BContact,
  EmailTemplate,
  Campaign,
  B2BStats,
  ContactCategory,
  SeasonTag,
} from '../types/b2b';
import { DEFAULT_CONTACT_CATEGORIES } from '../types/b2b';

const STORAGE_KEY = 'b2b_data';

// 기본 B2B 데이터 생성
const createDefaultB2BData = (): B2BData => ({
  version: 1,
  contacts: [],
  templates: [],
  campaigns: [],
  customCategories: [],
  customSeasons: [],
  lastModifiedAt: new Date().toISOString(),
});

// B2B 데이터 조회
export const getB2BData = (): B2BData => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      // customCategories가 없으면 빈 배열로 초기화 (하위 호환성)
      if (!parsed.customCategories) {
        parsed.customCategories = [];
      }
      // customSeasons가 없으면 빈 배열로 초기화 (하위 호환성)
      if (!parsed.customSeasons) {
        parsed.customSeasons = [];
      }
      return parsed;
    }
    const defaultData = createDefaultB2BData();
    saveB2BData(defaultData);
    return defaultData;
  } catch {
    const defaultData = createDefaultB2BData();
    saveB2BData(defaultData);
    return defaultData;
  }
};

// B2B 데이터 저장
export const saveB2BData = (data: B2BData): void => {
  const updatedData = {
    ...data,
    lastModifiedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
};

// ========================================
// 사용자 정의 분류 관련 함수들
// ========================================

// 모든 분류 가져오기 (기본 + 사용자 정의)
export const getAllCategories = (): string[] => {
  const data = getB2BData();
  return [...DEFAULT_CONTACT_CATEGORIES, ...data.customCategories];
};

// 사용자 정의 분류 추가
export const addCustomCategory = (category: string): boolean => {
  const trimmed = category.trim();
  if (!trimmed) return false;

  const data = getB2BData();
  const allCategories = getAllCategories();

  // 이미 존재하는지 확인
  if (allCategories.includes(trimmed)) {
    return false;
  }

  data.customCategories.push(trimmed);
  saveB2BData(data);
  return true;
};

// 사용자 정의 분류 삭제
export const deleteCustomCategory = (category: string): boolean => {
  const data = getB2BData();
  const index = data.customCategories.indexOf(category);

  if (index === -1) return false;

  data.customCategories.splice(index, 1);
  saveB2BData(data);
  return true;
};

// 사용자 정의 분류 목록
export const getCustomCategories = (): string[] => {
  const data = getB2BData();
  return data.customCategories;
};

// ========================================
// 사용자 정의 시즌/이벤트 관련 함수들
// ========================================

const DEFAULT_SEASONS: string[] = [
  // 학교/기업 공통
  '졸업', '입학', '운동회', '연말', '창립기념', '워크샵',
  // 교회 시즌
  '신년감사예배', '겨울수련회', '새학기/주일학교', '부활절',
  '어버이날', '스승의날', '어린이주일', '맥추감사절',
  '여름수련회', '여름성경학교', '추석', '종교개혁기념주일',
  '추수감사절', '성탄절',
  // 기타
  '기타',
];

// 모든 시즌 가져오기 (기본 + 사용자 정의)
export const getAllSeasons = (): string[] => {
  const data = getB2BData();
  return [...DEFAULT_SEASONS, ...data.customSeasons];
};

// 사용자 정의 시즌 추가
export const addCustomSeason = (season: string): boolean => {
  const trimmed = season.trim();
  if (!trimmed) return false;

  const data = getB2BData();
  const allSeasons = getAllSeasons();

  // 이미 존재하는지 확인
  if (allSeasons.includes(trimmed)) {
    return false;
  }

  data.customSeasons.push(trimmed);
  saveB2BData(data);
  return true;
};

// 사용자 정의 시즌 삭제
export const deleteCustomSeason = (season: string): boolean => {
  const data = getB2BData();
  const index = data.customSeasons.indexOf(season);

  if (index === -1) return false;

  data.customSeasons.splice(index, 1);
  saveB2BData(data);
  return true;
};

// ========================================
// 연락처 관련 함수들
// ========================================

// 연락처 추가
export const addContact = (
  contact: Omit<B2BContact, 'id' | 'collectedAt'>
): B2BContact => {
  const now = new Date().toISOString();
  const newContact: B2BContact = {
    ...contact,
    id: uuidv4(),
    collectedAt: now,
  };

  const data = getB2BData();
  data.contacts.push(newContact);
  saveB2BData(data);

  return newContact;
};

// 연락처 수정
export const updateContact = (
  id: string,
  updates: Partial<Omit<B2BContact, 'id' | 'collectedAt'>>
): B2BContact | null => {
  const data = getB2BData();
  const index = data.contacts.findIndex((c) => c.id === id);

  if (index === -1) return null;

  const updatedContact: B2BContact = {
    ...data.contacts[index],
    ...updates,
  };

  data.contacts[index] = updatedContact;
  saveB2BData(data);

  return updatedContact;
};

// 연락처 삭제
export const deleteContact = (id: string): boolean => {
  const data = getB2BData();
  const initialLength = data.contacts.length;
  data.contacts = data.contacts.filter((c) => c.id !== id);

  if (data.contacts.length < initialLength) {
    saveB2BData(data);
    return true;
  }
  return false;
};

// 모든 연락처 조회
export const getAllContacts = (): B2BContact[] => {
  const data = getB2BData();
  return data.contacts;
};

// 연락처 필터링
export const filterContacts = (
  category?: ContactCategory,
  seasonTag?: SeasonTag,
  searchQuery?: string
): B2BContact[] => {
  let contacts = getAllContacts();

  if (category) {
    contacts = contacts.filter((c) => c.category === category);
  }

  if (seasonTag) {
    contacts = contacts.filter((c) => c.seasonTags.includes(seasonTag));
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    contacts = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query))
    );
  }

  // 최신순 정렬
  return contacts.sort(
    (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
  );
};

// ========================================
// 템플릿 관련 함수들
// ========================================

// 템플릿 추가
export const addTemplate = (
  template: Omit<EmailTemplate, 'id'>
): EmailTemplate => {
  const newTemplate: EmailTemplate = {
    ...template,
    id: uuidv4(),
  };

  const data = getB2BData();
  data.templates.push(newTemplate);
  saveB2BData(data);

  return newTemplate;
};

// 템플릿 수정
export const updateTemplate = (
  id: string,
  updates: Partial<Omit<EmailTemplate, 'id'>>
): EmailTemplate | null => {
  const data = getB2BData();
  const index = data.templates.findIndex((t) => t.id === id);

  if (index === -1) return null;

  const updatedTemplate: EmailTemplate = {
    ...data.templates[index],
    ...updates,
  };

  data.templates[index] = updatedTemplate;
  saveB2BData(data);

  return updatedTemplate;
};

// 템플릿 삭제
export const deleteTemplate = (id: string): boolean => {
  const data = getB2BData();
  const initialLength = data.templates.length;
  data.templates = data.templates.filter((t) => t.id !== id);

  if (data.templates.length < initialLength) {
    saveB2BData(data);
    return true;
  }
  return false;
};

// 모든 템플릿 조회
export const getAllTemplates = (): EmailTemplate[] => {
  const data = getB2BData();
  return data.templates;
};

// 조건에 맞는 템플릿 검색
export const findTemplates = (
  category?: ContactCategory,
  season?: SeasonTag
): EmailTemplate[] => {
  let templates = getAllTemplates();

  if (category) {
    templates = templates.filter((t) => t.targetCategory === category);
  }

  if (season) {
    templates = templates.filter((t) => t.season === season);
  }

  return templates;
};

// ========================================
// 캠페인 관련 함수들
// ========================================

// 캠페인 추가
export const addCampaign = (
  campaign: Omit<Campaign, 'id' | 'createdAt'>
): Campaign => {
  const now = new Date().toISOString();
  const newCampaign: Campaign = {
    ...campaign,
    id: uuidv4(),
    createdAt: now,
  };

  const data = getB2BData();
  data.campaigns.push(newCampaign);
  saveB2BData(data);

  return newCampaign;
};

// 캠페인 수정
export const updateCampaign = (
  id: string,
  updates: Partial<Omit<Campaign, 'id' | 'createdAt'>>
): Campaign | null => {
  const data = getB2BData();
  const index = data.campaigns.findIndex((c) => c.id === id);

  if (index === -1) return null;

  const updatedCampaign: Campaign = {
    ...data.campaigns[index],
    ...updates,
  };

  data.campaigns[index] = updatedCampaign;
  saveB2BData(data);

  return updatedCampaign;
};

// 캠페인 삭제
export const deleteCampaign = (id: string): boolean => {
  const data = getB2BData();
  const initialLength = data.campaigns.length;
  data.campaigns = data.campaigns.filter((c) => c.id !== id);

  if (data.campaigns.length < initialLength) {
    saveB2BData(data);
    return true;
  }
  return false;
};

// 모든 캠페인 조회
export const getAllCampaigns = (): Campaign[] => {
  const data = getB2BData();
  return data.campaigns.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

// ========================================
// 통계 관련 함수들
// ========================================

// B2B 통계 조회
export const getB2BStats = (): B2BStats => {
  const data = getB2BData();
  const contacts = data.contacts;

  // 분류별 통계 (기본 + 사용자 정의)
  const byCategory: Record<string, number> = {};
  const allCategories = getAllCategories();
  allCategories.forEach((cat) => {
    byCategory[cat] = contacts.filter((c) => c.category === cat).length;
  });

  // 시즌별 통계
  const bySeason = {} as Record<SeasonTag, number>;
  const seasons: SeasonTag[] = ['졸업', '입학', '운동회', '연말', '창립기념', '워크샵', '기타'];
  seasons.forEach((season) => {
    bySeason[season] = contacts.filter((c) => c.seasonTags.includes(season)).length;
  });

  // 최근 연락처 5개
  const recentContacts = [...contacts]
    .sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime())
    .slice(0, 5);

  return {
    totalContacts: contacts.length,
    byCategory,
    bySeason,
    recentContacts,
    totalCampaigns: data.campaigns.length,
  };
};

// ========================================
// 데이터 내보내기/가져오기
// ========================================

// B2B 데이터 내보내기
export const exportB2BData = (): string => {
  const data = getB2BData();
  return JSON.stringify(data, null, 2);
};

// B2B 데이터 가져오기
export const importB2BData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString) as B2BData;
    if (data.version && data.contacts && data.templates && data.campaigns) {
      saveB2BData(data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// B2B 데이터 초기화
export const clearB2BData = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// ========================================
// 수신거부 관련 함수들
// ========================================

// 이메일로 연락처 조회
export const getContactByEmail = (email: string): B2BContact | null => {
  const data = getB2BData();
  return data.contacts.find((c) => c.email.toLowerCase() === email.toLowerCase()) || null;
};

// 수신거부 처리
export const unsubscribeContact = (email: string): { success: boolean; name?: string; message: string } => {
  const data = getB2BData();
  const index = data.contacts.findIndex((c) => c.email.toLowerCase() === email.toLowerCase());

  if (index === -1) {
    return { success: false, message: '등록된 이메일이 아닙니다.' };
  }

  const contact = data.contacts[index];

  if (contact.unsubscribed) {
    return { success: false, name: contact.name, message: '이미 수신거부 처리되었습니다.' };
  }

  data.contacts[index] = {
    ...contact,
    unsubscribed: true,
    unsubscribedAt: new Date().toISOString(),
  };
  saveB2BData(data);

  return { success: true, name: contact.name, message: '수신거부 처리되었습니다.' };
};

// 수신거부 해제
export const resubscribeContact = (email: string): { success: boolean; message: string } => {
  const data = getB2BData();
  const index = data.contacts.findIndex((c) => c.email.toLowerCase() === email.toLowerCase());

  if (index === -1) {
    return { success: false, message: '등록된 이메일이 아닙니다.' };
  }

  const contact = data.contacts[index];

  if (!contact.unsubscribed) {
    return { success: false, message: '수신거부 상태가 아닙니다.' };
  }

  data.contacts[index] = {
    ...contact,
    unsubscribed: false,
    unsubscribedAt: undefined,
  };
  saveB2BData(data);

  return { success: true, message: '수신거부가 해제되었습니다.' };
};

// 수신거부 상태 확인
export const isUnsubscribed = (email: string): boolean => {
  const contact = getContactByEmail(email);
  return contact?.unsubscribed === true;
};

// 서버 수신거부 목록 동기화
export const syncUnsubscribeList = async (): Promise<{ synced: number; total: number }> => {
  try {
    const response = await fetch('/api/unsubscribe/list');
    if (!response.ok) {
      throw new Error('수신거부 목록 조회 실패');
    }

    const { unsubscribed } = await response.json();
    if (!Array.isArray(unsubscribed)) {
      return { synced: 0, total: 0 };
    }

    const data = getB2BData();
    let syncedCount = 0;

    unsubscribed.forEach((item: { email: string; timestamp: string }) => {
      const index = data.contacts.findIndex(
        c => c.email.toLowerCase() === item.email.toLowerCase()
      );

      if (index >= 0 && !data.contacts[index].unsubscribed) {
        data.contacts[index] = {
          ...data.contacts[index],
          unsubscribed: true,
          unsubscribedAt: item.timestamp,
        };
        syncedCount++;
      }
    });

    if (syncedCount > 0) {
      saveB2BData(data);
    }

    return { synced: syncedCount, total: unsubscribed.length };
  } catch (error) {
    console.error('수신거부 동기화 오류:', error);
    return { synced: 0, total: 0 };
  }
};

// ========================================
// CSV 관련 함수들
// ========================================

// 간단한 CSV 파싱 (단체명, 이메일만 있는 경우)
export const parseSimpleCSV = (
  csvString: string,
  category: string
): Omit<B2BContact, 'id' | 'collectedAt'>[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const contacts: Omit<B2BContact, 'id' | 'collectedAt'>[] = [];

  // 첫 번째 줄은 헤더로 건너뜀
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 쉼표로 분리
    const values = line.split(',').map((v) => v.trim());
    if (values.length < 2) continue;

    const name = values[0];
    const email = values[1];

    // 이메일 유효성 검사
    if (!name || !email || !email.includes('@')) continue;

    const contact: Omit<B2BContact, 'id' | 'collectedAt'> = {
      name,
      category,
      email,
      phone: undefined,
      address: undefined,
      seasonTags: [],
      memo: undefined,
    };

    contacts.push(contact);
  }

  return contacts;
};

// CSV 일괄 업로드
export const bulkAddContacts = (
  contacts: Omit<B2BContact, 'id' | 'collectedAt'>[]
): B2BContact[] => {
  const now = new Date().toISOString();
  const newContacts: B2BContact[] = contacts.map((contact) => ({
    ...contact,
    id: uuidv4(),
    collectedAt: now,
  }));

  const data = getB2BData();
  data.contacts.push(...newContacts);
  saveB2BData(data);

  return newContacts;
};
