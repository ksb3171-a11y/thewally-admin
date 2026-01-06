import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API 키 (환경변수에서 가져옴)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Gemini 모델 초기화
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!API_KEY) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일에 VITE_GEMINI_API_KEY를 설정해주세요.');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

// 상품 정보 타입
export interface ProductForEmail {
  name: string;
  price: number;
  salePrice?: number;
  imageUrl: string;
  category: string;
  url: string;
}

// 회사 정보 타입
export interface CompanyInfo {
  companyName: string;       // 상호명
  ceoName: string;           // 대표자명
  address: string;           // 사업장 주소
  phone: string;             // 전화번호
  email: string;             // 이메일
  businessNumber: string;    // 사업자등록번호
  unsubscribeUrl?: string;   // 수신거부 링크
  kakaoChannelUrl?: string;  // 카카오톡 채널 링크
}

// 기본 회사 정보
export const defaultCompanyInfo: CompanyInfo = {
  companyName: '체리테일',
  ceoName: '김민경',
  address: '서울특별시 송파구 오금로19길 12-10 2층',
  phone: '02-416-8484',
  email: 'cheritale25@naver.com',
  businessNumber: '260-17-01766',
  unsubscribeUrl: 'https://re365-unsubscribe-server.onrender.com',
  kakaoChannelUrl: 'http://pf.kakao.com/_xdbxoDn/chat',
};

// 행사/시즌 상세 프로필 타입
export interface EventProfileForEmail {
  type?: string;             // 행사 유형 (academic, celebration, seasonal, retreat, religious 등)
  mood?: string;             // 분위기 (festive, professional, warm, energetic, solemn, spiritual 등)
  giftPurpose?: string;      // 선물 목적 (souvenir, prize, appreciation, practical, commemoration 등)
  description?: string;      // 행사 설명
  duration?: string;         // 기간 (short, day, overnight, multi-day)
  location?: string;         // 장소 (indoor, outdoor, mixed)
  season?: string;           // 계절 (spring, summer, fall, winter, any)
  participants?: string;     // 참여자 (children, youth, adults, seniors, family, mixed)
  activities?: string[];     // 주요 활동
  essentialItems?: string[]; // 필수 준비물/기념품 키워드
}

// 이메일 생성 요청 타입
export interface EmailGenerationRequest {
  category: string;          // 타겟 분류 (어린이집, 유치원, 회사 등)
  season: string;            // 시즌/이벤트 (입학, 졸업, 체육대회 등)
  products: ProductForEmail[]; // 추천 상품 목록
  companyInfo: CompanyInfo;  // 회사 정보
  eventProfile?: EventProfileForEmail; // 행사/시즌 상세 프로필
}

// 이메일 생성 결과 타입
export interface GeneratedEmail {
  subject: string;
  htmlBody: string;
  textBody: string;
}

// 토큰 사용량 타입
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  estimatedCostKRW: number;
}

// 이메일 생성 결과 (토큰 사용량 포함)
export interface GeneratedEmailWithUsage extends GeneratedEmail {
  tokenUsage?: TokenUsage;
}

// 누적 토큰 사용량 저장 키
const TOKEN_USAGE_KEY = 'gemini_token_usage';

// 누적 사용량 타입
export interface CumulativeTokenUsage {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUSD: number;
  totalCostKRW: number;
  requestCount: number;
  lastUpdated: string;
}

// 비용 계산 (gemini-2.0-flash 기준)
function calculateCost(promptTokens: number, completionTokens: number): { usd: number; krw: number } {
  // gemini-2.0-flash 가격: 입력 $0.10/1M, 출력 $0.40/1M
  const inputCostPer1M = 0.10;
  const outputCostPer1M = 0.40;
  const usdToKrw = 1450; // 대략적인 환율

  const usd = (promptTokens / 1_000_000) * inputCostPer1M + (completionTokens / 1_000_000) * outputCostPer1M;
  const krw = usd * usdToKrw;

  return { usd, krw };
}

// 누적 사용량 로드
export function loadCumulativeUsage(): CumulativeTokenUsage {
  const stored = localStorage.getItem(TOKEN_USAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as CumulativeTokenUsage;
    } catch {
      // 파싱 실패 시 초기값 반환
    }
  }
  return {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUSD: 0,
    totalCostKRW: 0,
    requestCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}

