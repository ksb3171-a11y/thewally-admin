// 공공데이터 수집 서비스 - 확장 가능한 구조
// 수집 흐름: API 호출 → 원본데이터 시트 저장 → 이메일 크롤링 → 이메일데이터 시트 저장

import { getAccessToken, getChurchLastPage, saveChurchLastPage, clearChurchProgress } from './localStorage';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const RAW_DATA_SHEET_NAME = '원본데이터V1.0';
const EMAIL_DATA_SHEET_NAME = '이메일데이타V1.0';

// 공공데이터 소스 타입 정의
export interface PublicDataSource {
  id: string;
  name: string;
  description: string;
  icon: string; // 이모지 또는 아이콘 클래스
  category: string; // 저장될 분류
  enabled: boolean;
  apiConfig: {
    baseUrl: string;
    key: string;
    sidoCodes: Record<string, number>;
  };
}

// 수집 결과 타입
export interface CollectionResult {
  source: string;
  totalCollected: number;
  withHomepage: number;
  withEmail: number;
  elapsed: number; // ms
}

// 수집 진행 상태
export interface CollectionProgress {
  source: string;
  status: 'idle' | 'collecting' | 'saving' | 'crawling' | 'paused' | 'done' | 'error';
  currentRegion?: string;
  collected: number;
  total: number;
  message?: string;
}

// 상세 진행 로그
export interface CollectionLog {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'saving';
  message: string;
  details?: string;
}

// 수집 옵션
export interface CollectionOptions {
  maxItems?: number; // 최대 수집 개수 (신규 데이터 기준)
  savePerRegion?: boolean; // 시도별 즉시 저장 (기본: true)
  delayBetweenRegions?: number; // 지역 간 딜레이 ms (기본: 1000)
  skipDuplicates?: boolean; // 중복 건너뛰기 (기본: true)
  abortSignal?: AbortSignal; // 취소 신호
  establishmentFilter?: string[]; // 설립유형 필터 (예: ['사립'])
}

// 수집된 기관 데이터
export interface CollectedOrganization {
  name: string;
  type: string; // 설립유형
  address: string;
  phone: string;
  homepage: string;
  representative: string; // 대표자/원장
  region: string; // 교육청/관할구역
  email?: string;
  collectedAt: string;
}

// NEIS 시도교육청 코드 (초중고용)
const NEIS_EDU_CODES: Record<string, string> = {
  '서울': 'B10', '부산': 'C10', '대구': 'D10', '인천': 'E10', '광주': 'F10',
  '대전': 'G10', '울산': 'H10', '세종': 'I10', '경기': 'J10', '강원': 'K10',
  '충북': 'M10', '충남': 'N10', '전북': 'P10', '전남': 'Q10', '경북': 'R10',
  '경남': 'S10', '제주': 'T10',
};

// 등록된 공공데이터 소스 목록
export const PUBLIC_DATA_SOURCES: PublicDataSource[] = [
  {
    id: 'kindergarten',
    name: '유치원',
    description: '전국 유치원 기본정보 (교육부)',
    icon: '🏫',
    category: '유치원',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://e-childschoolinfo.moe.go.kr/api/notice/basicInfo.do',
      key: '1115a8a5396046ad9a6b587d749ea8c1',
      sidoCodes: {
        '서울': 11, '부산': 26, '대구': 27, '인천': 28, '광주': 29,
        '대전': 30, '울산': 31, '세종': 36, '경기': 41, '강원': 42,
        '충북': 43, '충남': 44, '전북': 45, '전남': 46, '경북': 47,
        '경남': 48, '제주': 50,
      },
    },
  },
  {
    id: 'elementary',
    name: '초등학교',
    description: '전국 초등학교 기본정보 (NEIS)',
    icon: '🎒',
    category: '초등학교',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://open.neis.go.kr/hub/schoolInfo',
      key: '291b3e0b382a4189929f066c044b24fa',
      sidoCodes: {
        '서울': 1, '부산': 2, '대구': 3, '인천': 4, '광주': 5,
        '대전': 6, '울산': 7, '세종': 8, '경기': 9, '강원': 10,
        '충북': 11, '충남': 12, '전북': 13, '전남': 14, '경북': 15,
        '경남': 16, '제주': 17,
      },
    },
  },
  {
    id: 'middle',
    name: '중학교',
    description: '전국 중학교 기본정보 (NEIS)',
    icon: '📚',
    category: '중학교',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://open.neis.go.kr/hub/schoolInfo',
      key: '291b3e0b382a4189929f066c044b24fa',
      sidoCodes: {
        '서울': 1, '부산': 2, '대구': 3, '인천': 4, '광주': 5,
        '대전': 6, '울산': 7, '세종': 8, '경기': 9, '강원': 10,
        '충북': 11, '충남': 12, '전북': 13, '전남': 14, '경북': 15,
        '경남': 16, '제주': 17,
      },
    },
  },
  {
    id: 'high',
    name: '고등학교',
    description: '전국 고등학교 기본정보 (NEIS)',
    icon: '🎓',
    category: '고등학교',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://open.neis.go.kr/hub/schoolInfo',
      key: '291b3e0b382a4189929f066c044b24fa',
      sidoCodes: {
        '서울': 1, '부산': 2, '대구': 3, '인천': 4, '광주': 5,
        '대전': 6, '울산': 7, '세종': 8, '경기': 9, '강원': 10,
        '충북': 11, '충남': 12, '전북': 13, '전남': 14, '경북': 15,
        '경남': 16, '제주': 17,
      },
    },
  },
  {
    id: 'university',
    name: '대학교',
    description: '전국 대학 및 전문대학 기본정보 (한국대학교육협의회)',
    icon: '🏛️',
    category: '대학교',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://api.odcloud.kr/api/15107736/v1/uddi:bc4dfac2-3551-4d83-a7a8-df668677a4dc',
      key: '6e2287616c107e0ef4d26613288741d066727b4ddc40055f0ebf36b411c54087',
      sidoCodes: {
        '서울': 11, '부산': 26, '대구': 27, '인천': 28, '광주': 29,
        '대전': 30, '울산': 31, '세종': 36, '경기': 41, '강원': 42,
        '충북': 43, '충남': 44, '전북': 45, '전남': 46, '경북': 47,
        '경남': 48, '제주': 50,
      },
    },
  },
  {
    id: 'church',
    name: '교회',
    description: '대한예수교장로회총회 교회주소록 (이메일 포함)',
    icon: '⛪',
    category: '교회',
    enabled: true,
    apiConfig: {
      baseUrl: 'https://new.pck.or.kr/address.php',
      key: '', // API 키 필요 없음 (HTML 스크래핑)
      sidoCodes: {
        '서울': 1, '부산': 2, '대구': 3, '인천': 4, '광주': 5,
        '대전': 6, '울산': 7, '세종': 8, '경기': 9, '강원': 10,
        '충북': 11, '충남': 12, '전북': 13, '전남': 14, '경북': 15,
        '경남': 16, '제주': 17,
      },
    },
  },
];

