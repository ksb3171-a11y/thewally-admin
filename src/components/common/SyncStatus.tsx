import type { SyncStatus as SyncStatusType } from '../../types';
import { formatLastSyncTime } from '../../utils/format';

interface SyncStatusProps {
  status: SyncStatusType;
  onManualSync: () => void;
}

export const SyncStatusComponent = ({ status, onManualSync }: SyncStatusProps) => {
  const getStatusInfo = () => {
    switch (status.status) {
      case 'synced':
        return { icon: <CheckIcon />, text: '동기화됨', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' };
      case 'syncing':
        return { icon: <SpinnerIcon />, text: '동기화 중...', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' };
      case 'pending':
        return { icon: <WarningIcon />, text: '동기화 필요', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', clickable: true };
      case 'offline':
        return { icon: <OfflineIcon />, text: '오프라인', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' };
      case 'error':
        return { icon: <ErrorIcon />, text: '오류 발생', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', clickable: true };
      default:
        return { icon: <CheckIcon />, text: '알 수 없음', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={statusInfo.clickable ? onManualSync : undefined}
        disabled={!statusInfo.clickable}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${statusInfo.bg} ${statusInfo.color} ${statusInfo.clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
      >
        <span className="w-4 h-4">{statusInfo.icon}</span>
        <span>{statusInfo.text}</span>
      </button>
      {status.lastSyncedAt && (
        <span className="text-xs text-gray-400">
          마지막 동기화: {formatLastSyncTime(status.lastSyncedAt)}
        </span>
      )}
    </div>
  );
};

const CheckIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const SpinnerIcon = () => <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>;
const WarningIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const OfflineIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" /></svg>;
const ErrorIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