// 누적 사용량 저장
function saveCumulativeUsage(usage: CumulativeTokenUsage): void {
  localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(usage));
}

// 누적 사용량에 추가
function addToUsage(tokenUsage: TokenUsage): void {
  const cumulative = loadCumulativeUsage();
  cumulative.totalPromptTokens += tokenUsage.promptTokens;
  cumulative.totalCompletionTokens += tokenUsage.completionTokens;
  cumulative.totalTokens += tokenUsage.totalTokens;
  cumulative.totalCostUSD += tokenUsage.estimatedCostUSD;
  cumulative.totalCostKRW += tokenUsage.estimatedCostKRW;
  cumulative.requestCount += 1;
  cumulative.lastUpdated = new Date().toISOString();
  saveCumulativeUsage(cumulative);
}

// 누적 사용량 초기화
export function resetCumulativeUsage(): void {
  localStorage.removeItem(TOKEN_USAGE_KEY);
}

// 시즌별 인사말 컨텍스트
const seasonGreetingContext: Record<string, string> = {
  // 학교/기업 공통
  '입학': '새로운 시작을 축하하며, 설레는 첫걸음을 응원하는 마음을 담아',
  '졸업': '그동안의 노력과 성장을 축하하며, 새로운 여정을 응원하는 마음을 담아',
  '신년': '새해 복 많이 받으시길 바라며, 희망찬 새해를 맞이하는 기쁨을 함께 나누고자',
  '크리스마스': '따뜻한 연말을 보내시길 바라며, 감사와 사랑의 마음을 전하고자',
  '어린이날': '소중한 아이들의 행복한 하루를 위해, 밝은 미소가 가득한 날이 되길 바라며',
  '스승의날': '존경하는 선생님들께 감사의 마음을 전하며, 헌신에 보답하는 마음을 담아',
  '체육대회': '열정 가득한 체육대회의 성공을 응원하며, 함께하는 즐거움을 더하고자',
  '수학여행': '소중한 추억을 만들어갈 특별한 여행을 응원하며, 잊지 못할 순간들을 위해',
  '축제': '함께 즐기는 축제의 기쁨을 더하고자, 특별한 순간을 빛내줄 아이템을 준비했습니다',
  '창립기념일': '뜻깊은 창립기념일을 축하하며, 함께 성장해온 시간에 감사드리며',
  '송년회': '한 해를 마무리하며 수고하신 모든 분들께 감사의 마음을 전하고자',
  // 교회 시즌
  '신년감사예배': '새해 첫 예배의 은혜 가운데, 감사와 기쁨의 마음을 나누고자',
  '겨울수련회': '은혜로운 수련회를 통해 영적 성장을 이루시길 바라며, 따뜻한 교제의 시간을 응원합니다',
  '새학기/주일학교': '새학기를 맞이하는 주일학교 아이들에게 기쁨과 축복이 가득하길 바라며',
  '부활절': '부활의 기쁨과 소망을 나누며, 새 생명의 축복이 함께하길 기원합니다',
  '어버이날': '부모님의 사랑과 헌신에 감사드리며, 효도의 마음을 전하고자',
  '어린이주일': '하나님의 사랑 안에서 자라나는 소중한 아이들을 축복하며',
  '맥추감사절': '첫 수확의 기쁨과 감사를 나누며, 하나님의 은혜에 감사드립니다',
  '여름수련회': '뜨거운 여름, 더욱 뜨거운 신앙의 열정으로 은혜로운 수련회가 되길 바라며',
  '여름성경학교': '신나는 여름성경학교에서 아이들이 하나님의 말씀을 즐겁게 배우길 기원하며',
  '추석': '풍성한 한가위 명절에 가족과 함께 감사와 기쁨이 넘치길 바라며',
  '종교개혁기념주일': '개혁의 정신을 되새기며, 믿음의 선배들의 발자취를 기억합니다',
  '추수감사절': '한 해의 풍성한 열매에 감사드리며, 나눔의 기쁨을 함께합니다',
  '성탄절': '구주 탄생의 기쁨과 평화가 가득하길 바라며, 사랑의 마음을 전합니다',
};

