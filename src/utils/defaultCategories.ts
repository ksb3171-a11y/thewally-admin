import { v4 as uuidv4 } from 'uuid';
import type { SubCategory, DetailCategory } from '../types';

interface CategoryDefinition {
  name: string;
  details: string[];
}

const expenseCategories: CategoryDefinition[] = [
  { name: '주거비', details: ['월세', '관리비', '수도/전기/가스'] },
  { name: '식비', details: ['장보기', '외식', '배달음식', '카페/음료'] },
  { name: '교통비', details: ['대중교통', '주유비', '주차비', '택시'] },
  { name: '통신비', details: ['휴대폰요금', '인터넷요금'] },
  { name: '프로그램구독', details: ['기타구독'] },
  { name: '의료/건강', details: ['병원비', '약값', '헬스장'] },
  { name: '여가/문화', details: ['영화/공연', '취미활동', '여행'] },
  { name: '쇼핑', details: ['의류', '전자기기', '생활용품'] },
  { name: '교육', details: ['강의/수업', '도서', '학원비'] },
  { name: '금융', details: ['대출이자', '보험료'] },
  { name: '경조사', details: ['축의금', '조의금', '선물'] },
  { name: '기타지출', details: ['기타'] },
];

const incomeCategories: CategoryDefinition[] = [
  { name: '근로소득', details: ['월급', '상여금', '성과급'] },
  { name: '부업소득', details: ['프리랜서', '알바', '원고료'] },
  { name: '투자수익', details: ['주식배당', '이자수익', '부동산임대'] },
  { name: '기타수입', details: ['용돈', '환급금', '중고판매'] },
  { name: '비정기수입', details: ['보너스', '상금'] },
];

export const createDefaultCategories = (): {
  subCategories: SubCategory[];
  detailCategories: DetailCategory[];
} => {
  const now = new Date().toISOString();
  const subCategories: SubCategory[] = [];
  const detailCategories: DetailCategory[] = [];

  // 지출 카테고리 생성
  expenseCategories.forEach((cat, index) => {
    const subCategoryId = uuidv4();
    subCategories.push({
      id: subCategoryId,
      name: cat.name,
      mainCategory: 'expense',
      order: index,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    cat.details.forEach((detail, detailIndex) => {
      detailCategories.push({
        id: uuidv4(),
        name: detail,
        subCategoryId,
        order: detailIndex,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  // 수입 카테고리 생성
  incomeCategories.forEach((cat, index) => {
    const subCategoryId = uuidv4();
    subCategories.push({
      id: subCategoryId,
      name: cat.name,
      mainCategory: 'income',
      order: index,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    cat.details.forEach((detail, detailIndex) => {
      detailCategories.push({
        id: uuidv4(),
        name: detail,
        subCategoryId,
        order: detailIndex,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  return { subCategories, detailCategories };
};
