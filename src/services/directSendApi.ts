/**
 * 다이렉트센드 API 연동 서비스
 *
 * 다이렉트센드(DirectSend)는 대량 이메일/문자 발송 서비스입니다.
 * API 문서: https://directsend.co.kr/index.php/customer/manual
 *
 * 주요 기능:
 * - 대량 이메일 발송
 * - 치환 문자 기능 (수신자별 개인화)
 * - 예약 발송
 * - 수신거부 관리
 */

// API Base URL (개발: 상대경로로 vite proxy 사용, 배포: 환경변수 사용)
const getApiBaseUrl = () => {
  // 배포 환경에서는 환경변수에서 프록시 서버 URL 가져옴
  const proxyUrl = import.meta.env.VITE_PROXY_SERVER_URL;
  // 개발 환경(localhost)이면 상대경로 사용, 아니면 프록시 서버 URL 사용
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '';  // 상대경로 (vite proxy 사용)
  }
  return proxyUrl || '';
};

// API 설정 타입
export interface DirectSendConfig {
  userId: string;      // 다이렉트센드 아이디
  apiKey: string;      // API 인증키
}

// 수신자 정보 타입
export interface EmailRecipient {
  email: string;
  name?: string;
  replace?: Record<string, string>; // 치환 변수 (예: { "$$이름$$": "홍길동" })
}

// 이메일 발송 요청 타입
export interface SendEmailRequest {
  subject: string;              // 메일 제목
  body: string;                 // HTML 본문
  sender: string;               // 발신자 이메일
  senderName: string;           // 발신자 이름
  recipients: EmailRecipient[]; // 수신자 목록
  replyTo?: string;            // 회신 주소
  reserveDate?: string;        // 예약 발송 시간 (YYYY-MM-DD HH:mm)
}

// API 응답 타입
export interface DirectSendResponse {
  status: number;     // 0: 성공, 기타: 오류
  msg: string;        // 결과 메시지
  ref_key?: string;   // 발송 참조키 (추적용)
}

// 잔액 조회 응답 타입
export interface BalanceResponse {
  status: number;
  balance?: number;   // 잔액 (원)
  msg?: string;
}

// 발송 결과 항목 타입
export interface SendResultItem {
  seq?: string;         // 발송 고유번호
  subject?: string;     // 메일 제목
  send_date?: string;   // 발송일시
  total_cnt?: number;   // 총 발송수
  success_cnt?: number; // 성공 수
  fail_cnt?: number;    // 실패 수
  open_cnt?: number;    // 오픈 수 (메일 열람)
  click_cnt?: number;   // 클릭 수
  status?: string;      // 발송 상태
}

// 발송 결과 조회 응답 타입
export interface SendResultResponse {
  status: number;
  msg?: string;
  total?: number;       // 전체 건수
  list?: SendResultItem[];  // 발송 결과 목록
}

// LocalStorage 키
const DIRECTSEND_CONFIG_KEY = 'directsend_config';

/**
 * 다이렉트센드 설정 저장
 */
export const saveDirectSendConfig = (config: DirectSendConfig): void => {
  localStorage.setItem(DIRECTSEND_CONFIG_KEY, JSON.stringify(config));
};

/**
 * 다이렉트센드 설정 로드
 */