// 분류별 인사말 컨텍스트
const categoryGreetingContext: Record<string, string> = {
  '어린이집': '소중한 우리 아이들의 행복한 성장을 함께하는',
  '유치원': '밝고 건강하게 자라나는 아이들을 위해 정성껏 준비한',
  '초등학교': '꿈을 키워가는 학생들의 즐거운 학교생활을 응원하며',
  '중학교': '새로운 도전을 시작하는 학생들의 밝은 미래를 응원하며',
  '고등학교': '열정 가득한 청소년들의 빛나는 내일을 위해',
  '대학교': '무한한 가능성을 품은 대학생들의 캠퍼스 라이프를 응원하며',
  '회사': '함께 성장하는 소중한 파트너사에 감사드리며',
  '교회': '사랑과 나눔을 실천하는 공동체에 정성을 담아',
  '병원': '건강과 치유의 공간에서 수고하시는 분들께 감사드리며',
  '스포츠팀': '열정과 도전으로 승리를 향해 나아가는 팀을 응원하며',
};

// 행사 유형 한글 변환
const eventTypeLabels: Record<string, string> = {
  'academic': '학술/교육 행사',
  'celebration': '축하/기념 행사',
  'seasonal': '시즌/절기 행사',
  'corporate': '기업/단체 행사',
  'sports': '스포츠/체육 행사',
  'memorial': '기념/추모 행사',
  'retreat': '수련회/캠프',
  'religious': '종교/예배 행사',
};

// 분위기 한글 변환
const moodLabels: Record<string, string> = {
  'festive': '축제적이고 즐거운',
  'professional': '전문적이고 격식 있는',
  'warm': '따뜻하고 감성적인',
  'energetic': '활동적이고 역동적인',
  'solemn': '엄숙하고 경건한',
  'spiritual': '영적이고 은혜로운',
};

// 선물 목적 한글 변환
const giftPurposeLabels: Record<string, string> = {
  'souvenir': '기념품/추억의 선물',
  'prize': '상품/경품',
  'appreciation': '감사/사례의 선물',
  'promotion': '홍보/마케팅 용품',
  'commemoration': '기념/축하 선물',
  'practical': '실용적인 필수품',
};

// 기간 한글 변환
const durationLabels: Record<string, string> = {
  'short': '단시간 (예배/행사 중심)',
  'day': '하루 종일',
  'overnight': '1박2일',
  'multi-day': '2박3일 이상',
};

// 장소 한글 변환
const locationLabels: Record<string, string> = {
  'indoor': '실내',
  'outdoor': '야외',
  'mixed': '실내+야외 혼합',
};

// 참여자 한글 변환
const participantLabels: Record<string, string> = {
  'children': '어린이',
  'youth': '청소년/청년',
  'adults': '성인',
  'seniors': '어르신',
  'family': '가족',
  'mixed': '전 연령',
};