// 시군구 코드 (전국)
const SGG_CODES: Record<number, Array<{ code: number; name: string }>> = {
  // 서울특별시
  11: [
    { code: 11110, name: '종로구' }, { code: 11140, name: '중구' },
    { code: 11170, name: '용산구' }, { code: 11200, name: '성동구' },
    { code: 11215, name: '광진구' }, { code: 11230, name: '동대문구' },
    { code: 11260, name: '중랑구' }, { code: 11290, name: '성북구' },
    { code: 11305, name: '강북구' }, { code: 11320, name: '도봉구' },
    { code: 11350, name: '노원구' }, { code: 11380, name: '은평구' },
    { code: 11410, name: '서대문구' }, { code: 11440, name: '마포구' },
    { code: 11470, name: '양천구' }, { code: 11500, name: '강서구' },
    { code: 11530, name: '구로구' }, { code: 11545, name: '금천구' },
    { code: 11560, name: '영등포구' }, { code: 11590, name: '동작구' },
    { code: 11620, name: '관악구' }, { code: 11650, name: '서초구' },
    { code: 11680, name: '강남구' }, { code: 11710, name: '송파구' },
    { code: 11740, name: '강동구' },
  ],
  // 부산광역시
  26: [
    { code: 26110, name: '중구' }, { code: 26140, name: '서구' },
    { code: 26170, name: '동구' }, { code: 26200, name: '영도구' },
    { code: 26230, name: '부산진구' }, { code: 26260, name: '동래구' },
    { code: 26290, name: '남구' }, { code: 26320, name: '북구' },
    { code: 26350, name: '해운대구' }, { code: 26380, name: '사하구' },
    { code: 26410, name: '금정구' }, { code: 26440, name: '강서구' },
    { code: 26470, name: '연제구' }, { code: 26500, name: '수영구' },
    { code: 26530, name: '사상구' }, { code: 26710, name: '기장군' },
  ],
  // 대구광역시
  27: [
    { code: 27110, name: '중구' }, { code: 27140, name: '동구' },
    { code: 27170, name: '서구' }, { code: 27200, name: '남구' },
    { code: 27230, name: '북구' }, { code: 27260, name: '수성구' },
    { code: 27290, name: '달서구' }, { code: 27710, name: '달성군' },
    { code: 27720, name: '군위군' },
  ],
  // 인천광역시
  28: [
    { code: 28110, name: '중구' }, { code: 28140, name: '동구' },
    { code: 28177, name: '미추홀구' }, { code: 28185, name: '연수구' },
    { code: 28200, name: '남동구' }, { code: 28237, name: '부평구' },
    { code: 28245, name: '계양구' }, { code: 28260, name: '서구' },
    { code: 28710, name: '강화군' }, { code: 28720, name: '옹진군' },
  ],
  // 광주광역시
  29: [
    { code: 29110, name: '동구' }, { code: 29140, name: '서구' },
    { code: 29155, name: '남구' }, { code: 29170, name: '북구' },
    { code: 29200, name: '광산구' },
  ],
  // 대전광역시
  30: [
    { code: 30110, name: '동구' }, { code: 30140, name: '중구' },
    { code: 30170, name: '서구' }, { code: 30200, name: '유성구' },
    { code: 30230, name: '대덕구' },
  ],
  // 울산광역시
  31: [
    { code: 31110, name: '중구' }, { code: 31140, name: '남구' },
    { code: 31170, name: '동구' }, { code: 31200, name: '북구' },
    { code: 31710, name: '울주군' },
  ],
  // 세종특별자치시
  36: [{ code: 36110, name: '세종시' }],
  // 경기도
  41: [
    { code: 41111, name: '수원시장안구' }, { code: 41113, name: '수원시권선구' },
    { code: 41115, name: '수원시팔달구' }, { code: 41117, name: '수원시영통구' },
    { code: 41131, name: '성남시수정구' }, { code: 41133, name: '성남시중원구' },
    { code: 41135, name: '성남시분당구' }, { code: 41150, name: '의정부시' },
    { code: 41171, name: '안양시만안구' }, { code: 41173, name: '안양시동안구' },
    { code: 41190, name: '부천시' }, { code: 41210, name: '광명시' },
    { code: 41220, name: '평택시' }, { code: 41250, name: '동두천시' },
    { code: 41271, name: '안산시상록구' }, { code: 41273, name: '안산시단원구' },
    { code: 41281, name: '고양시덕양구' }, { code: 41285, name: '고양시일산동구' },
    { code: 41287, name: '고양시일산서구' }, { code: 41290, name: '과천시' },
    { code: 41310, name: '구리시' }, { code: 41360, name: '남양주시' },
    { code: 41370, name: '오산시' }, { code: 41390, name: '시흥시' },
    { code: 41410, name: '군포시' }, { code: 41430, name: '의왕시' },
    { code: 41450, name: '하남시' }, { code: 41461, name: '용인시처인구' },
    { code: 41463, name: '용인시기흥구' }, { code: 41465, name: '용인시수지구' },
    { code: 41480, name: '파주시' }, { code: 41500, name: '이천시' },
    { code: 41550, name: '안성시' }, { code: 41570, name: '김포시' },
    { code: 41590, name: '화성시' }, { code: 41610, name: '광주시' },
    { code: 41630, name: '양주시' }, { code: 41650, name: '포천시' },
    { code: 41670, name: '여주시' }, { code: 41800, name: '연천군' },
    { code: 41820, name: '가평군' }, { code: 41830, name: '양평군' },
  ],
  // 강원특별자치도
  42: [
    { code: 42110, name: '춘천시' }, { code: 42130, name: '원주시' },
    { code: 42150, name: '강릉시' }, { code: 42170, name: '동해시' },
    { code: 42190, name: '태백시' }, { code: 42210, name: '속초시' },
    { code: 42230, name: '삼척시' }, { code: 42720, name: '홍천군' },
    { code: 42730, name: '횡성군' }, { code: 42750, name: '영월군' },
    { code: 42760, name: '평창군' }, { code: 42770, name: '정선군' },
    { code: 42780, name: '철원군' }, { code: 42790, name: '화천군' },
    { code: 42800, name: '양구군' }, { code: 42810, name: '인제군' },
    { code: 42820, name: '고성군' }, { code: 42830, name: '양양군' },
  ],
  // 충청북도
  43: [
    { code: 43111, name: '청주시상당구' }, { code: 43112, name: '청주시서원구' },
    { code: 43113, name: '청주시흥덕구' }, { code: 43114, name: '청주시청원구' },
    { code: 43130, name: '충주시' }, { code: 43150, name: '제천시' },
    { code: 43720, name: '보은군' }, { code: 43730, name: '옥천군' },
    { code: 43740, name: '영동군' }, { code: 43745, name: '증평군' },
    { code: 43750, name: '진천군' }, { code: 43760, name: '괴산군' },
    { code: 43770, name: '음성군' }, { code: 43800, name: '단양군' },
  ],
  // 충청남도
  44: [
    { code: 44131, name: '천안시동남구' }, { code: 44133, name: '천안시서북구' },
    { code: 44150, name: '공주시' }, { code: 44180, name: '보령시' },
    { code: 44200, name: '아산시' }, { code: 44210, name: '서산시' },
    { code: 44230, name: '논산시' }, { code: 44250, name: '계룡시' },
    { code: 44270, name: '당진시' }, { code: 44710, name: '금산군' },
    { code: 44760, name: '부여군' }, { code: 44770, name: '서천군' },
    { code: 44790, name: '청양군' }, { code: 44800, name: '홍성군' },
    { code: 44810, name: '예산군' }, { code: 44825, name: '태안군' },
  ],
  // 전라북도
  45: [
    { code: 45111, name: '전주시완산구' }, { code: 45113, name: '전주시덕진구' },
    { code: 45130, name: '군산시' }, { code: 45140, name: '익산시' },
    { code: 45180, name: '정읍시' }, { code: 45190, name: '남원시' },
    { code: 45210, name: '김제시' }, { code: 45710, name: '완주군' },
    { code: 45720, name: '진안군' }, { code: 45730, name: '무주군' },
    { code: 45740, name: '장수군' }, { code: 45750, name: '임실군' },
    { code: 45770, name: '순창군' }, { code: 45790, name: '고창군' },
    { code: 45800, name: '부안군' },
  ],
  // 전라남도
  46: [
    { code: 46110, name: '목포시' }, { code: 46130, name: '여수시' },
    { code: 46150, name: '순천시' }, { code: 46170, name: '나주시' },
    { code: 46230, name: '광양시' }, { code: 46710, name: '담양군' },
    { code: 46720, name: '곡성군' }, { code: 46730, name: '구례군' },
    { code: 46770, name: '고흥군' }, { code: 46780, name: '보성군' },
    { code: 46790, name: '화순군' }, { code: 46800, name: '장흥군' },
    { code: 46810, name: '강진군' }, { code: 46820, name: '해남군' },
    { code: 46830, name: '영암군' }, { code: 46840, name: '무안군' },
    { code: 46860, name: '함평군' }, { code: 46870, name: '영광군' },
    { code: 46880, name: '장성군' }, { code: 46890, name: '완도군' },
    { code: 46900, name: '진도군' }, { code: 46910, name: '신안군' },
  ],
  // 경상북도
  47: [
    { code: 47111, name: '포항시남구' }, { code: 47113, name: '포항시북구' },
    { code: 47130, name: '경주시' }, { code: 47150, name: '김천시' },
    { code: 47170, name: '안동시' }, { code: 47190, name: '구미시' },
    { code: 47210, name: '영주시' }, { code: 47230, name: '영천시' },
    { code: 47250, name: '상주시' }, { code: 47280, name: '문경시' },
    { code: 47290, name: '경산시' }, { code: 47720, name: '의성군' },
    { code: 47730, name: '청송군' }, { code: 47750, name: '영양군' },
    { code: 47760, name: '영덕군' }, { code: 47770, name: '청도군' },
    { code: 47780, name: '고령군' }, { code: 47790, name: '성주군' },
    { code: 47800, name: '칠곡군' }, { code: 47820, name: '예천군' },
    { code: 47830, name: '봉화군' }, { code: 47840, name: '울진군' },
    { code: 47850, name: '울릉군' },
  ],
  // 경상남도
  48: [
    { code: 48121, name: '창원시의창구' }, { code: 48123, name: '창원시성산구' },
    { code: 48125, name: '창원시마산합포구' }, { code: 48127, name: '창원시마산회원구' },
    { code: 48129, name: '창원시진해구' }, { code: 48170, name: '진주시' },
    { code: 48220, name: '통영시' }, { code: 48240, name: '사천시' },
    { code: 48250, name: '김해시' }, { code: 48270, name: '밀양시' },
    { code: 48310, name: '거제시' }, { code: 48330, name: '양산시' },
    { code: 48720, name: '의령군' }, { code: 48730, name: '함안군' },
    { code: 48740, name: '창녕군' }, { code: 48820, name: '고성군' },
    { code: 48840, name: '남해군' }, { code: 48850, name: '하동군' },
    { code: 48860, name: '산청군' }, { code: 48870, name: '함양군' },
    { code: 48880, name: '거창군' }, { code: 48890, name: '합천군' },
  ],
  // 제주특별자치도
  50: [
    { code: 50110, name: '제주시' }, { code: 50130, name: '서귀포시' },
  ],
};