export const loadDirectSendConfig = (): DirectSendConfig | null => {
  const stored = localStorage.getItem(DIRECTSEND_CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * 다이렉트센드 API가 설정되었는지 확인
 */
export const isDirectSendConfigured = (): boolean => {
  const config = loadDirectSendConfig();
  return !!(config?.userId && config?.apiKey);
};

/**
 * 다이렉트센드 이메일 발송
 *
 * 서버 프록시를 통해 API 호출 (CORS 우회)
 */
export const sendEmail = async (request: SendEmailRequest): Promise<DirectSendResponse> => {
  const config = loadDirectSendConfig();

  if (!config) {
    throw new Error('다이렉트센드 API 설정이 필요합니다.');
  }

  // 서버를 통해 API 호출 (CORS 우회)
  const response = await fetch(`${getApiBaseUrl()}/api/directsend/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...request,
      userId: config.userId,
      apiKey: config.apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  return response.json();
};

/**
 * 발송 예약 (미래 시간에 발송)
 */
export const sendScheduledEmail = async (
  request: SendEmailRequest,
  scheduleDate: Date
): Promise<DirectSendResponse> => {
  const formattedDate = formatScheduleDate(scheduleDate);
  return sendEmail({
    ...request,
    reserveDate: formattedDate,
  });
};

/**
 * 테스트 발송 (단일 수신자)
 */
export const sendTestEmail = async (
  request: Omit<SendEmailRequest, 'recipients'>,
  testEmail: string
): Promise<DirectSendResponse> => {
  return sendEmail({
    ...request,
    recipients: [{ email: testEmail, name: '테스트' }],
  });
};

/**
 * 발송 상태 조회
 */
export const checkSendStatus = async (refKey: string): Promise<DirectSendResponse> => {
  const config = loadDirectSendConfig();

  if (!config) {
    throw new Error('다이렉트센드 API 설정이 필요합니다.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/directsend/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: config.userId,
      apiKey: config.apiKey,
      refKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  return response.json();
};

/**
 * 예약 발송 날짜 포맷팅
 */
const formatScheduleDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * 수신자 목록 검증
 */
export const validateRecipients = (recipients: EmailRecipient[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  recipients.forEach((recipient, index) => {
    if (!emailRegex.test(recipient.email)) {
      errors.push(`${index + 1}번 수신자 이메일 형식 오류: ${recipient.email}`);
    }
  });

  if (recipients.length === 0) {
    errors.push('수신자가 없습니다.');
  }

  if (recipients.length > 1000) {
    errors.push('한 번에 1000명까지만 발송 가능합니다.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * 발송 결과 에러 메시지 해석
 */
export const getErrorMessage = (status: number): string => {
  const errorMessages: Record<number, string> = {
    0: '발송 성공',
    1: '필수 파라미터 누락',
    2: '인증 실패 (아이디/API키 확인)',
    3: '발신자 정보 오류',
    4: '수신자 정보 오류',
    5: '제목 또는 본문 오류',
    6: '잔액 부족',
    7: '발송 수량 초과',
    8: '예약 시간 오류',
    9: '시스템 오류',
    10: '중복 발송 방지',
  };

  return errorMessages[status] || `알 수 없는 오류 (코드: ${status})`;
};

/**
 * 발송 비용 계산 (대략적인 추정)
 * 실제 비용은 다이렉트센드 요금제에 따라 다름
 */
export const estimateCost = (recipientCount: number): { min: number; max: number } => {
  // 건당 약 5~15원 (요금제에 따라 다름)
  return {
    min: recipientCount * 5,
    max: recipientCount * 15,
  };
};

/**
 * 잔액(포인트) 조회
 */
export const getBalance = async (): Promise<BalanceResponse> => {
  const config = loadDirectSendConfig();

  if (!config) {
    throw new Error('다이렉트센드 API 설정이 필요합니다.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/directsend/balance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: config.userId,
      apiKey: config.apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  return response.json();
};

/**
 * 발송 결과 조회
 * @param type - 발송 유형 (mail, sms, kakao)
 * @param page - 페이지 번호
 * @param limit - 페이지당 항목 수
 */
export const getSendResults = async (
  type: 'mail' | 'sms' | 'kakao' = 'mail',
  page: number = 1,
  limit: number = 20
): Promise<SendResultResponse> => {
  const config = loadDirectSendConfig();

  if (!config) {
    throw new Error('다이렉트센드 API 설정이 필요합니다.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/directsend/result`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: config.userId,
      apiKey: config.apiKey,
      type,
      page,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  return response.json();
};

/**
 * 연결 테스트 (잔액 조회로 확인)
 */
export const testConnection = async (): Promise<{ success: boolean; balance?: number; message: string }> => {
  try {
    const result = await getBalance();
    if (result.status === 0 && result.balance !== undefined) {
      return {
        success: true,
        balance: result.balance,
        message: `연결 성공 (잔액: ${result.balance.toLocaleString()}원)`,
      };
    }
    return {
      success: false,
      message: result.msg || '연결 실패',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '연결 실패',
    };
  }
};
