import { convertToHtml } from '../../utils/templateEngine';

interface TemplatePreviewProps {
  subject: string;
  body: string;
  onCopy?: () => void;
}

export const TemplatePreview = ({ subject, body, onCopy }: TemplatePreviewProps) => {
  const handleCopy = async () => {
    const text = `제목: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      onCopy?.();
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          이메일 미리보기
        </h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          복사
        </button>
      </div>

      {/* 이메일 프리뷰 */}
      <div className="p-4 space-y-4">
        {/* 제목 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            제목
          </label>
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white font-medium">
            {subject || '(제목 없음)'}
          </div>
        </div>

        {/* 본문 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            본문
          </label>
          <div
            className="px-3 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 leading-relaxed min-h-[200px] whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: convertToHtml(body) || '(본문 없음)' }}
          />
        </div>
      </div>
    </div>
  );
};
