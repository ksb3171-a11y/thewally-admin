export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
};

export const formatAmount = (value: string): string => {
  const numericValue = value.replace(/[^\d]/g, '');
  if (!numericValue) return '';
  return new Intl.NumberFormat('ko-KR').format(Number(numericValue));
};

export const parseAmount = (formattedValue: string): number => {
  const numericValue = formattedValue.replace(/[^\d]/g, '');
  return Number(numericValue) || 0;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

export const formatDateWithDay = (dateString: string): string => {
  const date = new Date(dateString);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${formatDate(dateString)} (${days[date.getDay()]})`;
};

export const formatMonth = (year: number, month: number): string => {
  return `${year}년 ${month + 1}월`;
};

export const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const getCurrentYearMonth = (): { year: number; month: number } => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
};

export const getMonthRange = (year: number, month: number): { start: string; end: string } => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: formatDateToISO(start),
    end: formatDateToISO(end),
  };
};

export const getWeekRange = (date: Date): { start: string; end: string } => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(date);
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: formatDateToISO(start), end: formatDateToISO(end) };
};

export const getQuarterRange = (year: number, quarter: number): { start: string; end: string } => {
  const startMonth = (quarter - 1) * 3;
  return {
    start: formatDateToISO(new Date(year, startMonth, 1)),
    end: formatDateToISO(new Date(year, startMonth + 3, 0)),
  };
};

export const getSemiannualRange = (year: number, half: number): { start: string; end: string } => {
  const startMonth = (half - 1) * 6;
  return {
    start: formatDateToISO(new Date(year, startMonth, 1)),
    end: formatDateToISO(new Date(year, startMonth + 6, 0)),
  };
};

export const getYearRange = (year: number): { start: string; end: string } => {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
};

const formatDateToISO = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const formatPercent = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

export const calculateChangeRate = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export const formatLastSyncTime = (isoString: string | null): string => {
  if (!isoString) return '동기화 기록 없음';

  const now = new Date();
  const syncTime = new Date(isoString);
  const diffMs = now.getTime() - syncTime.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
};
