import type { Transaction, SubCategory, DetailCategory, SubCategoryAnalysis, CategoryBreakdown, MonthlyAnalysis, MainCategory } from '../types';
import { getMonthRange, calculateChangeRate } from './format';

export const filterTransactionsByDateRange = (
  transactions: Transaction[],
  startDate: string,
  endDate: string
): Transaction[] => {
  return transactions.filter((t) => t.date >= startDate && t.date <= endDate);
};

export const filterTransactionsByType = (
  transactions: Transaction[],
  type: MainCategory | 'all'
): Transaction[] => {
  if (type === 'all') return transactions;
  return transactions.filter((t) => t.mainCategory === type);
};

export const calculateTotal = (transactions: Transaction[]): number => {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
};

export const getSubCategoryAnalysis = (
  transactions: Transaction[],
  subCategories: SubCategory[],
  detailCategories: DetailCategory[],
  mainCategory: MainCategory
): SubCategoryAnalysis[] => {
  const filtered = transactions.filter((t) => t.mainCategory === mainCategory);
  const total = calculateTotal(filtered);

  const relevantSubCategories = subCategories.filter((s) => s.mainCategory === mainCategory);

  return relevantSubCategories
    .map((sub) => {
      const subTransactions = filtered.filter((t) => t.subCategoryId === sub.id);
      const subTotal = calculateTotal(subTransactions);

      const relevantDetails = detailCategories.filter((d) => d.subCategoryId === sub.id);
      const detailBreakdown: CategoryBreakdown[] = relevantDetails
        .map((detail) => {
          const detailTransactions = subTransactions.filter((t) => t.detailCategoryId === detail.id);
          const detailTotal = calculateTotal(detailTransactions);
          return {
            id: detail.id,
            name: detail.name,
            amount: detailTotal,
            percentage: subTotal > 0 ? (detailTotal / subTotal) * 100 : 0,
            count: detailTransactions.length,
          };
        })
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount);

      return {
        subCategoryId: sub.id,
        subCategoryName: sub.name,
        totalAmount: subTotal,
        percentage: total > 0 ? (subTotal / total) * 100 : 0,
        count: subTransactions.length,
        detailBreakdown,
      };
    })
    .filter((s) => s.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

export const getMonthlyAnalysis = (
  transactions: Transaction[],
  subCategories: SubCategory[],
  detailCategories: DetailCategory[],
  year: number,
  month: number
): MonthlyAnalysis => {
  const { start: currentStart, end: currentEnd } = getMonthRange(year, month);
  const currentTransactions = filterTransactionsByDateRange(transactions, currentStart, currentEnd);

  const incomeTransactions = filterTransactionsByType(currentTransactions, 'income');
  const expenseTransactions = filterTransactionsByType(currentTransactions, 'expense');

  const totalIncome = calculateTotal(incomeTransactions);
  const totalExpense = calculateTotal(expenseTransactions);
  const netProfit = totalIncome - totalExpense;

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);
  const prevTransactions = filterTransactionsByDateRange(transactions, prevStart, prevEnd);

  const prevIncome = calculateTotal(filterTransactionsByType(prevTransactions, 'income'));
  const prevExpense = calculateTotal(filterTransactionsByType(prevTransactions, 'expense'));
  const prevNetProfit = prevIncome - prevExpense;

  const incomeBySubCategory = getSubCategoryAnalysis(currentTransactions, subCategories, detailCategories, 'income');
  const expenseBySubCategory = getSubCategoryAnalysis(currentTransactions, subCategories, detailCategories, 'expense');

  const incomeChange = calculateChangeRate(totalIncome, prevIncome);
  const expenseChange = calculateChangeRate(totalExpense, prevExpense);
  const netProfitChange = prevNetProfit === 0 && netProfit === 0 ? 0 : prevNetProfit === 0 ? 100 : calculateChangeRate(netProfit, prevNetProfit);

  // 인사이트 계산 (TOP 7)
  const topExpenseSubCategories: CategoryBreakdown[] = expenseBySubCategory.slice(0, 7).map((s) => ({
    id: s.subCategoryId,
    name: s.subCategoryName,
    amount: s.totalAmount,
    percentage: s.percentage,
    count: s.count,
  }));

  const topExpenseDetailCategories: CategoryBreakdown[] = expenseBySubCategory
    .flatMap((s) => s.detailBreakdown)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7);

  const topIncomeSubCategories: CategoryBreakdown[] = incomeBySubCategory.slice(0, 7).map((s) => ({
    id: s.subCategoryId,
    name: s.subCategoryName,
    amount: s.totalAmount,
    percentage: s.percentage,
    count: s.count,
  }));

  const topIncomeDetailCategories: CategoryBreakdown[] = incomeBySubCategory
    .flatMap((s) => s.detailBreakdown)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7);

  // 전월 대비 가장 증가/감소한 지출 중분류
  const prevExpenseBySubCategory = getSubCategoryAnalysis(prevTransactions, subCategories, detailCategories, 'expense');

  let mostIncreasedExpense: { name: string; change: number } | null = null;
  let mostDecreasedExpense: { name: string; change: number } | null = null;

  expenseBySubCategory.forEach((current) => {
    const prev = prevExpenseBySubCategory.find((p) => p.subCategoryId === current.subCategoryId);
    const prevAmount = prev?.totalAmount || 0;
    const change = current.totalAmount - prevAmount;

    if (change > 0 && (!mostIncreasedExpense || change > mostIncreasedExpense.change)) {
      mostIncreasedExpense = { name: current.subCategoryName, change };
    }
    if (change < 0 && (!mostDecreasedExpense || change < mostDecreasedExpense.change)) {
      mostDecreasedExpense = { name: current.subCategoryName, change };
    }
  });

  return {
    totalIncome,
    totalExpense,
    netProfit,
    incomeBySubCategory,
    expenseBySubCategory,
    previousMonth: { income: prevIncome, expense: prevExpense, netProfit: prevNetProfit },
    comparison: { incomeChange, expenseChange, netProfitChange },
    insights: {
      topExpenseSubCategories,
      topExpenseDetailCategories,
      topIncomeSubCategories,
      topIncomeDetailCategories,
      mostIncreasedExpense,
      mostDecreasedExpense,
    },
  };
};

export const getMonthlyTrendData = (
  transactions: Transaction[],
  months: number = 6
): { name: string; income: number; expense: number; netProfit: number }[] => {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();

    const { start, end } = getMonthRange(year, month);
    const monthTransactions = filterTransactionsByDateRange(transactions, start, end);

    const income = calculateTotal(filterTransactionsByType(monthTransactions, 'income'));
    const expense = calculateTotal(filterTransactionsByType(monthTransactions, 'expense'));

    result.push({
      name: `${month + 1}월`,
      income,
      expense,
      netProfit: income - expense,
    });
  }

  return result;
};

export const CHART_COLORS = {
  income: ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#2563EB'],
  expense: ['#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#DC2626', '#FB923C', '#FDBA74', '#FED7AA', '#FFEDD5', '#FFF7ED', '#EA580C'],
};

export const getPieChartData = (analysis: SubCategoryAnalysis[], type: MainCategory) => {
  const colors = CHART_COLORS[type];
  return analysis.map((item, index) => ({
    name: item.subCategoryName,
    value: item.totalAmount,
    color: colors[index % colors.length],
  }));
};
