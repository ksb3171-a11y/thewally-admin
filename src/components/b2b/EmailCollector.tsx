import { useState, useRef } from 'react';
import type { B2BContact, SeasonTag } from '../../types/b2b';
import { SEASON_TAGS } from '../../types/b2b';
import {
  addContact,
  getAllCategories,
  addCustomCategory,
  parseSimpleCSV,
  bulkAddContacts
} from '../../services/b2bStorage';
import { syncFromGoogleSheet } from '../../services/googleSheets';
import { getAccessToken } from '../../services/localStorage';
import { PublicDataCollector } from './PublicDataCollector';
import { EmailCrawler } from './EmailCrawler';

interface EmailCollectorProps {
  onSuccess?: (contact: B2BContact) => void;
}

export const EmailCollector = ({ onSuccess }: EmailCollectorProps) => {
  const [categories, setCategories] = useState<string[]>(() => getAllCategories());
  const [formData, setFormData] = useState({
    name: '',
    category: '기업',
    email: '',
    phone: '',
    address: '',
    seasonTags: [] as SeasonTag[],
    memo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // CSV 업로드 관련 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvCategory, setCsvCategory] = useState('기업');
  const [csvPreview, setCsvPreview] = useState<{ name: string; email: string }[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // 사용자 정의 분류 추가 관련 상태
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // 어떤 select에서 분류 추가를 요청했는지 추적 ('form' | 'csv')
  const [categoryAddTarget, setCategoryAddTarget] = useState<'form' | 'csv'>('form');

  // 구글 시트 동기화 관련 상태
  const [isSyncing, setIsSyncing] = useState(false);

  // 공공데이터 가져오기 모달 상태
  const [showPublicDataModal, setShowPublicDataModal] = useState(false);

  // 이메일 크롤링 모달 상태
  const [showEmailCrawlerModal, setShowEmailCrawlerModal] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 분류 select 변경 핸들러 (폼용)
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__add__') {
      setCategoryAddTarget('form');
      setShowCategoryModal(true);
      return;
    }
    setFormData((prev) => ({ ...prev, category: value }));
  };

  // CSV 분류 select 변경 핸들러
  const handleCsvCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__add__') {
      setCategoryAddTarget('csv');
      setShowCategoryModal(true);
      return;
    }
    setCsvCategory(value);
  };

  const handleSeasonTagToggle = (tag: SeasonTag) => {
    setFormData((prev) => ({
      ...prev,
      seasonTags: prev.seasonTags.includes(tag)
        ? prev.seasonTags.filter((t) => t !== tag)
        : [...prev.seasonTags, tag],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      // 유효성 검사
      if (!formData.name.trim()) {
        throw new Error('단체명을 입력해주세요.');
      }
      if (!formData.email.trim()) {
        throw new Error('이메일을 입력해주세요.');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        throw new Error('올바른 이메일 형식이 아닙니다.');
      }

      const newContact = addContact({
        name: formData.name.trim(),
        category: formData.category,
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        seasonTags: formData.seasonTags,
        memo: formData.memo.trim() || undefined,
      });

      setMessage({ type: 'success', text: '연락처가 저장되었습니다.' });

      // 폼 초기화
      setFormData({
        name: '',
        category: '기업',
        email: '',
        phone: '',
        address: '',
        seasonTags: [],
        memo: '',
      });

      onSuccess?.(newContact);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '저장에 실패했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV 파일 선택 핸들러
  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseSimpleCSV(text, csvCategory);
      setCsvPreview(parsed.map(c => ({ name: c.name, email: c.email })));
      setShowCsvModal(true);
    };
    reader.readAsText(file, 'UTF-8');

    // 파일 입력 초기화 (같은 파일 다시 선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // CSV 일괄 업로드 확인
  const handleCsvImport = () => {
    if (!csvFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const contacts = parseSimpleCSV(text, csvCategory);

      if (contacts.length === 0) {
        setMessage({ type: 'error', text: 'CSV 파일에 유효한 데이터가 없습니다.' });
        setShowCsvModal(false);
        return;
      }

      const imported = bulkAddContacts(contacts);
      setMessage({ type: 'success', text: `${imported.length}개의 연락처가 저장되었습니다.` });
      setShowCsvModal(false);
      setCsvPreview([]);
      setCsvFile(null);
    };
    reader.readAsText(csvFile, 'UTF-8');
  };

  // 구글 시트에서 데이터 동기화
  const handleSyncFromSheet = async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setMessage({ type: 'error', text: '구글 로그인이 필요합니다.' });
      return;
    }

    setIsSyncing(true);
    setMessage(null);

    try {
      const result = await syncFromGoogleSheet(accessToken);

      if (result.success) {
        // 분류 목록 갱신
        setCategories(getAllCategories());

        if (result.newContactsAdded > 0) {
          let msg = `${result.newContactsAdded}개의 새 연락처가 추가되었습니다.`;
          if (result.skippedDuplicates > 0) {
            msg += ` (중복 ${result.skippedDuplicates}개 건너뜀)`;
          }
          if (result.newCategories.length > 0) {
            msg += ` 새 분류: ${result.newCategories.join(', ')}`;
          }
          setMessage({ type: 'success', text: msg });
        } else if (result.skippedDuplicates > 0) {
          setMessage({ type: 'success', text: `모든 연락처가 이미 등록되어 있습니다. (${result.skippedDuplicates}개)` });
        } else {
          setMessage({ type: 'error', text: result.error || '시트에 데이터가 없습니다.' });
        }
      } else {
        setMessage({ type: 'error', text: result.error || '동기화에 실패했습니다.' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '동기화 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 사용자 정의 분류 추가
  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setMessage({ type: 'error', text: '분류명을 입력해주세요.' });
      return;
    }

    const success = addCustomCategory(trimmed);
    if (success) {
      const updatedCategories = getAllCategories();
      setCategories(updatedCategories);
      setNewCategory('');
      setShowCategoryModal(false);

      // 추가된 분류를 해당 select에 자동 선택
      if (categoryAddTarget === 'form') {
        setFormData((prev) => ({ ...prev, category: trimmed }));
      } else {
        setCsvCategory(trimmed);
      }

      setMessage({ type: 'success', text: `"${trimmed}" 분류가 추가되었습니다.` });
    } else {
      setMessage({ type: 'error', text: '이미 존재하는 분류입니다.' });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          이메일 수집
        </h2>
        <div className="flex gap-2">
          {/* 공공데이터 가져오기 버튼 (1차 수집) */}
          <button
            type="button"
            onClick={() => setShowPublicDataModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            title="1차 수집: 공공데이터 API에서 원본 데이터 수집"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            1차 수집
          </button>
          {/* 이메일 크롤링 버튼 (2차 작업) */}
          <button
            type="button"
            onClick={() => setShowEmailCrawlerModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
            title="2차 작업: 홈페이지에서 이메일 추출"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            2차 크롤링
          </button>
          {/* 데이터 갱신 버튼 (구글 시트 동기화) */}
          <button
            type="button"
            onClick={handleSyncFromSheet}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? '동기화 중...' : '데이터 갱신'}
          </button>
          {/* CSV 업로드 버튼 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            CSV 업로드
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCsvFileSelect}
          className="hidden"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 단체명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            단체명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="예: OO고등학교, OO기업"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 분류 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            분류 <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleCategoryChange}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="__add__" className="text-blue-500">+ 새 분류 추가</option>
          </select>
        </div>

        {/* 이메일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            이메일 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="example@domain.com"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 전화번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            전화번호
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="02-1234-5678"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 주소 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            주소
          </label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="서울시 강남구..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 시즌 태그 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            시즌 태그
          </label>
          <div className="flex flex-wrap gap-2">
            {SEASON_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleSeasonTagToggle(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  formData.seasonTags.includes(tag)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            메모
          </label>
          <textarea
            name="memo"
            value={formData.memo}
            onChange={handleInputChange}
            rows={3}
            placeholder="추가 메모..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* 메시지 */}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 저장 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors"
        >
          {isSubmitting ? '저장 중...' : '저장'}
        </button>
      </form>

      {/* CSV 업로드 미리보기 모달 */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                CSV 업로드 미리보기
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* 분류 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  저장할 분류
                </label>
                <select
                  value={csvCategory}
                  onChange={handleCsvCategoryChange}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__add__" className="text-blue-500">+ 새 분류 추가</option>
                </select>
              </div>

              {/* 미리보기 */}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {csvPreview.length}개의 연락처가 발견되었습니다.
                </p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">단체명</th>
                        <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">이메일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {csvPreview.slice(0, 10).map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{item.name}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{item.email}</td>
                        </tr>
                      ))}
                      {csvPreview.length > 10 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">
                            ... 외 {csvPreview.length - 10}개
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowCsvModal(false);
                  setCsvPreview([]);
                  setCsvFile(null);
                }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCsvImport}
                disabled={csvPreview.length === 0}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
              >
                업로드 ({csvPreview.length}개)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 분류 추가 모달 */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                새 분류 추가
              </h3>
            </div>

            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                분류명
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="예: 스타트업, 유치원"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategory('');
                }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddCategory}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공공데이터 가져오기 모달 (1차 수집) */}
      {showPublicDataModal && (
        <PublicDataCollector
          onClose={() => setShowPublicDataModal(false)}
          onSuccess={(count) => {
            setCategories(getAllCategories());
            setMessage({ type: 'success', text: `1차 수집 완료: ${count}개가 원본데이터V1.0에 저장되었습니다.` });
          }}
        />
      )}

      {/* 이메일 크롤링 모달 (2차 작업) */}
      {showEmailCrawlerModal && (
        <EmailCrawler
          onClose={() => setShowEmailCrawlerModal(false)}
          onSuccess={(count) => {
            setMessage({ type: 'success', text: `2차 크롤링 완료: ${count}개 이메일이 이메일데이타V1.0에 저장되었습니다.` });
          }}
        />
      )}
    </div>
  );
};
