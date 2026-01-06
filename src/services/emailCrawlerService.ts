// 이메일 크롤링 서비스
// CORS 프록시를 통해 웹페이지에서 이메일 주소를 추출

import {
  getCrawlTargets,
  updateExtractStatus,
  saveToEmailDataSheet,
} from './publicDataService';

// CORS 프록시 서버 URL (환경변수 또는 기본값)
const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL || 'http://localhost:3001';
const LOCAL_PROXY = `${PROXY_SERVER_URL}/proxy?url=`;
const CORS_PROXIES = [
  LOCAL_PROXY, // 프록시 서버 (가장 안정적)
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];

// 이메일 정규식 패턴
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 제외할 이메일 패턴 (일반적인 시스템 이메일)
const EXCLUDED_PATTERNS = [
  /^admin@/i,
  /^webmaster@/i,
  /^postmaster@/i,
  /^hostmaster@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^info@example/i,
  /^test@/i,
  /^sample@/i,
  /@example\./i,
  /@test\./i,
  /@localhost/i,
  /\.png$/i,
  /\.jpg$/i,
  /\.gif$/i,
];

// 크롤링 진행 상태
export interface CrawlProgress {
  total: number;
  current: number;
  success: number;
  failed: number;
  currentTarget?: string;
  message?: string;
}

// 크롤링 결과
export interface CrawlResult {
  total: number;
  success: number;
  failed: number;
  emails: Array<{ name: string; email: string; category: string }>;
}

// 딜레이 함수
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// URL 정규화
function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // 프로토콜이 없으면 https 추가
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  // www 없으면 추가 시도
  try {
    const urlObj = new URL(normalized);
    return urlObj.href;
  } catch {
    return normalized;
  }
}

// 이메일 유효성 검사
function isValidEmail(email: string): boolean {
  // 기본 형식 검사
  if (!email || email.length > 254) return false;

  // 제외 패턴 검사
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(email)) return false;
  }

  // 이메일 도메인 검사 (실제 존재할 수 있는 TLD인지)
  const parts = email.split('@');
  if (parts.length !== 2) return false;

  const domain = parts[1];
  if (domain.length < 3 || !domain.includes('.')) return false;

  return true;
}

// 페이지에서 이메일 추출
function extractEmailsFromHtml(html: string): string[] {
  const emails: Set<string> = new Set();

  // mailto 링크에서 추출
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].toLowerCase();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }

  // 일반 텍스트에서 추출
  const textEmails = html.match(EMAIL_REGEX) || [];
  for (const email of textEmails) {
    const cleanEmail = email.toLowerCase();
    if (isValidEmail(cleanEmail)) {
      emails.add(cleanEmail);
    }
  }

  return Array.from(emails);
}

