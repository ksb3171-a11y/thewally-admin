# 내 가계부 (Budget App)

개인 수입/지출을 관리하는 웹 기반 가계부 애플리케이션입니다.

## 주요 기능

- **3단계 카테고리 시스템**: 대분류(수입/지출) > 중분류 > 소분류 계층 구조
- **Google Drive 동기화**: Google 계정으로 로그인하면 여러 기기에서 데이터 동기화
- **오프라인 지원**: LocalStorage를 활용하여 오프라인에서도 사용 가능
- **대시보드 분석**: 월별 수입/지출 분석 및 차트 제공
- **다크 모드**: 시스템 설정에 따른 자동 다크 모드 지원
- **반응형 디자인**: 모바일/태블릿/데스크톱 모든 환경에서 사용 가능

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Authentication**: Google OAuth 2.0 (@react-oauth/google)
- **Cloud Storage**: Google Drive API

## 설치 및 실행

### 1. 의존성 설치

```bash
cd budget-app
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 Google OAuth Client ID를 설정합니다:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
```

### 3. Google Cloud Console 설정

Google Drive 동기화 기능을 사용하려면 Google Cloud Console에서 프로젝트를 설정해야 합니다:

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **API 및 서비스 > 라이브러리**에서 다음 API 활성화:
   - Google Drive API
4. **API 및 서비스 > 사용자 인증 정보**에서:
   - "사용자 인증 정보 만들기" > "OAuth 클라이언트 ID" 선택
   - 애플리케이션 유형: "웹 애플리케이션"
   - 승인된 JavaScript 원본: `http://localhost:5173` (개발용)
   - 승인된 리디렉션 URI: `http://localhost:5173` (개발용)
5. **OAuth 동의 화면** 설정:
   - 사용자 유형: 외부
   - 앱 정보 입력
   - 범위 추가: `https://www.googleapis.com/auth/drive.file`
   - 테스트 사용자 추가 (개발 단계에서 필요)

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

### 5. 프로덕션 빌드

```bash
npm run build
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

## 사용 방법

### 로그인 없이 사용

앱 시작 시 "로그인 없이 시작하기"를 선택하면 로컬에서만 데이터가 저장됩니다.

### Google 계정으로 로그인

Google 계정으로 로그인하면:
- 데이터가 Google Drive에 자동 동기화됩니다
- 변경 후 5초 후 자동 동기화
- 10분마다 백그라운드 동기화
- 앱 종료 시 미동기화 데이터 자동 저장

### 카테고리 관리

설정 페이지에서 중분류/소분류를 추가, 수정, 삭제할 수 있습니다.

### 데이터 백업

설정 페이지에서 JSON 파일로 데이터를 내보내거나 가져올 수 있습니다.

## 프로젝트 구조

```
src/
├── components/
│   ├── auth/           # Google 로그인 관련 컴포넌트
│   ├── category/       # 카테고리 선택/관리 컴포넌트
│   ├── charts/         # 차트 컴포넌트 (Recharts)
│   ├── common/         # 공통 UI 컴포넌트
│   ├── dashboard/      # 대시보드 컴포넌트
│   ├── settings/       # 설정 페이지
│   └── transaction/    # 거래 입력/목록 컴포넌트
├── contexts/           # React Context (Auth, Data)
├── services/           # 외부 서비스 연동 (localStorage, Google API)
├── types/              # TypeScript 타입 정의
└── utils/              # 유틸리티 함수
```

## 기본 카테고리

### 지출 카테고리
- 주거비: 월세, 관리비, 수도/전기/가스
- 식비: 장보기, 외식, 배달음식, 카페/음료
- 교통비: 대중교통, 주유비, 주차비, 택시
- 통신비: 휴대폰요금, 인터넷요금
- 프로그램구독: 기타구독
- 의료/건강: 병원비, 약값, 헬스장
- 여가/문화: 영화/공연, 취미활동, 여행
- 쇼핑: 의류, 전자기기, 생활용품
- 교육: 강의/수업, 도서, 학원비
- 금융: 대출이자, 보험료
- 경조사: 축의금, 조의금, 선물
- 기타지출: 기타

### 수입 카테고리
- 근로소득: 월급, 상여금, 성과급
- 부업소득: 프리랜서, 알바, 원고료
- 투자수익: 주식배당, 이자수익, 부동산임대
- 기타수입: 용돈, 환급금, 중고판매
- 비정기수입: 보너스, 상금

## 라이선스

MIT License
