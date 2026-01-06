import { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { getMonthlyAnalysis } from '../../utils/analytics';
import { formatCurrency, formatPercent } from '../../utils/format';
import { MonthlyTrendChart } from '../charts/MonthlyTrendChart';
import { CategoryPieChart } from '../charts/CategoryPieChart';
import { getTotalAssets, getAssetData } from '../../services/localStorage';

interface DashboardProps {
  selectedYear: number;
  selectedMonth: number;
}

type CategoryLevel = 'sub' | 'detail';

export const Dashboard = ({ selectedYear, selectedMonth }: DashboardProps) => {
  const { data } = useData();
  const [expandedSubCategory, setExpandedSubCategory] = useState<string | null>(null);
  const [expandedIncomeSubCategory, setExpandedIncomeSubCategory] = useState<string | null>(null);

  // 분석 필터 상태
  const [expenseLevel, setExpenseLevel] = useState<CategoryLevel>('sub');
  const [incomeLevel, setIncomeLevel] = useState<CategoryLevel>('sub');
  const [insightExpenseLevel, setInsightExpenseLevel] = useState<CategoryLevel>('sub');
  const [insightIncomeLevel, setInsightIncomeLevel] = useState<CategoryLevel>('sub');

  const totalAssets = getTotalAssets();
  const assetData = getAssetData();

  const analysis = useMemo(() => {
    return getMonthlyAnalysis(data.transactions, data.subCategories, data.detailCategories, selectedYear, selectedMonth);
  }, [data.transactions, data.subCategories, data.detailCategories, selectedYear, selectedMonth]);

  // 소분류별 데이터 평탄화
  const flatExpenseDetails = useMemo(() => {
    return analysis.expenseBySubCategory.flatMap(sub =>
      sub.detailBreakdown.map(detail => ({
        ...detail,
        subCategoryName: sub.subCategoryName,
      }))
    ).sort((a, b) => b.amount - a.amount);
  }, [analysis.expenseBySubCategory]);

  const flatIncomeDetails = useMemo(() => {
    return analysis.incomeBySubCategory.flatMap(sub =>
      sub.detailBreakdown.map(detail => ({
        ...detail,
        subCategoryName: sub.subCategoryName,
      }))
    ).sort((a, b) => b.amount - a.amount);
  }, [analysis.incomeBySubCategory]);

  // TOP 5 데이터
  const topExpenseItems = useMemo(() => {
    if (insightExpenseLevel === 'sub') {
      return analysis.insights.topExpenseSubCategories.slice(0, 5);
    } else {
      return flatExpenseDetails.slice(0, 5).map(d => ({
        id: d.id,
        name: `${d.name} (${d.subCategoryName})`,
        amount: d.amount,
        percentage: d.percentage,
        count: d.count,
      }));
    }
  }, [analysis.insights.topExpenseSubCategories, flatExpenseDetails, insightExpenseLevel]);

  const topIncomeItems = useMemo(() => {
    if (insightIncomeLevel === 'sub') {
      return analysis.insights.topIncomeSubCategories.slice(0, 5);
    } else {
      return flatIncomeDetails.slice(0, 5).map(d => ({
        id: d.id,
        name: `${d.name} (${d.subCategoryName})`,
        amount: d.amount,
        percentage: d.percentage,
        count: d.count,
      }));
    }
  }, [analysis.insights.topIncomeSubCategories, flatIncomeDetails, insightIncomeLevel]);

  const CategoryLevelToggle = ({ value, onChange }: { value: CategoryLevel; onChange: (v: CategoryLevel) => void }) => (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => onChange('sub')}
        className={`px-2 py-1 text-xs rounded ${value === 'sub' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
      >
        중분류
      </button>
      <button
        onClick={() => onChange('detail')}
        className={`px-2 py-1 text-xs rounded ${value === 'detail' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
      >
        소분류
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 총 자산 카드 */}
      {assetData.assets.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80 mb-1">내 총 자산</p>
              <p className="text-3xl font-bold">{formatCurrency(totalAssets)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70 mb-1">등록된 계좌</p>
              <p className="text-sm">{assetData.assets.length}개</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex flex-wrap gap-3">
              {assetData.assets.map(asset => (
                <div key={asset.id} className="text-sm">
                  <span className="opacity-70">{asset.name}:</span>
                  <span className="ml-1 font-medium">{formatCurrency(asset.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">총 수입</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(analysis.totalIncome)}</p>
          {analysis.comparison.incomeChange !== 0 && (
            <p className={`text-sm mt-2 ${analysis.comparison.incomeChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
              전월 대비 {formatPercent(analysis.comparison.incomeChange)}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <p className="text-sm text-red-600 dark:text-red-400 mb-1">총 지출</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(analysis.totalExpense)}</p>
          {analysis.comparison.expenseChange !== 0 && (
            <p className={`text-sm mt-2 ${analysis.comparison.expenseChange < 0 ? 'text-green-500' : 'text-red-500'}`}>
              전월 대비 {formatPercent(analysis.comparison.expenseChange)}
            </p>
          )}
        </div>
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6`}>
          <p className={`text-sm mb-1 ${analysis.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>순이익</p>
          <p className={`text-2xl font-bold ${analysis.netProfit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
            {analysis.netProfit >= 0 ? '▲ ' : '▼ '}{formatCurrency(Math.abs(analysis.netProfit))}
          </p>
        </div>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">월별 추이 (최근 6개월)</h3>
          <MonthlyTrendChart transactions={data.transactions} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">지출 중분류별</h3>
          {analysis.expenseBySubCategory.length > 0 ? (
            <CategoryPieChart data={analysis.expenseBySubCategory} type="expense" />
          ) : (
            <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
          )}
        </div>
      </div>

      {/* 지출 분석 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">지출 분석</h3>
          <CategoryLevelToggle value={expenseLevel} onChange={setExpenseLevel} />
        </div>
        {expenseLevel === 'sub' ? (
          // 중분류별 보기
          analysis.expenseBySubCategory.length === 0 ? (
            <p className="p-8 text-center text-gray-500">지출 내역이 없습니다</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {analysis.expenseBySubCategory.map((sub) => (
                <div key={sub.subCategoryId}>
                  <button
                    onClick={() => setExpandedSubCategory(expandedSubCategory === sub.subCategoryId ? null : sub.subCategoryId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSubCategory === sub.subCategoryId ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-medium text-gray-900 dark:text-white">{sub.subCategoryName}</span>
                      <span className="text-sm text-gray-500">({sub.count}건)</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-red-600 font-bold">{formatCurrency(sub.totalAmount)}</span>
                      <span className="text-sm text-gray-500 w-16 text-right">{sub.percentage.toFixed(1)}%</span>
                    </div>
                  </button>
                  {expandedSubCategory === sub.subCategoryId && sub.detailBreakdown.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-2">
                      {sub.detailBreakdown.map((detail) => (
                        <div key={detail.id} className="flex items-center justify-between py-2 pl-8">
                          <span className="text-sm text-gray-600 dark:text-gray-300">{detail.name} ({detail.count}건)</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-red-500">{formatCurrency(detail.amount)}</span>
                            <span className="text-xs text-gray-400 w-16 text-right">{detail.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          // 소분류별 보기
          flatExpenseDetails.length === 0 ? (
            <p className="p-8 text-center text-gray-500">지출 내역이 없습니다</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {flatExpenseDetails.map((detail) => (
                <div key={detail.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900 dark:text-white">{detail.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{detail.subCategoryName}</span>
                    <span className="text-sm text-gray-500">({detail.count}건)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-red-600 font-bold">{formatCurrency(detail.amount)}</span>
                    <span className="text-sm text-gray-500 w-16 text-right">{detail.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 수입 분석 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">수입 분석</h3>
          <CategoryLevelToggle value={incomeLevel} onChange={setIncomeLevel} />
        </div>
        {incomeLevel === 'sub' ? (
          // 중분류별 보기
          analysis.incomeBySubCategory.length === 0 ? (
            <p className="p-8 text-center text-gray-500">수입 내역이 없습니다</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {analysis.incomeBySubCategory.map((sub) => (
                <div key={sub.subCategoryId}>
                  <button
                    onClick={() => setExpandedIncomeSubCategory(expandedIncomeSubCategory === sub.subCategoryId ? null : sub.subCategoryId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedIncomeSubCategory === sub.subCategoryId ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-medium text-gray-900 dark:text-white">{sub.subCategoryName}</span>
                      <span className="text-sm text-gray-500">({sub.count}건)</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-blue-600 font-bold">{formatCurrency(sub.totalAmount)}</span>
                      <span className="text-sm text-gray-500 w-16 text-right">{sub.percentage.toFixed(1)}%</span>
                    </div>
                  </button>
                  {expandedIncomeSubCategory === sub.subCategoryId && sub.detailBreakdown.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-2">
                      {sub.detailBreakdown.map((detail) => (
                        <div key={detail.id} className="flex items-center justify-between py-2 pl-8">
                          <span className="text-sm text-gray-600 dark:text-gray-300">{detail.name} ({detail.count}건)</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-blue-500">{formatCurrency(detail.amount)}</span>
                            <span className="text-xs text-gray-400 w-16 text-right">{detail.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          // 소분류별 보기
          flatIncomeDetails.length === 0 ? (
            <p className="p-8 text-center text-gray-500">수입 내역이 없습니다</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {flatIncomeDetails.map((detail) => (
                <div key={detail.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900 dark:text-white">{detail.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{detail.subCategoryName}</span>
                    <span className="text-sm text-gray-500">({detail.count}건)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-blue-600 font-bold">{formatCurrency(detail.amount)}</span>
                    <span className="text-sm text-gray-500 w-16 text-right">{detail.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 인사이트 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">인사이트</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TOP 지출 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-500">가장 큰 지출 TOP 5</h4>
              <CategoryLevelToggle value={insightExpenseLevel} onChange={setInsightExpenseLevel} />
            </div>
            {topExpenseItems.length > 0 ? (
              <div className="space-y-2">
                {topExpenseItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 text-xs flex items-center justify-center font-bold">{index + 1}</span>
                    <span className="flex-1 text-gray-900 dark:text-white text-sm truncate">{item.name}</span>
                    <span className="text-red-600 font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">데이터 없음</p>
            )}
          </div>

          {/* TOP 수입 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-500">가장 큰 수입 TOP 5</h4>
              <CategoryLevelToggle value={insightIncomeLevel} onChange={setInsightIncomeLevel} />
            </div>
            {topIncomeItems.length > 0 ? (
              <div className="space-y-2">
                {topIncomeItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs flex items-center justify-center font-bold">{index + 1}</span>
                    <span className="flex-1 text-gray-900 dark:text-white text-sm truncate">{item.name}</span>
                    <span className="text-blue-600 font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">데이터 없음</p>
            )}
          </div>

          {/* 전월 대비 증감 */}
          {analysis.insights.mostIncreasedExpense && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">전월 대비 가장 증가한 지출</h4>
              <p className="text-gray-900 dark:text-white">
                {analysis.insights.mostIncreasedExpense.name}
                <span className="text-red-500 ml-2">+{formatCurrency(analysis.insights.mostIncreasedExpense.change)}</span>
              </p>
            </div>
          )}
          {analysis.insights.mostDecreasedExpense && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">전월 대비 가장 감소한 지출</h4>
              <p className="text-gray-900 dark:text-white">
                {analysis.insights.mostDecreasedExpense.name}
                <span className="text-green-500 ml-2">{formatCurrency(analysis.insights.mostDecreasedExpense.change)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