// 이메일 생성 프롬프트 구성
function buildEmailPrompt(request: EmailGenerationRequest): string {
  const { category, season, products, companyInfo, eventProfile } = request;

  // 상품 정보를 텍스트로 변환 (더 자세한 정보 포함)
  const productsText = products.map((p, i) => {
    const discountRate = p.salePrice && p.salePrice < p.price
      ? Math.round((1 - p.salePrice / p.price) * 100)
      : 0;
    return `상품 ${i + 1}:
- 상품명: ${p.name}
- 정가: ${p.price.toLocaleString()}원
- 판매가: ${(p.salePrice || p.price).toLocaleString()}원${discountRate > 0 ? ` (${discountRate}% 할인)` : ''}
- 카테고리: ${p.category}
- 이미지 URL: ${p.imageUrl}
- 상품 URL: ${p.url}`;
  }).join('\n\n');

  // 시즌/분류별 컨텍스트 가져오기
  const seasonContext = seasonGreetingContext[season] || '특별한 시간을 더욱 의미있게 만들어드리고자';
  const categoryContext = categoryGreetingContext[category] || '소중한 단체 고객님께 정성을 담아';

  // 현재 날짜와 계절 정보
  const now = new Date();
  const month = now.getMonth() + 1; // 0-11 -> 1-12
  const day = now.getDate();

  // 계절 및 날씨 컨텍스트 생성
  const getSeasonAndWeather = (month: number): string => {
    if (month >= 3 && month <= 5) {
      if (month === 3) return '초봄 (3월) - 아직 쌀쌀한 날씨가 이어지고 있으며, 꽃샘추위가 찾아오는 시기입니다.';
      if (month === 4) return '봄 (4월) - 벚꽃이 피고 따스한 봄 햇살이 내리쬐는 시기입니다. 일교차가 큰 편입니다.';
      return '늦봄 (5월) - 화창하고 따뜻한 날씨가 계속되며, 야외 활동하기 좋은 계절입니다.';
    } else if (month >= 6 && month <= 8) {
      if (month === 6) return '초여름 (6월) - 장마가 시작되는 시기로 습하고 비가 자주 내립니다.';
      if (month === 7) return '한여름 (7월) - 장마와 무더위가 번갈아 찾아오며, 매우 덥고 습한 날씨입니다.';
      return '늦여름 (8월) - 폭염이 계속되는 가장 더운 시기입니다. 열대야도 이어집니다.';
    } else if (month >= 9 && month <= 11) {
      if (month === 9) return '초가을 (9월) - 아침저녁으로 선선해지며, 쾌청한 날씨가 이어지는 시기입니다.';
      if (month === 10) return '가을 (10월) - 단풍이 물들고 청명한 가을 하늘이 펼쳐지는 시기입니다.';
      return '늦가을 (11월) - 쌀쌀한 바람이 불고 겨울이 다가오는 것을 느낄 수 있습니다.';
    } else {
      if (month === 12) return '초겨울 (12월) - 첫눈이 내리고 매서운 한파가 찾아오는 시기입니다.';
      if (month === 1) return '한겨울 (1월) - 연중 가장 추운 시기로, 영하의 날씨와 한파가 계속됩니다.';
      return '늦겨울 (2월) - 아직 추위가 남아있지만, 봄이 조금씩 다가오는 것을 느낄 수 있습니다.';
    }
  };

  const seasonAndWeather = getSeasonAndWeather(month);

  return `당신은 B2B 마케팅 이메일을 작성하는 전문 카피라이터입니다.
감성적이면서도 신뢰감을 주는 톤으로 한국어 마케팅 이메일을 작성해주세요.

## 현재 날짜 및 계절 정보 (인사말 작성 시 반드시 반영!)
- 오늘 날짜: ${now.getFullYear()}년 ${month}월 ${day}일
- 계절 및 날씨: ${seasonAndWeather}
- **인사말에 현재 계절과 날씨를 자연스럽게 반영해주세요!**
- 예시 (1월): "추운 겨울, 건강 유의하시길 바랍니다", "한파가 매서운 요즘", "눈 내리는 겨울"
- 예시 (7월): "무더운 여름 건강 조심하세요", "장마철 습한 날씨에", "폭염이 계속되는 요즘"

## 대상 정보
- 수신자 분류: ${category || '단체 고객'}
- 시즌/이벤트: ${season || '특별 프로모션'}
- 시즌 컨텍스트: ${seasonContext}
- 분류 컨텍스트: ${categoryContext}
${eventProfile ? `
## ★★★ 행사/시즌 상세 분석 (이메일 작성 시 반드시 반영!) ★★★
이 정보를 바탕으로 행사의 성격과 분위기에 맞는 제목/본문을 작성하세요!

- 행사 유형: ${eventProfile.type ? eventTypeLabels[eventProfile.type] || eventProfile.type : '일반 행사'}
- 행사 분위기: ${eventProfile.mood ? moodLabels[eventProfile.mood] || eventProfile.mood : '일반적'}
- 선물 목적: ${eventProfile.giftPurpose ? giftPurposeLabels[eventProfile.giftPurpose] || eventProfile.giftPurpose : '일반 선물'}
${eventProfile.description ? `- 행사 설명: ${eventProfile.description}` : ''}
${eventProfile.duration ? `- 행사 기간: ${durationLabels[eventProfile.duration] || eventProfile.duration}` : ''}
${eventProfile.location ? `- 진행 장소: ${locationLabels[eventProfile.location] || eventProfile.location}` : ''}
${eventProfile.participants ? `- 주요 참여자: ${participantLabels[eventProfile.participants] || eventProfile.participants}` : ''}
${eventProfile.activities && eventProfile.activities.length > 0 ? `- 주요 활동: ${eventProfile.activities.join(', ')}` : ''}
${eventProfile.essentialItems && eventProfile.essentialItems.length > 0 ? `- 필수 준비물/인기 기념품: ${eventProfile.essentialItems.join(', ')}` : ''}

### 행사 분석을 반영한 작성 가이드:
1. **제목**: 행사의 핵심 활동과 필수 준비물을 언급하여 담당자의 공감을 유도
2. **인사말**: 행사의 분위기(${eventProfile.mood ? moodLabels[eventProfile.mood] : '일반적'})에 맞는 톤으로 작성
3. **상품 소개**: 행사 중 어떤 상황에서 사용될 수 있는지 구체적으로 설명
4. **필수 준비물 강조**: ${eventProfile.essentialItems && eventProfile.essentialItems.length > 0 ? `특히 ${eventProfile.essentialItems.slice(0, 3).join(', ')} 등은 꼭 챙겨야 할 품목으로 소구` : '행사에 필요한 실용적 가치 강조'}
` : ''}

## 추천 상품 목록
${productsText}

## 회사 정보
- 상호: ${companyInfo.companyName}
- 대표자: ${companyInfo.ceoName}
- 주소: ${companyInfo.address}
- 전화번호: ${companyInfo.phone}
- 이메일: ${companyInfo.email}
- 사업자등록번호: ${companyInfo.businessNumber}

## 작성 요구사항

### ★★★ 절대 금지 사항 ★★★
**이모티콘/이모지 사용 절대 금지!**
- 제목, 본문, 상품 소개글 어디에도 이모티콘(😀, ✨, 🎉, 👍 등)을 사용하지 마세요
- 특수문자 이모지(☔, ✔ 등)도 사용 금지
- 텍스트로만 표현하세요

### 1. 이메일 제목 (필수: 광고 표시) ★★★ 가장 중요 ★★★

**핵심 원칙: (광고)는 법적 표시이고, 클릭을 만드는 건 '뒤 문장'이다!**

- **반드시 "(광고)"로 시작**: 정보통신망법에 따라 필수
- 제목 전체 50자 이내
- **(광고) 뒤에서 "이 메일이 나랑 무슨 상관인지"를 1초 안에 알려줘야 함!**

**★ 절대 열리는 제목 공식 (5가지 중 택1) ★**

**공식 1) 문제 해결형 (B2B에서 가장 강함)** - 받는 사람이 이미 겪는 고민을 찌르기
- (광고) 단체 굿즈 주문, 왜 항상 일정이 꼬일까?
- (광고) 단체 티셔츠 제작할 때 가장 많이 실패하는 3가지
- (광고) ${category} ${season} 준비, 담당자가 가장 고민하는 것

**공식 2) 가이드·정리형 (신뢰도 최고)** - 판매 메일이 아닌 업무 참고 자료처럼 보이게
- (광고) 단체 주문 제작 가이드│수량·로고·납기 한 번에 정리
- (광고) 처음 ${season} 굿즈 제작하는 분들을 위한 체크리스트
- (광고) ${category} 단체 주문, 이것만 알면 실패 없습니다

**공식 3) 사례 공개형 (의심을 낮춤)** - 다른 곳 이야기라서 부담 적음
- (광고) 실제 단체 주문 제작 사례│어떻게 진행됐을까?
- (광고) ${category} 단체 굿즈, 이런 구성으로 많이 선택합니다
- (광고) 예산 1인당 2만원으로 구성한 ${season} 선물 사례

**공식 4) 손해 회피형 (강력하지만 과하지 않게)** - 사람은 이득보다 손해를 더 크게 느낌
- (광고) 단체 굿즈 제작 전, 이걸 모르고 시작하면 손해입니다
- (광고) ${season} 주문 제작, 견적 전에 꼭 확인해야 할 것
- (광고) 급하게 맡겼다가 다시 제작하는 이유

**공식 5) 선택 부담 감소형 (담당자 심리 정확히 찌름)** - B2B 담당자는 결정 피로가 큼
- (광고) 단체 굿즈, 고민 없이 선택하는 방법
- (광고) ${category} ${season} 준비, 어디까지 맡기면 될까요?
- (광고) 디자인부터 제작까지 한 번에 해결하는 방법

**❌ 절대 피해야 할 제목 유형 (열림률 박살)**
- (광고) 커스텀 굿즈 전문업체 OOO입니다 ← 우리 얘기
- (광고) 고퀄리티 굿즈 제작 가능합니다 ← 자랑
- (광고) 합리적인 가격으로 제작해드립니다 ← 뻔함
→ 전부 '내가 하고 싶은 말'이지, 상대 입장이 아님!

**핵심 요약:**
- (광고)는 방어
- 제목 뒤 문장은 공감 + 문제 해결
- 우리 말 X / 상대 머릿속 말 O
- ${category}와 ${season}을 자연스럽게 녹여서 작성

### 2. 헤더 섹션 (간결하고 임팩트 있게)
- 회사명이나 브랜드명 대신, ${season}과 ${category}에 맞는 임팩트 있는 짧은 카피 사용
- 예시: "새 학기, 특별한 시작", "함께하는 졸업의 기쁨", "체육대회 필수템"
- 서브 카피: 1줄로 혜택이나 메시지 전달

### 3. 인사말 섹션 (풍부하고 진정성 있게, 왼쪽 정렬)
- 3~4문장으로 구성된 감성적이고 진정성 있는 인사말
- **중요: 텍스트는 반드시 왼쪽 정렬 (text-align: left)**
- ${category} 담당자님께 직접 말하는 듯한 친근한 톤
- ${season}의 의미와 중요성을 강조
- 회사(${companyInfo.companyName})의 진심을 담은 메시지
- 받는 분이 특별하다고 느낄 수 있도록 작성
- 예시 구조:
  1) 시즌에 맞는 따뜻한 인사로 시작
  2) 수신자(${category})에 대한 이해와 공감 표현
  3) 이번 제안의 의미와 목적 설명
  4) 함께하고 싶은 마음 전달

### 4. 상품 소개 섹션 (★★★ 가장 중요 ★★★)

**필수 사항:**
1. **제공된 모든 상품을 빠짐없이 포함** (${products.length}개 상품 모두!)
2. 각 상품마다 반드시 **상품명**, **가격**, **소개글**, **상품 상세보기 링크** 포함
3. 테이블 기반 가로 레이아웃 (이미지 왼쪽 120px, 정보 오른쪽)

**각 상품 카드 필수 요소:**
- **상품명** (h4 태그, 굵게, 반드시 포함!)
- **가격 정보** (정가, 할인가 있으면 할인율 표시)
- **상품 소개글** (2~3문장, ${category}와 ${season}에 맞게 작성, 이모티콘 금지)
- **상품 상세보기 링크** (target="_blank" 필수)

**상품별 카드 HTML (각 상품마다 이 형식 반복!):**
\`\`\`html
<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; margin-bottom: 15px;">
  <tr>
    <td width="120" style="padding: 15px; vertical-align: top;">
      <img src="상품이미지URL" width="120" height="120" style="display: block;" />
    </td>
    <td style="padding: 15px; vertical-align: top;">
      <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: #333333;">상품명 여기에!</p>
      <p style="margin: 0 0 5px 0; font-size: 14px; color: #71717a;">정가: 00,000원</p>
      <p style="margin: 8px 0; font-size: 13px; color: #666666; line-height: 1.5;">상품 소개글 2~3문장</p>
      <a href="상품URL" target="_blank" style="color: #3B82F6; text-decoration: none; font-weight: bold;">상품 상세보기</a>
    </td>
  </tr>
</table>
\`\`\`

**상품 소개글 작성 가이드:**
- 이모티콘 절대 사용 금지!
- ${category}와 ${season}에 맞는 맞춤형 소구점 작성
- 예시: "워크샵의 소중한 순간을 기록하세요. 우리만의 디자인으로 특별함을 더합니다."

### 5. 단체 주문 혜택 안내 (중앙 정렬)
**중요: 이 섹션은 전체 중앙 정렬 (text-align: center)**
- 50개 이상: 5% 추가 할인
- 100개 이상: 10% 추가 할인 + 무료 배송
- 로고/이름 인쇄 서비스 가능 (맞춤 제작)
- 견적 문의 환영

### 6. CTA (Call to Action) - 버튼 2개 필수!
- 첫 번째 버튼: "카톡채널상담" - <a href="${companyInfo.kakaoChannelUrl || 'http://pf.kakao.com/_xdbxoDn/chat'}">카톡채널상담</a> (카카오톡 채널 연결)
- 두 번째 버튼: "Re:365 더 많은 상품보기" - <a href="https://r365.kr">Re:365 더 많은 상품보기</a> (자사몰 링크)
- 두 버튼을 나란히 배치하거나 세로로 배치
- 연락처 정보 명시

### 7. 정보통신망법 준수 사항 (필수)
이메일 하단에 다음 정보 포함:
- 발신자 정보 (회사명, 전화번호, 이메일)
- 사업자 정보 (사업자등록번호, 주소)
- 수신거부 안내: "본 메일은 (오늘 날짜) 기준 수신 동의하신 분들에게 발송됩니다. 수신을 원치 않으시면 <a href="${companyInfo.unsubscribeUrl || 'https://re365-unsubscribe-server.onrender.com'}/unsubscribe?email=$$email$$&name=$$name$$">여기를 클릭</a>해 주세요." (오늘 날짜는 YYYY년 M월 D일 형식으로 자동 생성, $$email$$과 $$name$$은 그대로 유지 - 발송 시 자동 치환됨)

## HTML 스타일 가이드 (이메일 클라이언트 호환성 필수!)

### ★★★ 중요: 이메일 HTML 규칙 ★★★
네이버, 다음, Gmail 등 모든 이메일 클라이언트에서 제대로 표시되려면 다음 규칙을 반드시 따르세요:

1. **<style> 태그 사용 금지** - 모든 스타일은 인라인(style 속성)으로 작성
2. **display: flex 사용 금지** - 테이블(table) 레이아웃 사용

### ★★★ 절대 중요: 헤더와 본문 분리 ★★★
**헤더(파란색 배경)와 인사말(흰색 배경)은 반드시 별도의 <tr> 태그로 분리해야 합니다!**
- 헤더 <td>를 반드시 </td></tr>로 닫고 나서
- 새로운 <tr><td>로 인사말 시작
- 절대로 헤더 td 안에 인사말을 넣지 마세요!
3. **CSS 클래스 사용 금지** - 인라인 스타일만 사용
4. **그라데이션 배경 금지** - 단색 배경만 사용 (예: background-color: #3B82F6)

### HTML 구조 예시 (테이블 기반)
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px;">
          <!-- 헤더 -->
          <tr>
            <td style="background-color: #3B82F6; color: #ffffff; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">제목</h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #e0e7ff;">서브 카피</p>
            </td>
          </tr>
          <!-- 인사말 -->
          <tr>
            <td style="padding: 30px 20px; text-align: left;">
              <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.6; color: #333333;">인사말 내용</p>
            </td>
          </tr>
          <!-- 상품 카드 (테이블로 가로 배치) -->
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px;">
                <tr>
                  <td width="120" style="padding: 15px;">
                    <img src="이미지URL" width="120" height="120" style="display: block; border-radius: 8px;" />
                  </td>
                  <td style="padding: 15px; vertical-align: top;">
                    <h4 style="margin: 0 0 5px 0; font-size: 16px; color: #333333;">상품명</h4>
                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #71717a;">가격 정보</p>
                    <p style="margin: 8px 0; font-size: 13px; color: #666666; line-height: 1.5;">상품 소개글</p>
                    <a href="URL" target="_blank" style="color: #3B82F6; text-decoration: none; font-weight: bold;">상품 상세보기</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
\`\`\`

### 디자인 가이드
- **폰트: Pretendard 필수** - head에 Pretendard CSS 링크 추가, body에 font-family: 'Pretendard' 적용
- 컨테이너: 600px 너비, 중앙 정렬
- 헤더: 단색 파란색 배경 (#3B82F6), 흰색 텍스트
- 인사말: 왼쪽 정렬, 충분한 여백
- 상품 카드: 테이블로 이미지(왼쪽 120px)와 정보(오른쪽) 가로 배치
- 단체 주문 혜택: 중앙 정렬
- 색상: 메인 #3B82F6, 강조 #10B981, 할인 #EF4444
- 모든 링크에 target="_blank" 필수

## 출력 형식

다음 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{
  "subject": "이메일 제목",
  "htmlBody": "<!DOCTYPE html><html>...</html>",
  "textBody": "텍스트 버전 본문"
}`;
}

