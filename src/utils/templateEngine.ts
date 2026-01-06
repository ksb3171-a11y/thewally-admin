import type { TemplateVariables, EmailTemplate, ContactCategory, SeasonTag } from '../types/b2b';
import emailTemplatesData from '../data/emailTemplates.json';

// 템플릿 변수 치환 함수
export const replaceVariables = (
  template: string,
  variables: TemplateVariables
): string => {
  let result = template;

  // {{변수명}} 패턴을 찾아서 치환
  Object.entries(variables).forEach(([key, value]) => {
    if (value !== undefined) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
  });

  // 치환되지 않은 변수는 빈 문자열로 대체
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
};

// 제목과 본문 함께 치환
export const generateEmail = (
  template: EmailTemplate,
  variables: TemplateVariables
): { subject: string; body: string } => {
  return {
    subject: replaceVariables(template.subject, variables),
    body: replaceVariables(template.body, variables),
  };
};

// 모든 템플릿 가져오기
export const getAllTemplates = (): EmailTemplate[] => {
  return emailTemplatesData.templates as EmailTemplate[];
};

// 조건에 맞는 템플릿 찾기
export const findTemplatesByCondition = (
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

// ID로 템플릿 찾기
export const getTemplateById = (id: string): EmailTemplate | undefined => {
  return getAllTemplates().find((t) => t.id === id);
};

// 템플릿에서 사용되는 변수 추출
export const extractVariables = (template: EmailTemplate): string[] => {
  const combined = template.subject + template.body;
  const matches = combined.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];

  const variables = matches.map((match) => match.replace(/\{\{|\}\}/g, ''));
  return [...new Set(variables)]; // 중복 제거
};

// 기본 변수 값 생성
export const createDefaultVariables = (
  name?: string,
  category?: ContactCategory,
  season?: SeasonTag
): TemplateVariables => {
  return {
    단체명: name || '',
    분류: category || '',
    시즌: season || '',
    상품1: '',
    가격1: '',
    할인율: '10%',
  };
};

// 이메일 본문을 HTML로 변환 (줄바꿈 처리)
export const convertToHtml = (text: string): string => {
  return text
    .replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
};

// 이메일을 클립보드에 복사하기 위한 텍스트 생성
export const formatForClipboard = (subject: string, body: string): string => {
  return `제목: ${subject}\n\n${body}`;
};
