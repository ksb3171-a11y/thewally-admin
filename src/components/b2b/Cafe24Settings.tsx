import { useState, useEffect, useCallback } from 'react';
import {
  type SavedProduct,
  hasMallConfig,
  getMallId,
  getSavedProducts,
  setSavedProducts,
  addSavedProduct,
  removeSavedProduct,
  clearCafe24Config,
  autoFetchProducts,
  checkServerStatus,
  formatPrice,
} from '../../services/cafe24Api';

interface Cafe24SettingsProps {
  onConnectionChange?: (connected: boolean) => void;
}

export const Cafe24Settings = ({ onConnectionChange }: Cafe24SettingsProps) => {
  // 설정 상태
  const [hasConfig] = useState(() => hasMallConfig());
  const [mallId] = useState(() => getMallId());

  // 서버 상태
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // 상품 상태
  const [savedProducts, setSavedProductsState] = useState<SavedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  // 메시지
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // 편집 모드 상태
  const [editingProduct, setEditingProduct] = useState<SavedProduct | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    price: 0,
    salePrice: 0,
    description: '',
    features: '',
    categoryLarge: '',
  });

  // 저장된 상품 로드 및 서버 상태 확인
  useEffect(() => {
    const products = getSavedProducts();
    setSavedProductsState(products);
    onConnectionChange?.(products.length > 0);

    // 서버 상태 확인
    checkServerStatus().then(setServerOnline);
  }, [onConnectionChange]);

  // 프로그램 시작 시 자동 수집 (서버가 온라인이고 저장된 상품이 없을 때)
  useEffect(() => {
    if (serverOnline && savedProducts.length === 0 && !isLoading) {
      handleAutoFetch(false);
    }
  }, [serverOnline]);

  // 자동 상품 수집
  const handleAutoFetch = useCallback(async (showMessage = true) => {
    setIsLoading(true);
    setProgressMessage('');
    if (showMessage) setMessage(null);

    try {
      const products = await autoFetchProducts((msg) => {
        setProgressMessage(msg);
      });

      setSavedProductsState(products);
      onConnectionChange?.(products.length > 0);
      if (showMessage) {
        setMessage({
          type: 'success',
          text: `${products.length}개의 상품을 성공적으로 가져왔습니다!`,
        });
      }
    } catch (error) {
      if (showMessage) {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : '상품을 가져오는데 실패했습니다.',
        });
      }
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  }, [onConnectionChange]);

  // 수동 상품 추가
  const handleAddManualProduct = () => {
    const newProduct: SavedProduct = {
      id: `manual-${Date.now()}`,
      url: '',
      name: '',
      price: 0,
      imageUrl: 'https://via.placeholder.com/200x200?text=No+Image',
      category: { large: '', medium: '', small: '' },
      description: '',
      features: [],
      scrapedAt: new Date().toISOString(),
    };

    setEditingProduct(newProduct);
    setEditForm({
      name: '',
      price: 0,
      salePrice: 0,
      description: '',
      features: '',
      categoryLarge: '',
    });
  };

  // 상품 저장
  const handleSaveProduct = () => {
    if (!editingProduct) return;

    if (!editForm.name || editForm.price <= 0) {
      setMessage({ type: 'error', text: '상품명과 가격을 입력해주세요.' });
      return;
    }

    const updatedProduct: SavedProduct = {
      ...editingProduct,
      name: editForm.name,
      price: editForm.price,
      salePrice: editForm.salePrice || undefined,
      description: editForm.description,
      features: editForm.features.split(',').map(f => f.trim()).filter(Boolean),
      category: {
        large: editForm.categoryLarge,
        medium: '',
        small: '',
      },
    };

    addSavedProduct(updatedProduct);
    const products = getSavedProducts();
    setSavedProductsState(products);
    setEditingProduct(null);
    onConnectionChange?.(products.length > 0);
    setMessage({ type: 'success', text: '상품이 저장되었습니다.' });
  };

  // 상품 삭제
  const handleDeleteProduct = (productId: string) => {
    if (window.confirm('이 상품을 삭제하시겠습니까?')) {
      removeSavedProduct(productId);
      const products = getSavedProducts();
      setSavedProductsState(products);
      onConnectionChange?.(products.length > 0);
      setMessage({ type: 'info', text: '상품이 삭제되었습니다.' });
    }
  };

  // 상품 편집
  const handleEditProduct = (product: SavedProduct) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      price: product.price,
      salePrice: product.salePrice || 0,
      description: product.description,
      features: product.features.join(', '),
      categoryLarge: product.category.large,
    });
  };

  // 설정 초기화
  const handleClear = () => {
    if (window.confirm('저장된 모든 상품을 초기화하시겠습니까?')) {
      clearCafe24Config();
      setSavedProductsState([]);
      setEditingProduct(null);
      onConnectionChange?.(false);
      setMessage({ type: 'info', text: '설정이 초기화되었습니다.' });
    }
  };

  // 전체 상품 삭제
  const handleClearProducts = () => {
    if (window.confirm('저장된 모든 상품을 삭제하시겠습니까?')) {
      setSavedProducts([]);
      setSavedProductsState([]);
      onConnectionChange?.(false);
      setMessage({ type: 'info', text: '모든 상품이 삭제되었습니다.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* 연동 상태 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Cafe24 상품 크롤링
          </h2>
          <div className="flex items-center gap-2">
            {hasConfig && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {mallId}
              </span>
            )}
            {serverOnline !== null && (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                serverOnline
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {serverOnline ? '서버 연결됨' : '서버 오프라인'}
              </span>
            )}
          </div>
        </div>

        {/* 서버 오프라인 안내 */}
        {serverOnline === false && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>크롤링 서버가 실행되지 않았습니다.</strong>
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
              터미널에서 다음 명령어를 실행해주세요:
            </p>
            <pre className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded text-xs font-mono text-yellow-800 dark:text-yellow-300">
              npm run server
            </pre>
          </div>
        )}

        {/* 자동 수집 버튼 */}
        <div className="space-y-4">
          <button
            onClick={() => handleAutoFetch(true)}
            disabled={isLoading || !serverOnline}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {progressMessage || '상품 수집 중...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Cafe24 상품 자동 수집
              </>
            )}
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleAddManualProduct}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              수동 추가
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2.5 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium rounded-lg transition-colors"
            >
              초기화
            </button>
          </div>
        </div>

        {/* 메시지 */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* 상품 편집 모달 */}
      {editingProduct && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            상품 정보 편집
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                상품명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                가격 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                할인가 (선택)
              </label>
              <input
                type="number"
                value={editForm.salePrice}
                onChange={(e) => setEditForm({ ...editForm, salePrice: Number(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                카테고리
              </label>
              <input
                type="text"
                value={editForm.categoryLarge}
                onChange={(e) => setEditForm({ ...editForm, categoryLarge: e.target.value })}
                placeholder="예: 의류"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                상품 설명
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                소구점/특징 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={editForm.features}
                onChange={(e) => setEditForm({ ...editForm, features: e.target.value })}
                placeholder="예: 코튼100%, 단체주문할인, 다양한컬러"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSaveProduct}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              상품 저장
            </button>
            <button
              onClick={() => setEditingProduct(null)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 저장된 상품 목록 */}
      {savedProducts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              등록된 상품 ({savedProducts.length}개)
            </h3>
            <button
              onClick={handleClearProducts}
              className="text-sm text-red-500 hover:text-red-700"
            >
              전체 삭제
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {savedProducts.slice(0, 20).map((product) => (
              <div
                key={product.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-3">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=No+Image';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.salePrice ? (
                        <>
                          <span className="line-through">{formatPrice(product.price)}</span>
                          <span className="ml-1 text-red-500">{formatPrice(product.salePrice)}</span>
                        </>
                      ) : (
                        formatPrice(product.price)
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    편집
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-xs px-2 py-1 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
          {savedProducts.length > 20 && (
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              외 {savedProducts.length - 20}개 더 있음
            </p>
          )}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          사용 방법
        </h3>
        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>터미널에서 <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run server</code>로 크롤링 서버를 실행합니다.</li>
          <li>"Cafe24 상품 자동 수집" 버튼으로 쇼핑몰의 모든 상품을 가져옵니다.</li>
          <li>필요한 경우 상품 정보를 편집합니다.</li>
          <li>저장된 상품은 콘텐츠 생성에서 사용할 수 있습니다.</li>
        </ol>
      </div>
    </div>
  );
};