// 딜레이 함수
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// CORS 프록시 서버 URL (환경변수 또는 기본값)
const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL || 'http://localhost:3001';
const LOCAL_PROXY = `${PROXY_SERVER_URL}/proxy?url=`;
const CORS_PROXIES = [
  LOCAL_PROXY, // 프록시 서버 (가장 안정적)
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url=',
];

// 기존 데이터 조회 (중복 체크용)
async function getExistingOrganizations(): Promise<Set<string>> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return new Set();
  }

  try {
    const sheet = await findOrCreateSheet(accessToken, RAW_DATA_SHEET_NAME);
    const response = await fetch(
      `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent('데이터!A:A')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return new Set();
    }

    const data = await response.json();
    const rows = data.values || [];
    const existingNames = new Set<string>();

    // 헤더 제외하고 단체명 수집
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0]) {
        existingNames.add(rows[i][0]);
      }
    }

    return existingNames;
  } catch {
    return new Set();
  }
}

// CORS 프록시를 통한 API 호출
async function fetchWithProxy(url: string, abortSignal?: AbortSignal): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    // 중단 체크
    if (abortSignal?.aborted) {
      throw new Error('사용자에 의해 수집이 중단되었습니다.');
    }

    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      console.log(`[프록시 시도] ${proxy.slice(8, 35)}...`);

      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: abortSignal || AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const text = await response.text();

        // HTML 응답인지 확인 (프록시 오류 페이지)
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          console.log(`[프록시 실패] ${proxy.slice(8, 35)}...: HTML 응답 (프록시 오류)`);
          continue;
        }

        // JSON 파싱 가능한지 확인
        try {
          JSON.parse(text);
          console.log(`[프록시 성공] ${proxy.slice(8, 35)}...`);
          return text;
        } catch {
          console.log(`[프록시 실패] ${proxy.slice(8, 35)}...: JSON 파싱 실패`);
          continue;
        }
      } else {
        console.log(`[프록시 실패] ${proxy.slice(8, 35)}...: HTTP ${response.status}`);
      }
    } catch (error) {
      // 중단 에러는 상위로 전파
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('중단'))) {
        throw new Error('사용자에 의해 수집이 중단되었습니다.');
      }
      console.log(`[프록시 실패] ${proxy.slice(8, 35)}...: ${error}`);
      continue;
    }
  }
  return null;
}

// 유치원 API 호출 (CORS 프록시 사용)
async function fetchKindergartens(
  sidoCode: number,
  sggCode: number,
  _onProgress?: (message: string) => void,
  abortSignal?: AbortSignal
): Promise<CollectedOrganization[]> {
  const source = PUBLIC_DATA_SOURCES.find((s) => s.id === 'kindergarten')!;
  const results: CollectedOrganization[] = [];
  let currentPage = 1;
  const pageCnt = 500;

  while (true) {
    // 중단 체크
    if (abortSignal?.aborted) {
      throw new Error('사용자에 의해 수집이 중단되었습니다.');
    }

    const url = `${source.apiConfig.baseUrl}?key=${source.apiConfig.key}&sidoCode=${sidoCode}&sggCode=${sggCode}&pageCnt=${pageCnt}&currentPage=${currentPage}`;

    try {
      const text = await fetchWithProxy(url, abortSignal);
      if (!text) {
        console.error('API 호출 실패: 모든 프록시 실패');
        break;
      }

      const data = JSON.parse(text);

      if (data.status === 'SUCCESS' && data.kinderInfo && data.kinderInfo.length > 0) {
        for (const k of data.kinderInfo) {
          results.push({
            name: k.kindername || '',
            type: k.establish || '',
            address: k.addr || '',
            phone: k.telno || '',
            homepage: k.hpaddr || '',
            representative: k.ldgrname || k.ldgname || '',
            region: k.officeedu || '',
            collectedAt: new Date().toISOString(),
          });
        }

        if (data.kinderInfo.length < pageCnt) {
          break;
        }
        currentPage++;
        await delay(200); // API 제한 방지
      } else {
        break;
      }
    } catch (error) {
      // 중단 에러는 상위로 전파
      if (error instanceof Error && error.message.includes('중단')) {
        throw error;
      }
      console.error('API 호출 오류:', error);
      break;
    }
  }

  return results;
}

// NEIS 학교정보 API 호출 (초중고 공통)
async function fetchSchools(
  sidoName: string,
  schoolType: '초등학교' | '중학교' | '고등학교',
  apiKey: string,
  abortSignal?: AbortSignal,
  establishmentFilter?: string[] // 설립유형 필터 (예: ['사립'])
): Promise<CollectedOrganization[]> {
  const results: CollectedOrganization[] = [];
  const eduCode = NEIS_EDU_CODES[sidoName];

  if (!eduCode) {
    console.error(`[NEIS] 알 수 없는 시도: ${sidoName}`);
    return results;
  }

  // 학교종류 코드 매핑
  const schoolKindMap: Record<string, string> = {
    '초등학교': '초등학교',
    '중학교': '중학교',
    '고등학교': '고등학교',
  };

  let currentPage = 1;
  const pageSize = 1000;

  while (true) {
    // 중단 체크
    if (abortSignal?.aborted) {
      throw new Error('사용자에 의해 수집이 중단되었습니다.');
    }

    // NEIS API는 직접 호출 (CORS 지원됨)
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${apiKey}&Type=json&pIndex=${currentPage}&pSize=${pageSize}&ATPT_OFCDC_SC_CODE=${eduCode}&SCHUL_KND_SC_NM=${encodeURIComponent(schoolKindMap[schoolType])}`;

    try {
      const response = await fetch(url, {
        signal: abortSignal || AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.error(`[NEIS] API 호출 실패: HTTP ${response.status}`);
        break;
      }

      const data = await response.json();

      // 응답 구조 확인
      if (!data.schoolInfo || !data.schoolInfo[1] || !data.schoolInfo[1].row) {
        // 데이터가 없거나 끝에 도달
        if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
          // 정상적으로 데이터 없음
          break;
        }
        console.log(`[NEIS] ${sidoName} ${schoolType} 페이지 ${currentPage}: 데이터 없음`);
        break;
      }

      const rows = data.schoolInfo[1].row;

      for (const school of rows) {
        // 가칭 학교 제외 (아직 설립 안 된 학교)
        if (school.SCHUL_NM.includes('(가칭)')) continue;

        // 설립유형 필터 적용 (예: ['사립']만 수집)
        if (establishmentFilter && establishmentFilter.length > 0) {
          const estType = school.FOND_SC_NM || '';
          if (!establishmentFilter.includes(estType)) continue;
        }

        results.push({
          name: school.SCHUL_NM || '',
          type: school.FOND_SC_NM || '', // 공립/사립
          address: (school.ORG_RDNMA || '') + ' ' + (school.ORG_RDNDA || ''),
          phone: school.ORG_TELNO || '',
          homepage: school.HMPG_ADRES || '',
          representative: '', // NEIS API에는 교장 정보 없음
          region: school.JU_ORG_NM || school.ATPT_OFCDC_SC_NM || '',
          collectedAt: new Date().toISOString(),
        });
      }

      console.log(`[NEIS] ${sidoName} ${schoolType} 페이지 ${currentPage}: ${rows.length}개 수집`);

      // 페이지 끝 확인
      if (rows.length < pageSize) {
        break;
      }

      currentPage++;
      await delay(300); // API 제한 방지
    } catch (error) {
      // 중단 에러는 상위로 전파
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('중단'))) {
        throw error;
      }
      console.error(`[NEIS] API 호출 오류:`, error);
      break;
    }
  }

  return results;
}

