import { useState, useMemo } from 'react';
import type { Transaction } from '../../types';
import { useData } from '../../contexts/DataContext';
import { formatCurrency, formatDateWithDay, getMonthRange } from '../../utils/format';
import { ConfirmModal, Modal } from '../common/Modal';
import { CategorySelect } from '../category/CategorySelect';
import { formatAmount, parseAmount } from '../../utils/format';
import { getAssetData } from '../../services/localStorage';

interface TransactionListProps {
  selectedYear: number;
  selectedMonth: number;
}


export const TransactionList = ({ selectedYear, selectedMonth }: TransactionListProps) => {
  const { data, deleteTransaction, updateTransaction } = useData();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'daily'>('list');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { start, end } = getMonthRange(selectedYear, selectedMonth);

  // 해당 월의 모든 거래 (날짜 필터 전)
  const monthTransactions = useMemo(() => {
    return data.transactions
      .filter((t) => t.date >= start && t.date <= end)
      .filter((t) => filterType === 'all' || t.mainCategory === filterType)
      .filter((t) => !searchKeyword || t.memo.includes(searchKeyword) || t.subCategoryName.includes(searchKeyword) || t.detailCategoryName.includes(searchKeyword) || (t.itemCategoryName && t.itemCategoryName.includes(searchKeyword)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.transactions, start, end, filterType, searchKeyword]);

  // 날짜 선택 시 필터링된 거래
  const filteredTransactions = useMemo(() => {
    if (viewMode === 'daily' && selectedDate) {
      return monthTransactions.filter((t) => t.date === selectedDate);
    }
    return monthTransactions;
  }, [monthTransactions, viewMode, selectedDate]);

  // 일별 데이터 (캘린더용)
  const dailyData = useMemo(() => {
    const dataMap: Map<string, { income: number; expense: number; count: number }> = new Map();

    monthTransactions.forEach((t) => {
      if (!dataMap.has(t.date)) {
        dataMap.set(t.date, { income: 0, expense: 0, count: 0 });
      }
      const day = dataMap.get(t.date)!;
      day.count++;
      if (t.mainCategory === 'income') {
        day.income += t.amount;
      } else {
        day.expense += t.amount;
      }
    });

    return dataMap;
  }, [monthTransactions]);

  // 캘린더 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: Array<{ day: number; date: string } | null> = [];

    // 이전 달 빈칸
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // 해당 월의 날짜들
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, date: dateStr });
    }

    return days;
  }, [selectedYear, selectedMonth]);

  // 목록 모드로 전환 시 선택 날짜 초기화
  const handleViewModeChange = (mode: 'list' | 'daily') => {
    setViewMode(mode);
    if (mode === 'list') {
      setSelectedDate(null);
    }
  };

  const totalIncome = filteredTransactions.filter((t) => t.mainCategory === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter((t) => t.mainCategory === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'income', 'expense'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? type === 'income' ? 'bg-blue-500 text-white' : type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {type === 'all' ? '전체' : type === 'income' ? '수입' : '지출'}
              </button>
            ))}
          </div>
          {/* 보기 모드 전환 */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                목록
              </span>
            </button>
            <button
              onClick={() => handleViewModeChange('daily')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'daily'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                일별
              </span>
            </button>
          </div>
        </div>
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="메모, 카테고리 검색..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">수입</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-1">지출</p>
          <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(totalExpense)}</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${totalIncome - totalExpense >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
          <p className={`text-sm mb-1 ${totalIncome - totalExpense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>순이익</p>
          <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
            {formatCurrency(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      {/* 일별 보기: 미니 캘린더 */}
      {viewMode === 'daily' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {selectedYear}년 {selectedMonth + 1}월
            </span>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-[10px] text-blue-500 hover:text-blue-700"
              >
                전체보기
              </button>
            )}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-[10px]">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
              <div
                key={day}
                className={`text-center py-0.5 font-medium ${
                  idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                {day}
              </div>
            ))}
            {calendarDays.map((item, idx) => {
              if (!item) {
                return <div key={`empty-${idx}`} className="h-6" />;
              }

              const dayData = dailyData.get(item.date);
              const isSelected = selectedDate === item.date;
              const hasData = dayData && dayData.count > 0;
              const dayOfWeek = new Date(item.date).getDay();

              return (
                <button
                  key={item.date}
                  onClick={() => setSelectedDate(isSelected ? null : item.date)}
                  className={`h-6 rounded text-[11px] font-medium transition-all relative ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : hasData
                      ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  } ${
                    !isSelected && (dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700 dark:text-gray-300')
                  }`}
                >
                  {item.day}
                  {hasData && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 거래 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            거래 내역 ({filteredTransactions.length}건)
            {viewMode === 'daily' && selectedDate && (
              <span className="text-sm font-normal text-blue-500 ml-2">
                - {new Date(selectedDate).getMonth() + 1}월 {new Date(selectedDate).getDate()}일
              </span>
            )}
          </h2>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {viewMode === 'daily' && selectedDate ? '선택한 날짜에 거래 내역이 없습니다.' : '거래 내역이 없습니다.'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredTransactions.map((t) => (
              <li key={t.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${t.mainCategory === 'income' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                        {t.mainCategory === 'income' ? '수입' : '지출'}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {t.subCategoryName} &gt; {t.detailCategoryName}{t.itemCategoryName && ` > ${t.itemCategoryName}`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateWithDay(t.date)}
                      {t.assetName && <span className="ml-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">{t.assetName}</span>}
                      {t.memo && ` · ${t.memo}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`text-lg font-bold whitespace-nowrap ${t.mainCategory === 'income' ? 'text-blue-600' : 'text-red-600'}`}>
                      {t.mainCategory === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                    <button onClick={() => setEditingTransaction(t)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => setDeleteTargetId(t.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => { deleteTransaction(deleteTargetId!); setDeleteTargetId(null); }}
        title="거래 삭제"
        message="이 거래를 삭제하시겠습니까?"
        confirmText="삭제"
      />

      {/* 수정 모달 */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={(updates) => { updateTransaction(editingTransaction.id, updates); setEditingTransaction(null); }}
        />
      )}
    </div>
  );
};

interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: (updates: Partial<Transaction>) => void;
}

const EditTransactionModal = ({ transaction, onClose, onSave }: EditTransactionModalProps) => {
  const [date, setDate] = useState(transaction.date);
  const [mainCategory, setMainCategory] = useState(transaction.mainCategory);
  const [subCategoryId, setSubCategoryId] = useState(transaction.subCategoryId);
  const [subCategoryName, setSubCategoryName] = useState(transaction.subCategoryName);
  const [detailCategoryId, setDetailCategoryId] = useState(transaction.detailCategoryId);
  const [detailCategoryName, setDetailCategoryName] = useState(transaction.detailCategoryName);
  const [itemCategoryId, setItemCategoryId] = useState(transaction.itemCategoryId || '');
  const [itemCategoryName, setItemCategoryName] = useState(transaction.itemCategoryName || '');
  const [assetId, setAssetId] = useState(transaction.assetId || '');
  const [assetName, setAssetName] = useState(transaction.assetName || '');
  const [amount, setAmount] = useState(formatAmount(String(transaction.amount)));
  const [memo, setMemo] = useState(transaction.memo);

  const assets = getAssetData().assets;

  const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const asset = assets.find((a) => a.id === id);
    setAssetId(id);
    setAssetName(asset?.name || '');
  };

  const handleSave = () => {
    onSave({
      date,
      mainCategory,
      subCategoryId,
      detailCategoryId,
      subCategoryName,
      detailCategoryName,
      amount: parseAmount(amount),
      memo,
      ...(itemCategoryId && { itemCategoryId, itemCategoryName }),
      assetId: assetId || undefined,
      assetName: assetName || undefined,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="거래 수정">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">날짜</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
        </div>

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

        {assets.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">통장/계좌</label>
            <select
              value={assetId}
              onChange={handleAssetChange}
              className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="">통장 선택 (선택사항)</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">금액</label>
          <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatAmount(e.target.value))} className="w-full px-4 py-2 border rounded-lg text-right" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">메모</label>
          <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">취소</button>
          <button onClick={handleSave} className="px-4 py-2 text-white bg-blue-500 rounded-lg">저장</button>
        </div>
      </div>
    </Modal>
  );
};
