// Cafe24 상품 크롤링 서비스
// 웹 크롤링을 통해 상품 정보를 자동 수집합니다

// 환경변수에서 Mall ID 가져오기
const CAFE24_MALL_ID = import.meta.env.VITE_CAFE24_MALL_ID || 'cheritale25';

export interface SavedProduct {
  id: string;
  url: string;
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
  features: string[];
  scrapedAt: string;
}

// 로컬 스토리지 키
const SAVED_PRODUCTS_KEY = 'cafe24_saved_products';

// Mall ID 설정 확인
export const hasMallConfig = (): boolean => {
  return !!CAFE24_MALL_ID;
};

// Mall ID 가져오기
export const getMallId = (): string => {
  return CAFE24_MALL_ID;
};

// 저장된 상품 목록 불러오기
export const getSavedProducts = (): SavedProduct[] => {
  try {
    const data = localStorage.getItem(SAVED_PRODUCTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// 저장된 상품 목록 저장
export const setSavedProducts = (products: SavedProduct[]): void => {
  localStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(products));
};

// 상품 추가
export const addSavedProduct = (product: SavedProduct): void => {
  const products = getSavedProducts();
  const existingIndex = products.findIndex(p => p.id === product.id);
  if (existingIndex >= 0) {
    products[existingIndex] = product;
  } else {
    products.push(product);
  }
  setSavedProducts(products);
};

// 상품 삭제
export const removeSavedProduct = (productId: string): void => {
  const products = getSavedProducts();
  const filtered = products.filter(p => p.id !== productId);
  setSavedProducts(filtered);
};

// 설정 초기화
export const clearCafe24Config = (): void => {
  localStorage.removeItem(SAVED_PRODUCTS_KEY);
};

// 서버 상태 확인
export const checkServerStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/cafe24/status');
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
};

// 크롤링으로 전체 상품 자동 수집
export const autoFetchProducts = async (
  onProgress?: (message: string) => void
): Promise<SavedProduct[]> => {
  onProgress?.('서버에 연결 중...');

  const response = await fetch('/api/cafe24/products');

  if (!response.ok) {
    throw new Error('상품 수집에 실패했습니다. 서버를 확인해주세요.');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || '상품 수집에 실패했습니다.');
  }

  onProgress?.(`${data.count}개의 상품을 변환 중...`);

  // 크롤링 결과를 SavedProduct 형식으로 변환
  const products: SavedProduct[] = data.products.map((p: {
    id: string;
    name: string;
    price: number;
    salePrice?: number;
    imageUrl: string;
    url: string;
    category?: { large: string; medium: string; small: string } | string;
  }) => ({
    id: p.id,
    url: p.url,
    name: p.name,
    price: p.price,
    salePrice: p.salePrice,
    imageUrl: p.imageUrl,
    category: typeof p.category === 'object' ? p.category : {
      large: p.category || '',
      medium: '',
      small: '',
    },
    description: '',
    features: [],
    scrapedAt: new Date().toISOString(),
  }));

  // 저장
  setSavedProducts(products);
  onProgress?.('완료!');

  return products;
};

// 단일 상품 스크래핑
export const scrapeProduct = async (productUrl: string): Promise<{
  name: string;
  price: number;
  salePrice?: number;
  imageUrls: string[];
  description?: string;
}> => {
  const response = await fetch('/api/cafe24/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productUrl }),
  });

  if (!response.ok) {
    throw new Error('상품 정보를 가져오는데 실패했습니다.');
  }

  return response.json();
};

// URL에서 상품 ID 추출
export const extractProductIdFromUrl = (url: string): string => {
  const match = url.match(/\/product\/[^/]+\/(\d+)/) || url.match(/product_no=(\d+)/) || url.match(/\/(\d+)/);
  if (match) return match[1];
  return `product-${Date.now()}`;
};

// 가격 포맷팅
export const formatPrice = (price: number): string => {
  return price.toLocaleString('ko-KR') + '원';
};

// Product를 앱 내부 형식으로 변환
export interface AppProduct {
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
  features: string[];
}

export const convertToAppProduct = (savedProduct: SavedProduct): AppProduct => {
  return {
    id: savedProduct.id,
    name: savedProduct.name,
    price: savedProduct.price,
    salePrice: savedProduct.salePrice,
    imageUrl: savedProduct.imageUrl,
    category: savedProduct.category,
    description: savedProduct.description,
    features: savedProduct.features,
  };
};