// 대학 API 호출 (공공데이터포털 - 전국대학및전문대학정보)
async function fetchUniversities(
  abortSignal?: AbortSignal,
  establishmentFilter?: string[] // 설립유형 필터 (예: ['사립'])
): Promise<CollectedOrganization[]> {
  const source = PUBLIC_DATA_SOURCES.find((s) => s.id === 'university')!;
  const results: CollectedOrganization[] = [];
  let currentPage = 1;
  const pageSize = 1000;

  while (true) {
    // 중단 체크
    if (abortSignal?.aborted) {
      throw new Error('사용자에 의해 수집이 중단되었습니다.');
    }

    const url = `${source.apiConfig.baseUrl}?page=${currentPage}&perPage=${pageSize}&serviceKey=${source.apiConfig.key}`;

    try {
      const response = await fetch(url, {
        signal: abortSignal || AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.error(`[대학] API 호출 실패: HTTP ${response.status}`);
        const errorText = await response.text();
        console.error(`[대학] 오류 응답:`, errorText);
        break;
      }

      const data = await response.json();

      // 응답 구조 확인
      if (!data.data || data.data.length === 0) {
        console.log(`[대학] 페이지 ${currentPage}: 데이터 없음`);
        break;
      }

      const rows = data.data;

      for (const univ of rows) {
        // 설립유형 필터 적용 (예: ['사립']만 수집)
        if (establishmentFilter && establishmentFilter.length > 0) {
          const estType = univ['설립형태구분명'] || '';
          if (!establishmentFilter.includes(estType)) continue;
        }

        results.push({
          name: univ['학교명'] || '',
          type: univ['설립형태구분명'] || '', // 국립/공립/사립
          address: univ['소재지도로명주소'] || univ['소재지지번주소'] || '',
          phone: univ['대표전화번호'] || '',
          homepage: univ['홈페이지주소'] || '',
          representative: '', // API에 대표자 정보 없음
          region: univ['시도명'] || '',
          collectedAt: new Date().toISOString(),
        });
      }

      console.log(`[대학] 페이지 ${currentPage}: ${rows.length}개 수집 (누적: ${results.length}개)`);

      // 페이지 끝 확인
      if (rows.length < pageSize) {
        break;
      }

      currentPage++;
      await delay(200); // API 제한 방지
    } catch (error) {
      // 중단 에러는 상위로 전파
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('중단'))) {
        throw error;
      }
      console.error(`[대학] API 호출 오류:`, error);
      break;
    }
  }

  return results;
}

// 교회 HTML 스크래핑 (대한예수교장로회총회 주소록)
async function fetchChurches(
  sidoName: string,
  abortSignal?: AbortSignal,
  resumeFromLastPage: boolean = true // 마지막 수집 페이지부터 이어서 수집할지 여부
): Promise<CollectedOrganization[]> {
  const results: CollectedOrganization[] = [];

  // 마지막 수집 페이지 확인 (기본: 1페이지부터 시작)
  const startPage = resumeFromLastPage ? getChurchLastPage(sidoName) : 1;
  let currentPage = startPage;

  if (startPage > 1) {
    console.log(`[교회] ${sidoName}: 이전 수집 기록 발견, ${startPage}페이지부터 이어서 수집`);
  }

  // 검색어 매핑 (시도명 -> 검색 키워드)
  const searchKeywords: Record<string, string> = {
    '서울': '서울',
    '부산': '부산',
    '대구': '대구',
    '인천': '인천',
    '광주': '광주',
    '대전': '대전',
    '울산': '울산',
    '세종': '세종',
    '경기': '경기',
    '강원': '강원',
    '충북': '충북',
    '충남': '충남',
    '전북': '전북',
    '전남': '전남',
    '경북': '경북',
    '경남': '경남',
    '제주': '제주',
  };

  const searchKeyword = searchKeywords[sidoName];
  if (!searchKeyword) {
    console.error(`[교회] 알 수 없는 시도: ${sidoName}`);
    return results;
  }

  while (true) {
    // 중단 체크 - 현재까지 수집된 데이터 반환
    if (abortSignal?.aborted) {
      console.log(`[교회] ${sidoName} 중단됨 - 현재까지 ${results.length}개 수집됨 (페이지 ${currentPage}에서 중단)`);
      // 중단 시 현재 페이지 저장 (다음에 이어서 수집 가능)
      saveChurchLastPage(sidoName, currentPage);
      break;
    }

    const url = `https://new.pck.or.kr/address.php?flag=churchAddress&sch=${encodeURIComponent(searchKeyword)}&page=${currentPage}`;

    try {
      // 프록시를 통해 HTML 가져오기
      const html = await fetchHtmlWithProxy(url, abortSignal);
      if (!html) {
        console.error(`[교회] 페이지 ${currentPage}: 스크래핑 실패`);
        // 실패 시에도 진행 상황 저장
        saveChurchLastPage(sidoName, currentPage);
        break;
      }

      // HTML 파싱하여 교회 데이터 추출
      const churches = parseChurchHtml(html, sidoName);

      if (churches.length === 0) {
        console.log(`[교회] ${sidoName} 페이지 ${currentPage}: 데이터 없음, 수집 종료`);
        // 마지막 페이지 도달 - 진행 상황 초기화 (처음부터 다시 수집 가능)
        clearChurchProgress(sidoName);
        break;
      }

      results.push(...churches);
      console.log(`[교회] ${sidoName} 페이지 ${currentPage}: ${churches.length}개 수집 (누적: ${results.length}개)`);

      // 페이지 수집 성공 시 진행 상황 저장
      saveChurchLastPage(sidoName, currentPage + 1); // 다음 페이지부터 시작하도록

      // 페이지네이션 확인 - 다음 페이지가 있는지 체크
      if (!html.includes(`page=${currentPage + 1}`)) {
        console.log(`[교회] ${sidoName} 마지막 페이지 도달`);
        // 마지막 페이지 도달 - 진행 상황 초기화
        clearChurchProgress(sidoName);
        break;
      }

      currentPage++;
      await delay(300); // 서버 부하 방지
    } catch (error) {
      // 중단 에러: 현재까지 수집된 데이터 반환 (버리지 않음)
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('중단'))) {
        console.log(`[교회] ${sidoName} 중단됨 - 현재까지 ${results.length}개 수집됨`);
        // 중단 시 현재 페이지 저장
        saveChurchLastPage(sidoName, currentPage);
        return results; // 중단 시에도 수집된 데이터 반환
      }
      console.error(`[교회] 페이지 ${currentPage} 스크래핑 오류:`, error);
      // 에러 시에도 진행 상황 저장
      saveChurchLastPage(sidoName, currentPage);
      break;
    }
  }

  return results;
}

// HTML 프록시 요청
async function fetchHtmlWithProxy(url: string, abortSignal?: AbortSignal): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    // 중단 체크 - null 반환 (상위에서 처리)
    if (abortSignal?.aborted) {
      return null;
    }

    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      console.log(`[HTML 프록시 시도] ${proxy.slice(8, 35)}...`);

      const response = await fetch(proxyUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: abortSignal || AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const text = await response.text();

        // HTML 응답인지 확인
        if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<table')) {
          console.log(`[HTML 프록시 성공] ${proxy.slice(8, 35)}...`);
          return text;
        }
      }
    } catch (error) {
      // 중단 에러는 null 반환 (상위에서 처리)
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('중단'))) {
        return null;
      }
      console.log(`[HTML 프록시 실패] ${proxy.slice(8, 35)}...: ${error}`);
      continue;
    }
  }
  return null;
}

