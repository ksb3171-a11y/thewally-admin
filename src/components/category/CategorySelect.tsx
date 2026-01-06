import { useState, useMemo } from 'react';
import type { MainCategory } from '../../types';
import { useData } from '../../contexts/DataContext';
import { Modal } from '../common/Modal';

interface CategorySelectProps {
  mainCategory: MainCategory;
  subCategoryId: string;
  detailCategoryId: string;
  itemCategoryId?: string;
  onMainCategoryChange: (value: MainCategory) => void;
  onSubCategoryChange: (id: string, name: string) => void;
  onDetailCategoryChange: (id: string, name: string) => void;
  onItemCategoryChange?: (id: string, name: string) => void;
}

export const CategorySelect = ({
  mainCategory,
  subCategoryId,
  detailCategoryId,
  itemCategoryId = '',
  onMainCategoryChange,
  onSubCategoryChange,
  onDetailCategoryChange,
  onItemCategoryChange,
}: CategorySelectProps) => {
  const { data, addSubCategory, addDetailCategory, addItemCategory } = useData();
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [showAddDetailModal, setShowAddDetailModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newDetailName, setNewDetailName] = useState('');
  const [newItemName, setNewItemName] = useState('');

  const subCategories = useMemo(() => {
    return data.subCategories
      .filter((s) => s.mainCategory === mainCategory)
      .sort((a, b) => {
        // 사용 횟수가 높은 것이 먼저 (내림차순)
        const usageA = a.usageCount || 0;
        const usageB = b.usageCount || 0;
        if (usageB !== usageA) return usageB - usageA;
        // 사용 횟수가 같으면 order 순서로
        return a.order - b.order;
      });
  }, [data.subCategories, mainCategory]);

  const detailCategories = useMemo(() => {
    return data.detailCategories
      .filter((d) => d.subCategoryId === subCategoryId)
      .sort((a, b) => a.order - b.order);
  }, [data.detailCategories, subCategoryId]);

  const itemCategories = useMemo(() => {
    return data.itemCategories
      .filter((i) => i.detailCategoryId === detailCategoryId)
      .sort((a, b) => a.order - b.order);
  }, [data.itemCategories, detailCategoryId]);

  const selectedSubCategory = subCategories.find((s) => s.id === subCategoryId);
  const selectedDetailCategory = detailCategories.find((d) => d.id === detailCategoryId);
  const selectedItemCategory = itemCategories.find((i) => i.id === itemCategoryId);

  const handleMainCategoryChange = (value: MainCategory) => {
    onMainCategoryChange(value);
    onSubCategoryChange('', '');
    onDetailCategoryChange('', '');
    onItemCategoryChange?.('', '');
  };

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === '__add__') {
      setShowAddSubModal(true);
      return;
    }
    const sub = subCategories.find((s) => s.id === id);
    onSubCategoryChange(id, sub?.name || '');
    onDetailCategoryChange('', '');
    onItemCategoryChange?.('', '');
  };

  const handleDetailCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === '__add__') {
      setShowAddDetailModal(true);
      return;
    }
    const detail = detailCategories.find((d) => d.id === id);
    onDetailCategoryChange(id, detail?.name || '');
    onItemCategoryChange?.('', '');
  };

  const handleItemCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === '__add__') {
      setShowAddItemModal(true);
      return;
    }
    const item = itemCategories.find((i) => i.id === id);
    onItemCategoryChange?.(id, item?.name || '');
  };

  const handleAddSubCategory = () => {
    if (!newSubName.trim()) return;
    const newSub = addSubCategory(newSubName.trim(), mainCategory);
    onSubCategoryChange(newSub.id, newSub.name);
    onDetailCategoryChange('', '');
    onItemCategoryChange?.('', '');
    setNewSubName('');
    setShowAddSubModal(false);
  };

  const handleAddDetailCategory = () => {
    if (!newDetailName.trim() || !subCategoryId) return;
    const newDetail = addDetailCategory(newDetailName.trim(), subCategoryId);
    onDetailCategoryChange(newDetail.id, newDetail.name);
    onItemCategoryChange?.('', '');
    setNewDetailName('');
    setShowAddDetailModal(false);
  };

  const handleAddItemCategory = () => {
    if (!newItemName.trim() || !detailCategoryId) return;
    const newItem = addItemCategory(newItemName.trim(), detailCategoryId);
    onItemCategoryChange?.(newItem.id, newItem.name);
    setNewItemName('');
    setShowAddItemModal(false);
  };

  // 카테고리 경로 표시
  const getCategoryPath = () => {
    const parts = [mainCategory === 'income' ? '수입' : '지출'];
    if (selectedSubCategory) parts.push(selectedSubCategory.name);
    if (selectedDetailCategory) parts.push(selectedDetailCategory.name);
    if (selectedItemCategory) parts.push(selectedItemCategory.name);
    return parts.join(' > ');
  };

  return (
    <div className="space-y-4">
      {/* 대분류 선택 (수입/지출) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">대분류</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleMainCategoryChange('expense')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
              mainCategory === 'expense'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            지출
          </button>
          <button
            type="button"
            onClick={() => handleMainCategoryChange('income')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
              mainCategory === 'income'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            수입
          </button>
        </div>
      </div>

      {/* 중분류 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">중분류</label>
        <select
          value={subCategoryId}
          onChange={handleSubCategoryChange}
          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">중분류 선택</option>
          {subCategories.map((sub) => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
          <option value="__add__">+ 새 중분류 추가</option>
        </select>
      </div>

      {/* 소분류 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">소분류</label>
        <select
          value={detailCategoryId}
          onChange={handleDetailCategoryChange}
          disabled={!subCategoryId}
          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">소분류 선택</option>
          {detailCategories.map((detail) => (
            <option key={detail.id} value={detail.id}>{detail.name}</option>
          ))}
          {subCategoryId && <option value="__add__">+ 새 소분류 추가</option>}
        </select>
      </div>

      {/* 세부항목 선택 (선택사항) */}
      {onItemCategoryChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            세부항목 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <select
            value={itemCategoryId}
            onChange={handleItemCategoryChange}
            disabled={!detailCategoryId}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">세부항목 선택 (선택사항)</option>
            {itemCategories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            {detailCategoryId && <option value="__add__">+ 새 세부항목 추가</option>}
          </select>
        </div>
      )}

      {/* 선택된 카테고리 경로 표시 */}
      {selectedSubCategory && selectedDetailCategory && (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
          {getCategoryPath()}
        </div>
      )}

      {/* 중분류 추가 모달 */}
      <Modal isOpen={showAddSubModal} onClose={() => setShowAddSubModal(false)} title="새 중분류 추가">
        <div className="space-y-4">
          <input
            type="text"
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            placeholder="중분류명 입력"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAddSubModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">취소</button>
            <button onClick={handleAddSubCategory} className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">추가</button>
          </div>
        </div>
      </Modal>

      {/* 소분류 추가 모달 */}
      <Modal isOpen={showAddDetailModal} onClose={() => setShowAddDetailModal(false)} title="새 소분류 추가">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedSubCategory?.name} 하위에 소분류를 추가합니다.
          </p>
          <input
            type="text"
            value={newDetailName}
            onChange={(e) => setNewDetailName(e.target.value)}
            placeholder="소분류명 입력"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAddDetailModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">취소</button>
            <button onClick={handleAddDetailCategory} className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">추가</button>
          </div>
        </div>
      </Modal>

      {/* 세부항목 추가 모달 */}
      <Modal isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)} title="새 세부항목 추가">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedDetailCategory?.name} 하위에 세부항목을 추가합니다.
          </p>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="세부항목명 입력"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAddItemModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">취소</button>
            <button onClick={handleAddItemCategory} className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors">추가</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
