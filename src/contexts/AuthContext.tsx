import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuthState } from '../types';
import { getAccessToken, getUserInfo, saveAccessToken, saveUserInfo, removeAccessToken, removeUserInfo } from '../services/localStorage';
import { validateToken, fetchUserInfo } from '../services/googleAuth';

interface AuthContextType extends AuthState {
  login: (accessToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    isLoading: true,
  });

  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      const savedUser = getUserInfo();

      if (token) {
        const isValid = await validateToken(token);
        if (isValid) {
          setState({ isAuthenticated: true, user: savedUser, accessToken: token, isLoading: false });
        } else {
          removeAccessToken();
          removeUserInfo();
          setState({ isAuthenticated: false, user: null, accessToken: null, isLoading: false });
        }
      } else {
        setState({ isAuthenticated: false, user: null, accessToken: null, isLoading: false });
      }
    };

    initAuth();
  }, []);

  const login = async (accessToken: string) => {
    saveAccessToken(accessToken);
    const userInfo = await fetchUserInfo(accessToken);
    saveUserInfo(userInfo);
    setState({ isAuthenticated: true, user: userInfo, accessToken, isLoading: false });
  };

  const logout = () => {
    removeAccessToken();
    removeUserInfo();
    setState({ isAuthenticated: false, user: null, accessToken: null, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