// 교회 HTML 파싱
function parseChurchHtml(html: string, sidoName: string): CollectedOrganization[] {
  const results: CollectedOrganization[] = [];

  // 테이블 구조 분석:
  // <tr>
  //   <td rowspan="4">노회명</td>
  //   <td rowspan="4">교회명</td>
  //   <td rowspan="4">우편번호</td>
  //   <td rowspan="4">주소</td>
  //   <td rowspan="4">담임교역자</td>
  //   <td>TEL : ...</td>
  // </tr>
  // <tr><td>홈페이지</td></tr>
  // <tr><td>팩스번호</td></tr>
  // <tr><td>EMAIL : ...</td></tr>

  // tbody에서 교회 데이터 블록 찾기
  // 구조: 5개의 rowspan="4" td + 1개의 일반 td(TEL)가 있는 tr
  // 그 다음 3개 tr에 홈페이지, 팩스, EMAIL이 있음

  // tbody 추출
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    console.log('[교회 파싱] tbody를 찾을 수 없음');
    return results;
  }

  const tbody = tbodyMatch[1];

  // 각 교회는 4개의 tr로 구성됨
  // 첫 번째 tr: rowspan="4" td들 + TEL
  // 두 번째 tr: 홈페이지
  // 세 번째 tr: 팩스
  // 네 번째 tr: EMAIL

  // rowspan="4"를 포함하는 첫 번째 td를 찾아서 교회 블록 시작 지점 파악
  const churchBlockRegex = /<tr[^>]*>\s*<td[^>]*rowspan="4"[^>]*class="bb-2"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*rowspan="4"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*rowspan="4"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*rowspan="4"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*rowspan="4"[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  let blockMatch;
  while ((blockMatch = churchBlockRegex.exec(tbody)) !== null) {
    try {
      const presbytery = stripHtml(blockMatch[1]).trim(); // 노회명
      const churchName = stripHtml(blockMatch[2]).trim(); // 교회명
      // blockMatch[3] = 우편번호
      const address = stripHtml(blockMatch[4]).trim(); // 주소
      const pastor = stripHtml(blockMatch[5]).trim(); // 담임교역자
      const telCell = blockMatch[6]; // TEL 셀

      // 교회명이 비어있거나 헤더인 경우 건너뛰기
      if (!churchName || churchName === '교회명' || churchName === '노회명') continue;

      // TEL 추출
      const telMatch = telCell.match(/TEL\s*:\s*<a[^>]*>([^<]*)<\/a>/i) ||
                       telCell.match(/TEL\s*:\s*([^\s<]+)/i);
      const phone = telMatch ? telMatch[1].trim().replace(/^--$/, '') : '';

      // 현재 위치부터 다음 내용에서 홈페이지, 이메일 추출
      const nextContent = tbody.slice(blockMatch.index + blockMatch[0].length, blockMatch.index + blockMatch[0].length + 600);

      // 홈페이지 추출
      let homepage = '';
      const hpMatch = nextContent.match(/href="(https?:\/\/[^"]+)"/i);
      if (hpMatch && !hpMatch[1].includes('pck.or.kr') && !hpMatch[1].includes('tel:')) {
        homepage = hpMatch[1];
      }

      // 이메일 추출
      let email = '';
      const emailMatch = nextContent.match(/EMAIL\s*:\s*([^\s<]+@[^\s<]+)/i);
      if (emailMatch) {
        email = emailMatch[1].trim();
      }

      results.push({
        name: churchName,
        type: '교회',
        address: address,
        phone: phone,
        homepage: homepage,
        representative: pastor,
        region: presbytery || sidoName,
        email: email,
        collectedAt: new Date().toISOString(),
      });
    } catch {
      // 파싱 오류는 무시하고 계속
      continue;
    }
  }

  // 대체 파싱 방식 (결과가 없을 때)
  if (results.length === 0) {
    console.log('[교회 파싱] 기본 방식 실패, 대체 파싱 시도...');

    // tbody 내용만 추출
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) return results;

    const tbody = tbodyMatch[1];
    const rows = tbody.split(/<tr[^>]*>/gi).filter(r => r.trim());

    let currentChurch: Partial<CollectedOrganization> = {};
    let rowIndex = 0;

    for (const row of rows) {
      // rowspan="4"가 있는 행 = 새로운 교회 시작
      if (row.includes('rowspan="4"')) {
        // 이전 교회 저장
        if (currentChurch.name && currentChurch.name !== '교회명') {
          results.push({
            name: currentChurch.name,
            type: '교회',
            address: currentChurch.address || '',
            phone: currentChurch.phone || '',
            homepage: currentChurch.homepage || '',
            representative: currentChurch.representative || '',
            region: currentChurch.region || sidoName,
            email: currentChurch.email || '',
            collectedAt: new Date().toISOString(),
          });
        }

        // 새 교회 정보 파싱
        const tdRegex = /<td[^>]*rowspan="4"[^>]*>([\s\S]*?)<\/td>/gi;
        const tds: string[] = [];
        let m;
        while ((m = tdRegex.exec(row)) !== null) {
          tds.push(stripHtml(m[1]).trim());
        }

        if (tds.length >= 5) {
          currentChurch = {
            name: tds[1],
            region: tds[0] || sidoName,
            address: tds[3],
            representative: tds[4],
          };
        } else {
          currentChurch = {};
        }

        // TEL 추출
        const telMatch = row.match(/TEL\s*:\s*<a[^>]*>([^<]*)<\/a>/i) ||
                         row.match(/TEL\s*:\s*([^\s<]+)/i);
        if (telMatch && currentChurch.name) {
          const tel = telMatch[1].trim();
          if (tel !== '--') currentChurch.phone = tel;
        }

        rowIndex = 0;
      } else {
        rowIndex++;

        // 홈페이지 (rowIndex 1)
        if (rowIndex === 1) {
          const hpMatch = row.match(/href="(https?:\/\/[^"]+)"/i);
          if (hpMatch && currentChurch.name && !hpMatch[1].includes('pck.or.kr')) {
            currentChurch.homepage = hpMatch[1];
          }
        }

        // EMAIL (rowIndex 3)
        if (rowIndex === 3) {
          const emailMatch = row.match(/EMAIL\s*:\s*([^\s<]+@[^\s<]+)/i);
          if (emailMatch && currentChurch.name) {
            currentChurch.email = emailMatch[1].trim();
          }
        }
      }
    }

    // 마지막 교회 저장
    if (currentChurch.name && currentChurch.name !== '교회명') {
      results.push({
        name: currentChurch.name,
        type: '교회',
        address: currentChurch.address || '',
        phone: currentChurch.phone || '',
        homepage: currentChurch.homepage || '',
        representative: currentChurch.representative || '',
        region: currentChurch.region || sidoName,
        email: currentChurch.email || '',
        collectedAt: new Date().toISOString(),
      });
    }
  }

  return results;
}

// 사용하지 않는 유틸리티 함수 (참고용)
// function extractTextFromTd(html: string, index: number): string {
//   const tdMatch = html.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
//   if (tdMatch && tdMatch[index]) {
//     return stripHtml(tdMatch[index]);
//   }
//   return '';
// }