// 단일 URL에서 이메일 크롤링
async function crawlSingleUrl(url: string, abortSignal?: AbortSignal): Promise<string[]> {
  const normalizedUrl = normalizeUrl(url);

  // 중단 확인
  if (abortSignal?.aborted) {
    throw new Error('크롤링이 중단되었습니다.');
  }

  // 여러 프록시 시도
  for (const proxy of CORS_PROXIES) {
    // 중단 확인
    if (abortSignal?.aborted) {
      throw new Error('크롤링이 중단되었습니다.');
    }

    try {
      const proxyUrl = proxy + encodeURIComponent(normalizedUrl);

      // 타임아웃과 중단 신호 결합
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // 외부 중단 신호 연결
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(proxyUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const html = await response.text();

      // HTML이 너무 짧으면 실패로 간주
      if (html.length < 100) continue;

      const emails = extractEmailsFromHtml(html);

      // 이메일을 찾았으면 반환
      if (emails.length > 0) {
        return emails;
      }

      // 이메일이 없어도 HTML은 정상적으로 받았으므로 다른 프록시 시도할 필요 없음
      return [];
    } catch (error) {
      // 중단 요청인 경우 즉시 throw
      if (abortSignal?.aborted) {
        throw new Error('크롤링이 중단되었습니다.');
      }
      console.log(`[크롤링] 프록시 실패 (${proxy.slice(0, 30)}...): ${error}`);
      continue;
    }
  }

  // 모든 프록시 실패
  throw new Error('모든 프록시 접근 실패');
}

// 크롤링 실행
export async function runEmailCrawling(
  onProgress?: (progress: CrawlProgress) => void,
  maxTargets?: number,
  abortSignal?: AbortSignal,
  categoryFilter?: string | string[]
): Promise<CrawlResult> {
  // 크롤링 대상 조회 (카테고리 필터 적용)
  let targets = await getCrawlTargets(categoryFilter);

  // 최대 개수 제한
  if (maxTargets && maxTargets > 0) {
    targets = targets.slice(0, maxTargets);
  }

  const result: CrawlResult = {
    total: targets.length,
    success: 0,
    failed: 0,
    emails: [],
  };

  if (targets.length === 0) {
    onProgress?.({
      total: 0,
      current: 0,
      success: 0,
      failed: 0,
      message: '크롤링 대상이 없습니다.',
    });
    return result;
  }

  onProgress?.({
    total: targets.length,
    current: 0,
    success: 0,
    failed: 0,
    message: `크롤링 시작 (총 ${targets.length}개)`,
  });

  for (let i = 0; i < targets.length; i++) {
    // 중단 확인
    if (abortSignal?.aborted) {
      onProgress?.({
        total: result.total,
        current: i,
        success: result.success,
        failed: result.failed,
        message: `크롤링 중단됨 (성공: ${result.success}, 실패: ${result.failed})`,
      });
      return result;
    }

    const target = targets[i];

    onProgress?.({
      total: targets.length,
      current: i + 1,
      success: result.success,
      failed: result.failed,
      currentTarget: target.name,
      message: `${target.name} 크롤링 중... (${i + 1}/${targets.length})`,
    });

    try {
      const emails = await crawlSingleUrl(target.homepage, abortSignal);

      if (emails.length > 0) {
        // 첫 번째 이메일만 저장 (가장 신뢰도 높은 것)
        const email = emails[0];

        // 이메일데이터 시트에 저장
        await saveToEmailDataSheet(target.name, email, target.category);

        // 상태 업데이트
        await updateExtractStatus(target.rowIndex, 'Y');

        result.success++;
        result.emails.push({
          name: target.name,
          email,
          category: target.category,
        });

        console.log(`[크롤링 성공] ${target.name}: ${email}`);
      } else {
        // 이메일 없음
        await updateExtractStatus(target.rowIndex, 'F');
        result.failed++;
        console.log(`[크롤링 실패] ${target.name}: 이메일 없음`);
      }
    } catch (error) {
      // 중단 요청인 경우 종료
      if (abortSignal?.aborted) {
        onProgress?.({
          total: result.total,
          current: i,
          success: result.success,
          failed: result.failed,
          message: `크롤링 중단됨 (성공: ${result.success}, 실패: ${result.failed})`,
        });
        return result;
      }

      // 크롤링 오류
      await updateExtractStatus(target.rowIndex, 'F');
      result.failed++;
      console.log(`[크롤링 오류] ${target.name}: ${error}`);
    }

    // API 제한 방지 딜레이
    await delay(1000);
  }

  onProgress?.({
    total: result.total,
    current: result.total,
    success: result.success,
    failed: result.failed,
    message: `크롤링 완료 (성공: ${result.success}, 실패: ${result.failed})`,
  });

  return result;
}

// 실패한 대상만 재시도
export async function retryCrawling(
  onProgress?: (progress: CrawlProgress) => void
): Promise<CrawlResult> {
  // 실패한 대상 조회를 위해 getCrawlTargets를 수정해야 하지만,
  // 현재는 상태가 'F'인 것들을 직접 조회하는 방식으로 구현
  // TODO: 별도의 getFailedTargets 함수 구현

  return runEmailCrawling(onProgress);
}
