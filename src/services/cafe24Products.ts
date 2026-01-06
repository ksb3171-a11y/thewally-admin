// 카페24 상품 연동 서비스 (더미 데이터)

export interface Product {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  imageUrl: string;
  category: {
    large: string;
    medium: string;
    small: string;
  };
  description: string;
  features: string[]; // 소구점
}

export interface ProductCategory {
  large: string;
  medium: string[];
  small: Record<string, string[]>;
}

// 카테고리 구조
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    large: '의류',
    medium: ['티셔츠', '후드/맨투맨', '아우터', '유니폼'],
    small: {
      '티셔츠': ['반팔티', '긴팔티', '폴로티'],
      '후드/맨투맨': ['후드티', '맨투맨', '후드집업'],
      '아우터': ['점퍼', '바람막이', '패딩'],
      '유니폼': ['단체복', '조끼', '작업복'],
    },
  },
  {
    large: '가방/잡화',
    medium: ['에코백', '파우치', '백팩', '모자'],
    small: {
      '에코백': ['코튼백', '캔버스백', '숄더백'],
      '파우치': ['화장품파우치', '여행파우치', '필통'],
      '백팩': ['캐주얼백팩', '노트북백팩', '등산백팩'],
      '모자': ['볼캡', '버킷햇', '비니'],
    },
  },
  {
    large: '사무용품',
    medium: ['필기구', '노트/다이어리', '데스크용품'],
    small: {
      '필기구': ['볼펜', '샤프', '형광펜세트'],
      '노트/다이어리': ['스프링노트', '양장노트', '다이어리'],
      '데스크용품': ['펜꽂이', '마우스패드', '메모보드'],
    },
  },
  {
    large: '텀블러/머그',
    medium: ['텀블러', '머그컵', '보온병'],
    small: {
      '텀블러': ['스테인리스텀블러', '플라스틱텀블러', '이중진공텀블러'],
      '머그컵': ['도자기머그', '스테인리스머그', '감열머그'],
      '보온병': ['미니보온병', '대용량보온병', '스포츠보온병'],
    },
  },
];