// HTML 태그 제거
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// 특정 시도의 데이터 수집
export async function collectByRegion(
  sourceId: string,
  sidoName: string,
  onProgress?: (progress: CollectionProgress) => void,
  abortSignal?: AbortSignal,
  establishmentFilter?: string[] // 설립유형 필터 (예: ['사립'])
): Promise<CollectedOrganization[]> {
  const source = PUBLIC_DATA_SOURCES.find((s) => s.id === sourceId);
  if (!source || !source.enabled) {
    throw new Error(`지원하지 않는 데이터 소스: ${sourceId}`);
  }

  // 대학은 전국 한 번에 수집 (시도 필터링 후 반환)
  if (sourceId === 'university') {
    onProgress?.({
      source: sourceId,
      status: 'collecting',
      currentRegion: sidoName,
      collected: 0,
      total: 1,
      message: `${source.name} 수집 중...`,
    });

    // 전국 데이터 수집 후 시도별 필터링
    const allUniversities = await fetchUniversities(abortSignal, establishmentFilter);

    // 시도 필터링 (전국이 아닌 경우)
    const results = sidoName === '전국'
      ? allUniversities
      : allUniversities.filter(u => u.region.includes(sidoName));

    onProgress?.({
      source: sourceId,
      status: 'done',
      collected: results.length,
      total: 1,
      message: `${sidoName} 수집 완료: ${results.length}개`,
    });

    return results;
  }

  // 초중고는 NEIS API 사용 (시도 단위로 한 번에 수집)
  if (sourceId === 'elementary' || sourceId === 'middle' || sourceId === 'high') {
    onProgress?.({
      source: sourceId,
      status: 'collecting',
      currentRegion: sidoName,
      collected: 0,
      total: 1,
      message: `${sidoName} ${source.name} 수집 중...`,
    });

    const schoolType = sourceId === 'elementary' ? '초등학교' :
                       sourceId === 'middle' ? '중학교' : '고등학교';

    const results = await fetchSchools(sidoName, schoolType, source.apiConfig.key, abortSignal, establishmentFilter);

    onProgress?.({
      source: sourceId,
      status: 'done',
      collected: results.length,
      total: 1,
      message: `${sidoName} 수집 완료: ${results.length}개`,
    });

    return results;
  }

  // 교회는 HTML 스크래핑 (시도 단위)
  if (sourceId === 'church') {
    onProgress?.({
      source: sourceId,
      status: 'collecting',
      currentRegion: sidoName,
      collected: 0,
      total: 1,
      message: `${sidoName} ${source.name} 수집 중... (스크래핑)`,
    });

    const results = await fetchChurches(sidoName, abortSignal);

    onProgress?.({
      source: sourceId,
      status: 'done',
      collected: results.length,
      total: 1,
      message: `${sidoName} 수집 완료: ${results.length}개`,
    });

    return results;
  }

  // 유치원은 기존 방식 (시군구별 수집)
  const sidoCode = source.apiConfig.sidoCodes[sidoName];
  if (!sidoCode) {
    throw new Error(`알 수 없는 시도: ${sidoName}`);
  }

  const sggList = SGG_CODES[sidoCode] || [];
  const allResults: CollectedOrganization[] = [];

  for (let i = 0; i < sggList.length; i++) {
    // 중단 체크
    if (abortSignal?.aborted) {
      throw new Error('사용자에 의해 수집이 중단되었습니다.');
    }

    const sgg = sggList[i];

    onProgress?.({
      source: sourceId,
      status: 'collecting',
      currentRegion: `${sidoName} ${sgg.name}`,
      collected: allResults.length,
      total: sggList.length,
      message: `${sidoName} ${sgg.name} 수집 중... (${i + 1}/${sggList.length})`,
    });

    if (sourceId === 'kindergarten') {
      const results = await fetchKindergartens(sidoCode, sgg.code, undefined, abortSignal);
      allResults.push(...results);
    }

    // 중단 체크 (API 호출 후)
    if (abortSignal?.aborted) {
      throw new Error('사용자에 의해 수집이 중단되었습니다.');
    }

    await delay(200);
  }

  onProgress?.({
    source: sourceId,
    status: 'done',
    collected: allResults.length,
    total: sggList.length,
    message: `${sidoName} 수집 완료: ${allResults.length}개`,
  });

  return allResults;
}

// 전국 데이터 수집 (시도별 즉시 저장 방식) - 중복 체크 및 신규 N개 채우기
export async function collectAll(
  sourceId: string,
  onProgress?: (progress: CollectionProgress) => void,
  onLog?: (log: CollectionLog) => void,
  options?: CollectionOptions,
): Promise<CollectedOrganization[]> {
  const source = PUBLIC_DATA_SOURCES.find((s) => s.id === sourceId);
  if (!source || !source.enabled) {
    throw new Error(`지원하지 않는 데이터 소스: ${sourceId}`);
  }

  const {
    maxItems = 0,
    savePerRegion = true,
    delayBetweenRegions = 1000,
    skipDuplicates = true,
    abortSignal,
    establishmentFilter,
  } = options || {};

  // 취소 체크 함수
  const checkAborted = () => {
    if (abortSignal?.aborted) {
      throw new Error('사용자에 의해 수집이 중단되었습니다.');
    }
  };

  const sidoList = Object.keys(source.apiConfig.sidoCodes);
  const allResults: CollectedOrganization[] = [];
  let totalSaved = 0;
  let totalSkipped = 0;

  const filterInfo = establishmentFilter && establishmentFilter.length > 0
    ? `, 설립유형: ${establishmentFilter.join(', ')}`
    : '';

  onLog?.({
    timestamp: new Date(),
    type: 'info',
    message: `수집 시작: ${source.name}`,
    details: `총 ${sidoList.length}개 시도, 중복 체크: ${skipDuplicates ? '예' : '아니오'}${filterInfo}`,
  });

  // 기존 데이터 조회 (중복 체크용)
  let existingNames = new Set<string>();
  if (skipDuplicates) {
    onLog?.({
      timestamp: new Date(),
      type: 'info',
      message: '기존 데이터 조회 중 (중복 체크용)...',
    });
    existingNames = await getExistingOrganizations();
    onLog?.({
      timestamp: new Date(),
      type: 'success',
      message: `기존 데이터 ${existingNames.size.toLocaleString()}개 확인`,
    });
  }

  // 구글시트 초기화 (시도별 저장 시)
  let sheetId: string | null = null;
  if (savePerRegion) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('구글 로그인이 필요합니다. 상단 헤더에서 로그인해주세요.');
    }
    onLog?.({
      timestamp: new Date(),
      type: 'info',
      message: '구글시트 연결 중...',
    });
    const sheet = await findOrCreateSheet(accessToken, RAW_DATA_SHEET_NAME);
    await ensureRawDataHeaders(accessToken, sheet.id);
    sheetId = sheet.id;
    onLog?.({
      timestamp: new Date(),
      type: 'success',
      message: '구글시트 연결 완료',
      details: `시트 ID: ${sheet.id.slice(0, 20)}...`,
    });
  }

  for (let i = 0; i < sidoList.length; i++) {
    const sidoName = sidoList[i];

    // 취소 체크
    checkAborted();

    // 최대 개수 도달 시 중단 (신규 데이터 기준)
    if (maxItems > 0 && totalSaved >= maxItems) {
      onLog?.({
        timestamp: new Date(),
        type: 'warning',
        message: `신규 ${maxItems}개 수집 완료, 수집 중단`,
        details: `총 처리: ${allResults.length + totalSkipped}개, 중복 건너뜀: ${totalSkipped}개`,
      });
      break;
    }

    onProgress?.({
      source: sourceId,
      status: 'collecting',
      currentRegion: sidoName,
      collected: totalSaved,
      total: maxItems > 0 ? maxItems : sidoList.length,
      message: `${sidoName} 수집 중... (신규 ${totalSaved}/${maxItems || '전체'})`,
    });

    onLog?.({
      timestamp: new Date(),
      type: 'info',
      message: `[${i + 1}/${sidoList.length}] ${sidoName} API 호출 시작`,
    });

    try {
      const results = await collectByRegion(sourceId, sidoName, (subProgress) => {
        onProgress?.({
          ...subProgress,
          collected: totalSaved,
          total: maxItems > 0 ? maxItems : sidoList.length,
        });
      }, abortSignal, establishmentFilter);

      // 중복 필터링
      let newResults: CollectedOrganization[] = [];
      let skippedInRegion = 0;

      if (skipDuplicates) {
        for (const org of results) {
          if (existingNames.has(org.name)) {
            skippedInRegion++;
          } else {
            newResults.push(org);
            existingNames.add(org.name); // 이번 세션에서 수집한 것도 중복 체크에 추가
          }
        }
        totalSkipped += skippedInRegion;
      } else {
        newResults = results;
      }

      // 최대 개수 제한 적용 (신규 데이터 기준)
      if (maxItems > 0) {
        const remaining = maxItems - totalSaved;
        if (newResults.length > remaining) {
          newResults = newResults.slice(0, remaining);
        }
      }

      allResults.push(...newResults);

      const logDetails = skipDuplicates
        ? `신규: ${newResults.length}개, 중복 건너뜀: ${skippedInRegion}개, 홈페이지: ${newResults.filter(r => r.homepage).length}개`
        : `수집: ${newResults.length}개, 홈페이지: ${newResults.filter(r => r.homepage).length}개`;

      onLog?.({
        timestamp: new Date(),
        type: 'success',
        message: `${sidoName} 수집 완료`,
        details: logDetails,
      });

      // 시도별 즉시 저장 (신규 데이터만)
      if (savePerRegion && sheetId && newResults.length > 0) {
        onProgress?.({
          source: sourceId,
          status: 'saving',
          currentRegion: sidoName,
          collected: totalSaved,
          total: maxItems > 0 ? maxItems : sidoList.length,
          message: `${sidoName} 구글시트 저장 중...`,
        });

        onLog?.({
          timestamp: new Date(),
          type: 'saving',
          message: `${sidoName} 신규 데이터 저장 중...`,
          details: `${newResults.length}개 저장 예정`,
        });

        const savedCount = await saveOrganizationsToSheet(sheetId, newResults, source.category);
        totalSaved += savedCount;

        onLog?.({
          timestamp: new Date(),
          type: 'success',
          message: `${sidoName} 저장 완료`,
          details: `${savedCount}개 저장됨 (신규 누적: ${totalSaved}개)`,
        });
      }

      // 지역 간 딜레이 (API 제한 방지)
      if (i < sidoList.length - 1 && !(maxItems > 0 && totalSaved >= maxItems)) {
        onLog?.({
          timestamp: new Date(),
          type: 'info',
          message: `다음 지역 수집 전 ${delayBetweenRegions / 1000}초 대기...`,
        });
        await delay(delayBetweenRegions);
      }

    } catch (error) {
      onLog?.({
        timestamp: new Date(),
        type: 'error',
        message: `${sidoName} 수집 실패`,
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      });
      console.error(`${sidoName} 수집 실패:`, error);
      // 실패해도 다음 지역 계속 수집
    }
  }

  onProgress?.({
    source: sourceId,
    status: 'done',
    collected: totalSaved,
    total: maxItems > 0 ? maxItems : sidoList.length,
    message: `수집 완료: 신규 ${totalSaved}개`,
  });

  const finalDetails = skipDuplicates
    ? `신규 ${totalSaved}개 저장, 중복 ${totalSkipped}개 건너뜀`
    : `총 ${totalSaved}개 저장`;

  onLog?.({
    timestamp: new Date(),
    type: 'success',
    message: `수집 완료!`,
    details: finalDetails,
  });

  return allResults;
}

