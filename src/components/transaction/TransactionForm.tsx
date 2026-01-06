import { useState } from 'react';
import type { MainCategory } from '../../types';
import { useData } from '../../contexts/DataContext';
import { CategorySelect } from '../category/CategorySelect';
import { getTodayString, formatAmount, parseAmount } from '../../utils/format';
import { getAssetData } from '../../services/localStorage';

export const TransactionForm = () => {
  const { addTransaction } = useData();

  const [date, setDate] = useState(getTodayString());
  const [mainCategory, setMainCategory] = useState<MainCategory>('expense');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [detailCategoryId, setDetailCategoryId] = useState('');
  const [detailCategoryName, setDetailCategoryName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemCategoryName, setItemCategoryName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assetName, setAssetName] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const assets = getAssetData().assets;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmount(e.target.value);
    setAmount(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subCategoryId || !detailCategoryId || !amount) {
      return;
    }

    addTransaction({
      date,
      mainCategory,
      subCategoryId,
      detailCategoryId,
      subCategoryName,
      detailCategoryName,
      amount: parseAmount(amount),
      memo,
      ...(itemCategoryId && { itemCategoryId, itemCategoryName }),
      ...(assetId && { assetId, assetName }),
    });

    // Reset form
    setAmount('');
    setMemo('');
    setItemCategoryId('');
    setItemCategoryName('');
  };

  const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const asset = assets.find((a) => a.id === id);
    setAssetId(id);
    setAssetName(asset?.name || '');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">수입/지출 입력</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 날짜 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 카테고리 선택 */}
        <CategorySelect
          mainCategory={mainCategory}
          subCategoryId={subCategoryId}
          detailCategoryId={detailCategoryId}
          itemCategoryId={itemCategoryId}
          onMainCategoryChange={setMainCategory}
          onSubCategoryChange={(id, name) => { setSubCategoryId(id); setSubCategoryName(name); }}
          onDetailCategoryChange={(id, name) => { setDetailCategoryId(id); setDetailCategoryName(name); }}
          onItemCategoryChange={(id, name) => { setItemCategoryId(id); setItemCategoryName(name); }}
        />

        {/* 통장 선택 */}
        {assets.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              통장/계좌 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <select
              value={assetId}
              onChange={handleAssetChange}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">통장 선택 (선택사항)</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 금액 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">금액</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="w-full px-4 py-2.5 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right text-lg font-medium"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">원</span>
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">메모 (선택)</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모를 입력하세요"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={!subCategoryId || !detailCategoryId || !amount}
          className={`w-full py-3 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            mainCategory === 'income'
              ? 'bg-blue-500 hover:bg-blue-600'
              : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          {mainCategory === 'income' ? '수입' : '지출'} 추가
        </button>
      </form>
    </div>
  );
};