// 더미 상품 데이터
const DUMMY_PRODUCTS: Product[] = [
  // 의류 - 티셔츠
  {
    id: 'prod-001',
    name: '프리미엄 면 반팔티',
    price: 15000,
    salePrice: 12000,
    imageUrl: 'https://via.placeholder.com/200x200?text=반팔티',
    category: { large: '의류', medium: '티셔츠', small: '반팔티' },
    description: '부드러운 코튼 100% 소재의 프리미엄 반팔티',
    features: ['코튼100%', '단체주문할인', '다양한컬러'],
  },
  {
    id: 'prod-002',
    name: '드라이핏 긴팔티',
    price: 18000,
    imageUrl: 'https://via.placeholder.com/200x200?text=긴팔티',
    category: { large: '의류', medium: '티셔츠', small: '긴팔티' },
    description: '땀 흡수가 빠른 기능성 긴팔티',
    features: ['기능성소재', '빠른건조', '체온유지'],
  },
  {
    id: 'prod-003',
    name: '클래식 폴로티',
    price: 25000,
    salePrice: 20000,
    imageUrl: 'https://via.placeholder.com/200x200?text=폴로티',
    category: { large: '의류', medium: '티셔츠', small: '폴로티' },
    description: '격식있는 자리에 어울리는 클래식 폴로티',
    features: ['고급스러운디자인', '비즈니스캐주얼', '내구성좋음'],
  },
  // 의류 - 후드/맨투맨
  {
    id: 'prod-004',
    name: '오버핏 후드티',
    price: 35000,
    imageUrl: 'https://via.placeholder.com/200x200?text=후드티',
    category: { large: '의류', medium: '후드/맨투맨', small: '후드티' },
    description: '편안한 착용감의 오버핏 후드티',
    features: ['트렌디한핏', '기모안감', '커스텀자수가능'],
  },
  {
    id: 'prod-005',
    name: '베이직 맨투맨',
    price: 28000,
    salePrice: 22000,
    imageUrl: 'https://via.placeholder.com/200x200?text=맨투맨',
    category: { large: '의류', medium: '후드/맨투맨', small: '맨투맨' },
    description: '데일리로 입기 좋은 베이직 맨투맨',
    features: ['사계절착용', '10컬러이상', '로고인쇄가능'],
  },
  // 가방/잡화 - 에코백
  {
    id: 'prod-006',
    name: '캔버스 에코백',
    price: 8000,
    salePrice: 6000,
    imageUrl: 'https://via.placeholder.com/200x200?text=에코백',
    category: { large: '가방/잡화', medium: '에코백', small: '코튼백' },
    description: '친환경 캔버스 소재의 에코백',
    features: ['친환경소재', '대용량', '풀컬러인쇄'],
  },
  {
    id: 'prod-007',
    name: '숄더 캔버스백',
    price: 12000,
    imageUrl: 'https://via.placeholder.com/200x200?text=숄더백',
    category: { large: '가방/잡화', medium: '에코백', small: '숄더백' },
    description: '숄더스트랩이 있는 편리한 캔버스백',
    features: ['어깨끈조절', '포켓내장', '튼튼한봉제'],
  },
  // 가방/잡화 - 파우치
  {
    id: 'prod-008',
    name: '다용도 파우치',
    price: 5000,
    imageUrl: 'https://via.placeholder.com/200x200?text=파우치',
    category: { large: '가방/잡화', medium: '파우치', small: '화장품파우치' },
    description: '화장품, 소지품 정리에 딱 좋은 파우치',
    features: ['방수코팅', '지퍼수납', '컴팩트사이즈'],
  },
  // 사무용품 - 필기구
  {
    id: 'prod-009',
    name: '프리미엄 볼펜세트',
    price: 3000,
    salePrice: 2500,
    imageUrl: 'https://via.placeholder.com/200x200?text=볼펜',
    category: { large: '사무용품', medium: '필기구', small: '볼펜' },
    description: '부드러운 필기감의 프리미엄 볼펜',
    features: ['부드러운필기감', '로고각인', '고급케이스'],
  },
  {
    id: 'prod-010',
    name: '스프링 노트',
    price: 4000,
    imageUrl: 'https://via.placeholder.com/200x200?text=노트',
    category: { large: '사무용품', medium: '노트/다이어리', small: '스프링노트' },
    description: '메모하기 좋은 실용적인 스프링노트',
    features: ['80매내지', '표지커스텀', '친환경용지'],
  },
  // 텀블러/머그
  {
    id: 'prod-011',
    name: '스테인리스 텀블러',
    price: 15000,
    salePrice: 12000,
    imageUrl: 'https://via.placeholder.com/200x200?text=텀블러',
    category: { large: '텀블러/머그', medium: '텀블러', small: '스테인리스텀블러' },
    description: '보온보냉 효과가 뛰어난 스테인리스 텀블러',
    features: ['이중진공', '12시간보온', '레이저각인'],
  },
  {
    id: 'prod-012',
    name: '도자기 머그컵',
    price: 8000,
    imageUrl: 'https://via.placeholder.com/200x200?text=머그컵',
    category: { large: '텀블러/머그', medium: '머그컵', small: '도자기머그' },
    description: '따뜻한 느낌의 도자기 머그컵',
    features: ['전사인쇄', '식기세척기OK', '다양한용량'],
  },
  // 추가 상품들
  {
    id: 'prod-013',
    name: '방수 바람막이',
    price: 45000,
    salePrice: 38000,
    imageUrl: 'https://via.placeholder.com/200x200?text=바람막이',
    category: { large: '의류', medium: '아우터', small: '바람막이' },
    description: '가벼우면서 방수기능이 있는 바람막이',
    features: ['방수코팅', '초경량', '접이식수납'],
  },
  {
    id: 'prod-014',
    name: '단체 조끼',
    price: 22000,
    imageUrl: 'https://via.placeholder.com/200x200?text=조끼',
    category: { large: '의류', medium: '유니폼', small: '조끼' },
    description: '행사용 단체조끼',
    features: ['즉시인쇄', '10장이상할인', '다양한컬러'],
  },
  {
    id: 'prod-015',
    name: '노트북 백팩',
    price: 35000,
    imageUrl: 'https://via.placeholder.com/200x200?text=백팩',
    category: { large: '가방/잡화', medium: '백팩', small: '노트북백팩' },
    description: '15인치 노트북이 들어가는 실용적인 백팩',
    features: ['노트북수납', '방수소재', 'USB충전포트'],
  },
];

// 대분류 목록 가져오기
export const getLargeCategories = (): string[] => {
  return PRODUCT_CATEGORIES.map((c) => c.large);
};

// 중분류 목록 가져오기
export const getMediumCategories = (large: string): string[] => {
  const category = PRODUCT_CATEGORIES.find((c) => c.large === large);
  return category ? category.medium : [];
};

// 소분류 목록 가져오기
export const getSmallCategories = (large: string, medium: string): string[] => {
  const category = PRODUCT_CATEGORIES.find((c) => c.large === large);
  return category?.small[medium] || [];
};

// 상품 목록 가져오기 (카테고리 필터링)
export const getProducts = (
  large?: string,
  medium?: string,
  small?: string
): Product[] => {
  let products = [...DUMMY_PRODUCTS];

  if (large) {
    products = products.filter((p) => p.category.large === large);
  }
  if (medium) {
    products = products.filter((p) => p.category.medium === medium);
  }
  if (small) {
    products = products.filter((p) => p.category.small === small);
  }

  return products;
};

// 상품 ID로 가져오기
export const getProductById = (id: string): Product | undefined => {
  return DUMMY_PRODUCTS.find((p) => p.id === id);
};

// 가격 포맷팅
export const formatPrice = (price: number): string => {
  return price.toLocaleString('ko-KR') + '원';
};