// 구글시트에 데이터 직접 저장 (내부용)
// 이메일이 포함된 데이터는 이메일데이타 시트에도 자동 저장
async function saveOrganizationsToSheet(
  sheetId: string,
  organizations: CollectedOrganization[],
  category: string,
): Promise<number> {
  const accessToken = getAccessToken();
  if (!accessToken) return 0;

  const today = new Date().toISOString().split('T')[0];

  // 이메일이 있는 데이터 분리
  const orgsWithEmail = organizations.filter(org => org.email && org.email.includes('@'));

  // 원본데이터 저장 행 생성
  // 이메일이 있는 경우: 홈페이지가 없어도 'Y'로 표시 (이미 이메일 추출됨)
  const rows = organizations.map((org) => [
    org.name,
    org.type,
    org.address,
    org.phone,
    org.homepage,
    org.representative,
    org.region,
    category,
    today,
    org.email && org.email.includes('@') ? 'Y' : (org.homepage ? 'N' : '-'),
  ]);

  // 원본데이터 저장
  const response = await fetch(
    `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent('데이터!A:J')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!response.ok) {
    throw new Error('구글시트 저장 실패');
  }

  // 이메일이 있는 데이터는 이메일데이타 시트에도 저장 (배치로 한 번에)
  if (orgsWithEmail.length > 0) {
    console.log(`[이메일 자동 저장] ${orgsWithEmail.length}개 이메일 발견, 이메일데이타V1.0에 배치 저장`);

    const emailBatch = orgsWithEmail.map(org => ({
      name: org.name,
      email: org.email!,
      category,
    }));
    const result = await saveToEmailDataSheetBatch(emailBatch);
    console.log(`[이메일 자동 저장] 완료 (성공: ${result.saved}, 실패: ${result.failed})`);
  }

  return rows.length;
}

// 시도 목록 가져오기
export function getSidoList(sourceId: string): string[] {
  const source = PUBLIC_DATA_SOURCES.find((s) => s.id === sourceId);
  if (!source) return [];
  return Object.keys(source.apiConfig.sidoCodes);
}

// 수집 가능한 데이터 소스 목록
export function getAvailableSources(): PublicDataSource[] {
  return PUBLIC_DATA_SOURCES.filter((s) => s.enabled);
}

// ============================================
// 구글 시트 연동 (원본데이터 저장)
// ============================================

interface SheetFile {
  id: string;
  name: string;
}

// 구글 드라이브에서 시트 파일 찾기 또는 생성
async function findOrCreateSheet(accessToken: string, sheetName: string): Promise<SheetFile> {
  // 먼저 기존 시트 찾기
  const query = encodeURIComponent(
    `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const searchResponse = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.files && data.files.length > 0) {
      console.log(`[구글시트] '${sheetName}' 시트 발견:`, data.files[0].id);
      return data.files[0];
    }
  }

  // 시트가 없으면 새로 생성
  console.log(`[구글시트] '${sheetName}' 시트 생성 중...`);
  const createResponse = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: sheetName },
      sheets: [
        {
          properties: { title: '데이터' },
        },
      ],
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(`시트 생성 실패: ${error.error?.message || createResponse.statusText}`);
  }

  const newSheet = await createResponse.json();
  console.log(`[구글시트] '${sheetName}' 시트 생성 완료:`, newSheet.spreadsheetId);
  return { id: newSheet.spreadsheetId, name: sheetName };
}

// 기존 데이터의 단체명 목록 조회 (중복 체크용)
async function getExistingNames(accessToken: string, spreadsheetId: string): Promise<Set<string>> {
  try {
    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent('데이터!A:A')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return new Set();
    }

    const data = await response.json();
    const rows = data.values || [];
    const names = new Set<string>();

    // 헤더 제외하고 단체명 수집
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0]) {
        names.add(rows[i][0]);
      }
    }

    return names;
  } catch {
    return new Set();
  }
}

// 원본데이터 시트에 헤더 추가
async function ensureRawDataHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  // 헤더 확인
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent('데이터!A1:J1')}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (response.ok) {
    const data = await response.json();
    if (data.values && data.values.length > 0) {
      return; // 헤더가 이미 있음
    }
  }

  // 헤더 추가
  await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent('데이터!A1:J1')}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['단체명', '설립유형', '주소', '전화번호', '홈페이지', '대표자', '관할구역', '분류', '수집일', '이메일추출상태']],
      }),
    }
  );
  console.log('[구글시트] 원본데이터 헤더 추가됨');
}

// 원본데이터 시트에 데이터 저장 (중복 제거)
export async function saveToRawDataSheet(
  organizations: CollectedOrganization[],
  category: string,
  onProgress?: (message: string) => void
): Promise<{ saved: number; skipped: number; sheetId: string }> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('구글 로그인이 필요합니다.');
  }

  onProgress?.('구글 시트 연결 중...');
  const sheet = await findOrCreateSheet(accessToken, RAW_DATA_SHEET_NAME);
  await ensureRawDataHeaders(accessToken, sheet.id);

  // 기존 데이터의 단체명 목록 조회 (중복 체크용)
  onProgress?.('기존 데이터 확인 중...');
  const existingNames = await getExistingNames(accessToken, sheet.id);
  const existingCount = existingNames.size;

  // 중복 제거
  const newOrganizations = organizations.filter(org => !existingNames.has(org.name));
  const skippedCount = organizations.length - newOrganizations.length;

  if (skippedCount > 0) {
    console.log(`[중복 체크] 기존 ${existingCount}개 중 ${skippedCount}개 중복 건너뜀`);
    onProgress?.(`중복 ${skippedCount}개 제외, ${newOrganizations.length}개 저장 예정`);
  }

  // 이메일이 있는 데이터 분리
  const orgsWithEmail = newOrganizations.filter(org => org.email && org.email.includes('@'));

  // 데이터 행 생성
  // 이메일이 있는 경우: 홈페이지가 없어도 'Y'로 표시 (이미 이메일 추출됨)
  const today = new Date().toISOString().split('T')[0];
  const rows = newOrganizations.map((org) => [
    org.name,
    org.type,
    org.address,
    org.phone,
    org.homepage,
    org.representative,
    org.region,
    category,
    today,
    org.email && org.email.includes('@') ? 'Y' : (org.homepage ? 'N' : '-'),
  ]);

  if (rows.length === 0) {
    return { saved: 0, skipped: skippedCount, sheetId: sheet.id };
  }

  // 배치 처리 (1000개씩)
  const BATCH_SIZE = 1000;
  let savedCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    onProgress?.(`구글 시트에 저장 중... (${i + 1}~${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length})`);

    const response = await fetch(
      `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent('데이터!A:J')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: batch }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`시트 저장 실패: ${error.error?.message || response.statusText}`);
    }

    savedCount += batch.length;
    await delay(100); // API 제한 방지
  }

  // 이메일이 있는 데이터는 이메일데이타 시트에도 저장 (배치로 한 번에)
  if (orgsWithEmail.length > 0) {
    onProgress?.(`이메일 ${orgsWithEmail.length}개 자동 저장 중...`);
    console.log(`[이메일 자동 저장] ${orgsWithEmail.length}개 이메일 발견, 이메일데이타V1.0에 배치 저장`);

    const emailBatch = orgsWithEmail.map(org => ({
      name: org.name,
      email: org.email!,
      category,
    }));
    const result = await saveToEmailDataSheetBatch(emailBatch);
    console.log(`[이메일 자동 저장] 완료 (성공: ${result.saved}, 실패: ${result.failed})`);
  }

  console.log(`[구글시트] 원본데이터 ${savedCount}개 저장 완료 (중복 ${skippedCount}개 제외)`);
  return { saved: savedCount, skipped: skippedCount, sheetId: sheet.id };
}

// 원본데이터에서 크롤링 대상 조회 (홈페이지 있고 이메일 미추출)
export async function getCrawlTargets(categoryFilter?: string | string[]): Promise<
  Array<{ rowIndex: number; name: string; homepage: string; category: string }>
> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('구글 로그인이 필요합니다.');
  }

  const sheet = await findOrCreateSheet(accessToken, RAW_DATA_SHEET_NAME);

  const response = await fetch(
    `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent('데이터!A:J')}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error('원본데이터 조회 실패');
  }

  const data = await response.json();
  const rows = data.values || [];
  const targets: Array<{ rowIndex: number; name: string; homepage: string; category: string }> = [];

  // 카테고리 필터 배열로 변환
  const filterCategories = categoryFilter
    ? Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter]
    : null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const homepage = row[4]; // E열: 홈페이지
    const category = row[7]; // H열: 분류
    const extractStatus = row[9]; // J열: 이메일추출상태

    // 홈페이지가 있고, 상태가 N(미추출)인 경우만
    if (homepage && extractStatus === 'N') {
      // 카테고리 필터 적용
      if (filterCategories && !filterCategories.includes(category)) {
        continue;
      }
      targets.push({
        rowIndex: i + 1, // 1-based
        name: row[0],
        homepage,
        category,
      });
    }
  }

  return targets;
}

