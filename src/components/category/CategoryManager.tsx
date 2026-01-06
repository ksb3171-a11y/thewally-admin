import { useState, useRef } from 'react';
import type { MainCategory, SubCategory } from '../../types';
import { useData } from '../../contexts/DataContext';
import { Modal, ConfirmModal } from '../common/Modal';

export const CategoryManager = () => {
  const { data, addSubCategory, updateSubCategory, deleteSubCategory, reorderSubCategories, addDetailCategory, updateDetailCategory, deleteDetailCategory, resetCategories } = useData();
  const [activeTab, setActiveTab] = useState<MainCategory>('expense');
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  // 드래그앤드롭 상태
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [showAddDetailModal, setShowAddDetailModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedSubForDetail, setSelectedSubForDetail] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'sub' | 'detail'; id: string; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const subCategories = data.subCategories
    .filter((s) => s.mainCategory === activeTab)
    .sort((a, b) => a.order - b.order);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSubs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSubs(newExpanded);
  };

  const handleEditSub = (id: string, name: string) => {
    setEditingSubId(id);
    setEditName(name);
  };

  const handleSaveSubEdit = () => {
    if (editingSubId && editName.trim()) {
      updateSubCategory(editingSubId, { name: editName.trim() });
    }
    setEditingSubId(null);
    setEditName('');
  };

  const handleEditDetail = (id: string, name: string) => {
    setEditingDetailId(id);
    setEditName(name);
  };

  const handleSaveDetailEdit = () => {
    if (editingDetailId && editName.trim()) {
      updateDetailCategory(editingDetailId, { name: editName.trim() });
    }
    setEditingDetailId(null);
    setEditName('');
  };

  const handleAddSub = () => {
    if (newName.trim()) {
      addSubCategory(newName.trim(), activeTab);
      setNewName('');
      setShowAddSubModal(false);
    }
  };

  const handleAddDetail = () => {
    if (newName.trim() && selectedSubForDetail) {
      addDetailCategory(newName.trim(), selectedSubForDetail);
      setNewName('');
      setShowAddDetailModal(false);
      setSelectedSubForDetail(null);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'sub') {
      deleteSubCategory(deleteTarget.id);
    } else {
      deleteDetailCategory(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  // 드래그앤드롭 핸들러
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, sub: SubCategory) => {
    setDraggedId(sub.id);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sub.id);
    // 드래그 시작 시 약간의 투명도 적용
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1';
    }
    setDraggedId(null);
    setDragOverId(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, subId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== subId) {
      setDragOverId(subId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const currentOrder = subCategories.map(s => s.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // 순서 재배열
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    reorderSubCategories(newOrder);
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          지출 카테고리
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
            activeTab === 'income' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          수입 카테고리
        </button>
      </div>

      {/* 중분류 추가 버튼 */}
      <button
        onClick={() => setShowAddSubModal(true)}
        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        + 중분류 추가
      </button>

      {/* 카테고리 트리 */}
      <div className="space-y-2">
        {subCategories.map((sub) => {
          const details = data.detailCategories
            .filter((d) => d.subCategoryId === sub.id)
            .sort((a, b) => a.order - b.order);
          const isExpanded = expandedSubs.has(sub.id);

          return (
            <div
              key={sub.id}
              draggable
              onDragStart={(e) => handleDragStart(e, sub)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, sub.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, sub.id)}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all ${
                dragOverId === sub.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
              } ${draggedId === sub.id ? 'opacity-50' : ''}`}
            >
              {/* 중분류 */}
              <div className="flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {/* 드래그 핸들 */}
                <div className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
                <button onClick={() => toggleExpand(sub.id)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {editingSubId === sub.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSaveSubEdit}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveSubEdit()}
                    className="flex-1 px-2 py-1 border rounded"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 font-medium text-gray-900 dark:text-white">{sub.name}</span>
                )}

                <span className="text-sm text-gray-400">{details.length}개</span>

                <button
                  onClick={() => { setSelectedSubForDetail(sub.id); setShowAddDetailModal(true); }}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  title="소분류 추가"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </button>
                <button
                  onClick={() => handleEditSub(sub.id, sub.name)}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  title="수정"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button
                  onClick={() => setDeleteTarget({ type: 'sub', id: sub.id, name: sub.name })}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="삭제"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              {/* 소분류 목록 */}
              {isExpanded && details.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {details.map((detail) => (
                    <div key={detail.id} className="flex items-center gap-2 px-3 py-2 pl-10 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      {editingDetailId === detail.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={handleSaveDetailEdit}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveDetailEdit()}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{detail.name}</span>
                      )}
                      <button
                        onClick={() => handleEditDetail(detail.id, detail.name)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="수정"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ type: 'detail', id: detail.id, name: detail.name })}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 초기화 버튼 */}
      <button
        onClick={() => setShowResetConfirm(true)}
        className="w-full py-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
      >
        기본 카테고리로 초기화
      </button>

      {/* 모달들 */}
      <Modal isOpen={showAddSubModal} onClose={() => setShowAddSubModal(false)} title="새 중분류 추가">
        <div className="space-y-4">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="중분류명 입력" className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg" autoFocus />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowAddSubModal(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">취소</button>
            <button onClick={handleAddSub} className="px-4 py-2 text-white bg-blue-500 rounded-lg">추가</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAddDetailModal} onClose={() => { setShowAddDetailModal(false); setSelectedSubForDetail(null); }} title="새 소분류 추가">
        <div className="space-y-4">
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="소분류명 입력" className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg" autoFocus />
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowAddDetailModal(false); setSelectedSubForDetail(null); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">취소</button>
            <button onClick={handleAddDetail} className="px-4 py-2 text-white bg-blue-500 rounded-lg">추가</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.type === 'sub' ? '중분류 삭제' : '소분류 삭제'}
        message={deleteTarget?.type === 'sub'
          ? `"${deleteTarget?.name}" 중분류와 하위 소분류가 모두 삭제됩니다. 해당 카테고리를 사용한 거래 내역은 유지됩니다.`
          : `"${deleteTarget?.name}" 소분류를 삭제하시겠습니까?`}
        confirmText="삭제"
      />

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={resetCategories}
        title="카테고리 초기화"
        message="모든 카테고리가 기본값으로 초기화됩니다. 기존 거래 내역은 유지됩니다."
        confirmText="초기화"
      />
    </div>
  );
};
