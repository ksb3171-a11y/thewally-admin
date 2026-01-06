import { useAuth } from '../../contexts/AuthContext';

export const UserProfile = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
      <img
        src={user.picture}
        alt={user.name}
        className="w-12 h-12 rounded-full"
      />
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
      </div>
      <button
        onClick={logout}
        className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
      >
        로그아웃
      </button>
    </div>
  );
};
