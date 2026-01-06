import { useMemo, useState, useEffect } from 'react';
import { TransactionForm } from './TransactionForm';
import { useData } from '../../contexts/DataContext';
import { formatCurrency } from '../../utils/format';
import { getMonthlyAnalysis, getPieChartData } from '../../utils/analytics';
import { getAssetData } from '../../services/localStorage';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface InputDashboardProps {
  selectedYear: number;
  selectedMonth: number;
}

export const InputDashboard = ({ selectedYear, selectedMonth }: InputDashboardProps) => {
  const { data } = useData();
  const [assetData, setAssetData] = useState(getAssetData());

  // 거래 데이터 변경 시 자산 데이터 갱신
  useEffect(() => {
    setAssetData(getAssetData());
  }, [data.transactions]);

  // 월간 분석
  const analysis = useMemo(() => {
    return getMonthlyAnalysis(
      data.transactions,
      data.subCategories,
      data.detailCategories,
      selectedYear,
      selectedMonth
    );
  }, [data.transactions, data.subCategories, data.detailCategories, selectedYear, selectedMonth]);

  const totalAssets = assetData.assets.reduce((sum, a) => sum + a.balance, 0);
  const expensePieData = getPieChartData(analysis.expenseBySubCategory.slice(0, 5), 'expense');
  const incomePieData = getPieChartData(analysis.incomeBySubCategory.slice(0, 5), 'income');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 왼쪽: 수입/지출 입력 */}
      <div>
        <TransactionForm />
      </div>

      {/* 오른쪽: 분석 요약 */}
      <div className="space-y-4">
        {/* 총 자산 */}
        {assetData.assets.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm opacity-90">총 자산</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAssets)}</p>
            </div>
            {assetData.assets.length > 1 && (
              <div className="border-t border-white/20 pt-2 mt-2 space-y-1">
                {assetData.assets.slice(0, 4).map((asset) => (
                  <div key={asset.id} className="flex justify-between text-sm">
                    <span className="opacity-80">{asset.name}</span>
                    <span className="font-medium">{formatCurrency(asset.balance)}</span>
                  </div>
                ))}
                {assetData.assets.length > 4 && (
                  <p className="text-xs opacity-60 text-center">외 {assetData.assets.length - 4}개 계좌</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 이번 달 요약 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            {selectedMonth + 1}월 요약
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">수입</span>
              <span className="text-sm font-bold text-blue-600">+{formatCurrency(analysis.totalIncome)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">지출</span>
              <span className="text-sm font-bold text-red-600">-{formatCurrency(analysis.totalExpense)}</span>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">순이익</span>
                <span className={`text-sm font-bold ${
                  analysis.netProfit >= 0 ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {analysis.netProfit >= 0 ? '+' : ''}{formatCurrency(analysis.netProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 수입/지출 분포 (파이차트) - 2열 레이아웃 */}
        {(expensePieData.length > 0 || incomePieData.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {/* 지출 분포 */}
            {expensePieData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">지출 분포</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={45}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {expensePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 범례 */}
                <div className="mt-2 space-y-1">
                  {expensePieData.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[60px]">{item.name}</span>
                      </div>
                      <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 수입 분포 */}
            {incomePieData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">수입 분포</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={45}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {incomePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 범례 */}
                <div className="mt-2 space-y-1">
                  {incomePieData.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[60px]">{item.name}</span>
                      </div>
                      <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TOP 지출/수입 - 2열 레이아웃 (소분류 기준) */}
        <div className="grid grid-cols-2 gap-4">
          {/* TOP 지출 (소분류 기준) */}
          {analysis.insights.topExpenseDetailCategories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">TOP 지출</h3>
              <div className="space-y-1.5">
                {analysis.insights.topExpenseDetailCategories.slice(0, 7).map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-red-500' : index === 1 ? 'bg-red-400' : index === 2 ? 'bg-orange-500' : 'bg-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOP 수입 (소분류 기준) */}
          {analysis.insights.topIncomeDetailCategories.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">TOP 수입</h3>
              <div className="space-y-1.5">
                {analysis.insights.topIncomeDetailCategories.slice(0, 7).map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-blue-400' : index === 2 ? 'bg-cyan-500' : 'bg-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