// Gemini API를 사용해 이메일 생성
export async function generateEmail(request: EmailGenerationRequest): Promise<GeneratedEmailWithUsage> {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = buildEmailPrompt(request);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 토큰 사용량 추출
    let tokenUsage: TokenUsage | undefined;
    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      const promptTokens = usageMetadata.promptTokenCount || 0;
      const completionTokens = usageMetadata.candidatesTokenCount || 0;
      const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);
      const cost = calculateCost(promptTokens, completionTokens);

      tokenUsage = {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUSD: cost.usd,
        estimatedCostKRW: cost.krw,
      };

      // 누적 사용량에 추가
      addToUsage(tokenUsage);

      console.log('토큰 사용량:', tokenUsage);
    }

    // JSON 파싱 시도
    try {
      // JSON 블록 추출 (```json ... ``` 또는 직접 JSON)
      let jsonText = text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // { 로 시작하는 부분 찾기
        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          jsonText = text.substring(startIdx, endIdx + 1);
        }
      }

      const parsed = JSON.parse(jsonText) as GeneratedEmail;
      return { ...parsed, tokenUsage };
    } catch {
      // JSON 파싱 실패 시 텍스트 그대로 반환
      console.error('JSON 파싱 실패, 원본 텍스트:', text);
      return {
        subject: '마케팅 이메일',
        htmlBody: `<pre>${text}</pre>`,
        textBody: text,
        tokenUsage,
      };
    }
  } catch (error) {
    console.error('Gemini API 오류:', error);
    throw error;
  }
}

