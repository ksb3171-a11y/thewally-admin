import { useState } from 'react';
import type { Asset } from '../../types';
import { getAssetData, addAsset, updateAsset, deleteAsset } from '../../services/localStorage';
import { formatCurrency, formatAmount, parseAmount } from '../../utils/format';

interface AssetManagerProps {
  onUpdate: () => void;
}

export const AssetManager = ({ onUpdate }: AssetManagerProps) => {
  const [assets, setAssets] = useState<Asset[]>(getAssetData().assets);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');

  const refreshAssets = () => {
    setAssets(getAssetData().assets);
    onUpdate();
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addAsset(newName.trim(), parseAmount(newBalance) || 0);
    setNewName('');
    setNewBalance('');
    refreshAssets();
  };

  const handleEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setEditName(asset.name);
    setEditBalance(formatAmount(String(asset.balance)));
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateAsset(editingId, {
      name: editName.trim(),
      balance: parseAmount(editBalance) || 0,
    });
    setEditingId(null);
    refreshAssets();
  };

  const handleDelete = (id: string) => {
    if (confirm('이 자산을 삭제하시겠습니까?')) {
      deleteAsset(id);
      refreshAssets();
    }
  };

  const totalBalance = assets.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-4">
      {/* 총 자산 표시 */}
      <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white">
        <p className="text-sm opacity-80">총 자산</p>
        <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
      </div>

      {/* 자산 목록 */}
      <div className="space-y-2">
        {assets.length === 0 ? (
          <p className="text-center text-gray-500 py-4">등록된 자산이 없습니다</p>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              {editingId === asset.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    placeholder="자산명"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editBalance}
                    onChange={(e) => setEditBalance(formatAmount(e.target.value))}
                    className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                    placeholder="금액"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-gray-900 dark:text-white font-medium">
                    {asset.name}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {formatCurrency(asset.balance)}
                  </span>
                  <button
                    onClick={() => handleEdit(asset)}
                    className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* 자산 추가 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="자산명 (예: 국민은행)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="text"
          inputMode="numeric"
          value={newBalance}
          onChange={(e) => setNewBalance(formatAmount(e.target.value))}
          placeholder="잔액"
          className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          추가
        </button>
      </div>
    </div>
  );
};