// 이메일 추출 상태 업데이트
export async function updateExtractStatus(
  rowIndex: number,
  status: 'Y' | 'F' | 'N', // Y: 성공, F: 실패, N: 미추출
  sheetId?: string
): Promise<void> {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  const sheet = sheetId
    ? { id: sheetId }
    : await findOrCreateSheet(accessToken, RAW_DATA_SHEET_NAME);

  await fetch(
    `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent(`데이터!J${rowIndex}`)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [[status]] }),
    }
  );
}

// 실패 상태 초기화 (F -> N)
export async function resetFailedStatus(): Promise<number> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('구글 로그인이 필요합니다.');
  }

  const sheet = await findOrCreateSheet(accessToken, RAW_DATA_SHEET_NAME);

  // 전체 데이터 조회
  const response = await fetch(
    `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent('데이터!A:J')}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error('원본데이터 조회 실패');
  }

  const data = await response.json();
  const rows = data.values || [];
  let resetCount = 0;

  // F 상태인 행 찾아서 N으로 변경
  for (let i = 1; i < rows.length; i++) {
    const extractStatus = rows[i][9]; // J열: 이메일추출상태

    if (extractStatus === 'F') {
      await fetch(
        `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent(`데이터!J${i + 1}`)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [['N']] }),
        }
      );
      resetCount++;
      await delay(50); // API 제한 방지
    }
  }

  return resetCount;
}

// 이메일데이터 시트에 저장
export async function saveToEmailDataSheet(
  name: string,
  email: string,
  category: string
): Promise<void> {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  const sheet = await findOrCreateSheet(accessToken, EMAIL_DATA_SHEET_NAME);

  // 헤더 확인 및 추가
  const headerResponse = await fetch(
    `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent('A1:C1')}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (headerResponse.ok) {
    const headerData = await headerResponse.json();
    if (!headerData.values || headerData.values.length === 0) {
      await fetch(
        `${SHEETS_API_BASE}/${sheet.id}/values/A1:C1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [['단체명', '이메일', '분류']] }),
        }
      );
    }
  }

  // 데이터 추가
  const response = await fetch(
    `${SHEETS_API_BASE}/${sheet.id}/values/A:C:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [[name, email, category]] }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || response.statusText;
    console.error(`[이메일 시트 저장 실패] ${response.status}: ${errorMsg}`);
    throw new Error(`이메일 시트 저장 실패: ${errorMsg}`);
  }
}

// 이메일 배치 저장 (여러 건을 한 번에 저장 - 속도 개선)
export async function saveToEmailDataSheetBatch(
  emails: Array<{ name: string; email: string; category: string }>
): Promise<{ saved: number; failed: number }> {
  if (emails.length === 0) {
    return { saved: 0, failed: 0 };
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    return { saved: 0, failed: emails.length };
  }

  const sheet = await findOrCreateSheet(accessToken, EMAIL_DATA_SHEET_NAME);

  // 헤더 확인 및 추가 (한 번만)
  const headerResponse = await fetch(
    `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent('A1:C1')}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (headerResponse.ok) {
    const headerData = await headerResponse.json();
    if (!headerData.values || headerData.values.length === 0) {
      await fetch(
        `${SHEETS_API_BASE}/${sheet.id}/values/A1:C1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [['단체명', '이메일', '분류']] }),
        }
      );
    }
  }

  // 모든 이메일을 한 번에 저장
  const rows = emails.map(e => [e.name, e.email, e.category]);

  const response = await fetch(
    `${SHEETS_API_BASE}/${sheet.id}/values/A:C:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || response.statusText;
    console.error(`[이메일 배치 저장 실패] ${response.status}: ${errorMsg}`);
    return { saved: 0, failed: emails.length };
  }

  console.log(`[이메일 배치 저장] ${emails.length}개 한 번에 저장 완료`);
  return { saved: emails.length, failed: 0 };
}

// 카테고리별 통계 타입
export interface CategoryStats {
  category: string;
  total: number;
  withHomepage: number;
  extracted: number;
  pending: number;
  failed: number;
}

// 원본데이터 통계 조회 (카테고리별 통계 포함)
export async function getRawDataStats(): Promise<{
  total: number;
  withHomepage: number;
  extracted: number;
  pending: number;
  failed: number;
  byCategory: CategoryStats[];
}> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return { total: 0, withHomepage: 0, extracted: 0, pending: 0, failed: 0, byCategory: [] };
  }

  try {
    const sheet = await findOrCreateSheet(accessToken, RAW_DATA_SHEET_NAME);

    const response = await fetch(
      `${SHEETS_API_BASE}/${sheet.id}/values/${encodeURIComponent('데이터!A:J')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return { total: 0, withHomepage: 0, extracted: 0, pending: 0, failed: 0, byCategory: [] };
    }

    const data = await response.json();
    const rows = data.values || [];
    if (rows.length <= 1) {
      return { total: 0, withHomepage: 0, extracted: 0, pending: 0, failed: 0, byCategory: [] };
    }

    let withHomepage = 0;
    let extracted = 0;
    let pending = 0;
    let failed = 0;

    // 카테고리별 통계를 위한 맵
    const categoryMap: Map<string, CategoryStats> = new Map();

    for (let i = 1; i < rows.length; i++) {
      const homepage = rows[i][4];
      const category = rows[i][7] || '미분류';
      const status = rows[i][9];

      // 카테고리별 통계 초기화
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          total: 0,
          withHomepage: 0,
          extracted: 0,
          pending: 0,
          failed: 0,
        });
      }
      const catStats = categoryMap.get(category)!;
      catStats.total++;

      if (homepage) {
        withHomepage++;
        catStats.withHomepage++;
        if (status === 'Y') {
          extracted++;
          catStats.extracted++;
        } else if (status === 'N') {
          pending++;
          catStats.pending++;
        } else if (status === 'F') {
          failed++;
          catStats.failed++;
        }
      }
    }

    // 카테고리별 통계 배열로 변환 (pending이 많은 순서로 정렬)
    const byCategory = Array.from(categoryMap.values())
      .filter(cat => cat.pending > 0) // 크롤링 대기가 있는 카테고리만
      .sort((a, b) => b.pending - a.pending);

    return {
      total: rows.length - 1,
      withHomepage,
      extracted,
      pending,
      failed,
      byCategory,
    };
  } catch {
    return { total: 0, withHomepage: 0, extracted: 0, pending: 0, failed: 0, byCategory: [] };
  }
}
