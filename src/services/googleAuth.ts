import type { UserInfo } from '../types';
import { saveAccessToken, saveUserInfo, removeAccessToken, removeUserInfo } from './localStorage';

const GOOGLE_TOKEN_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleCredentialResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export const fetchUserInfo = async (accessToken: string): Promise<UserInfo> => {
  const response = await fetch(GOOGLE_TOKEN_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = await response.json();
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
};

export const handleGoogleLogin = async (tokenResponse: GoogleCredentialResponse): Promise<UserInfo> => {
  const { access_token } = tokenResponse;
  saveAccessToken(access_token);
  const userInfo = await fetchUserInfo(access_token);
  saveUserInfo(userInfo);
  return userInfo;
};

export const handleGoogleLogout = (): void => {
  removeAccessToken();
  removeUserInfo();
};

export const validateToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    return response.ok;
  } catch {
    return false;
  }
};