// API 키 유효성 검사
export function isGeminiConfigured(): boolean {
  return !!API_KEY && API_KEY.length > 0;
}

// 회사 정보 저장/로드 (로컬 스토리지)
const COMPANY_INFO_KEY = 'b2b_company_info';

export function saveCompanyInfo(info: CompanyInfo): void {
  localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(info));
}

export function loadCompanyInfo(): CompanyInfo {
  const stored = localStorage.getItem(COMPANY_INFO_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as CompanyInfo;
    } catch {
      return defaultCompanyInfo;
    }
  }
  return defaultCompanyInfo;
}

// 이메일 제목 5개 생성 함수
export async function generateEmailSubjects(
  category: string,
  season: string,
  products: ProductForEmail[]
): Promise<{ subjects: string[]; tokenUsage?: TokenUsage }> {
  if (!API_KEY) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const productNames = products.slice(0, 5).map(p => p.name).join(', ');

  const prompt = `당신은 B2B 이메일 마케팅 전문가입니다. 다음 조건에 맞는 이메일 제목 5개를 생성해주세요.

## 조건
- 대상: ${category}
- 시즌/행사: ${season}
- 주요 상품: ${productNames}

## 제목 작성 규칙
1. 반드시 "(광고)" 로 시작해야 함 (정보통신망법 준수)
2. 전체 길이 40자 이내
3. 수신자 입장에서 공감할 수 있는 문구 사용
4. 다음 5가지 유형으로 각각 1개씩 작성:
   - 문제 해결형: 담당자가 겪는 고민을 찌르는 제목
   - 가이드형: 업무 참고 자료처럼 보이는 제목
   - 사례형: 다른 곳 사례를 공개하는 느낌의 제목
   - 손해 회피형: 모르면 손해라는 느낌의 제목
   - 선택 부담 감소형: 결정을 쉽게 해주는 느낌의 제목

## 출력 형식
JSON 배열로만 출력하세요. 다른 설명 없이 아래 형식만 출력:
["제목1", "제목2", "제목3", "제목4", "제목5"]`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // 토큰 사용량 추출
    const usageMetadata = response.usageMetadata;
    const tokenUsage: TokenUsage | undefined = usageMetadata ? {
      promptTokens: usageMetadata.promptTokenCount || 0,
      completionTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    } : undefined;

    // JSON 파싱
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const subjects = JSON.parse(jsonMatch[0]) as string[];
      return { subjects, tokenUsage };
    }

    throw new Error('제목 생성 결과를 파싱할 수 없습니다.');
  } catch (error) {
    console.error('제목 생성 오류:', error);
    throw error;
  }
}
