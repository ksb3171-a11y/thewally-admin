import { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { SyncStatusComponent } from './SyncStatus';
import { formatMonth } from '../../utils/format';

interface HeaderProps {
  selectedYear: number;
  selectedMonth: number;
  onMonthChange: (year: number, month: number) => void;
}

// 날씨 정보 타입
interface WeatherInfo {
  temp: number;
  description: string;
  icon: string;
  location: string;
}

// 날씨 아이콘 매핑
const getWeatherEmoji = (icon: string): string => {
  const iconMap: Record<string, string> = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️',
  };
  return iconMap[icon] || '🌤️';
};

export const Header = ({ selectedYear, selectedMonth, onMonthChange }: HeaderProps) => {
  const { isAuthenticated, user, login } = useAuth();
  const { syncStatus, manualSync } = useData();
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // 현재 날짜/시간 상태
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // 1초마다 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 날씨 정보 가져오기
  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        // OpenWeatherMap API (무료 플랜)
        const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
        if (!API_KEY) {
          setWeatherLoading(false);
          return;
        }

        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`
        );

        if (response.ok) {
          const data = await response.json();
          setWeather({
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            location: data.name,
          });
        }
      } catch (error) {
        console.error('날씨 정보 가져오기 실패:', error);
      } finally {
        setWeatherLoading(false);
      }
    };

    // 위치 정보 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // 위치 권한 거부 시 서울 기본값 사용
          fetchWeather(37.5665, 126.9780);
        }
      );
    } else {
      // Geolocation 미지원 시 서울 기본값
      fetchWeather(37.5665, 126.9780);
    }
  }, []);

  // 날짜 포맷
  const formatDate = (date: Date): string => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayName = days[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${dayName})`;
  };

  // 시간 포맷
  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours < 12 ? '오전' : '오후';
    const displayHours = hours % 12 || 12;
    return `${ampm} ${displayHours}:${minutes}:${seconds}`;
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (response) => {
      login(response.access_token);
    },
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
  });

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      onMonthChange(selectedYear - 1, 11);
    } else {
      onMonthChange(selectedYear, selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      onMonthChange(selectedYear + 1, 0);
    } else {
      onMonthChange(selectedYear, selectedMonth + 1);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            더월리샵
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-sm font-normal ml-2">
            통합관리 프로그램 V1.0
          </span>
        </h1>

        <div className="flex items-center gap-4">
          {/* 날짜/시간/날씨 정보 */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            {/* 날짜 */}
            <div className="flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300">{formatDate(currentTime)}</span>
            </div>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            {/* 시간 */}
            <div className="flex items-center gap-1.5 text-sm">
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300 font-mono">{formatTime(currentTime)}</span>
            </div>
            {/* 날씨 */}
            {weather && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-lg">{getWeatherEmoji(weather.icon)}</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {weather.location} {weather.temp}°C
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {weather.description}
                  </span>
                </div>
              </>
            )}
            {weatherLoading && !weather && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-xs text-gray-400">날씨 로딩중...</span>
              </>
            )}
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setShowMonthPicker(!showMonthPicker)} className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              {formatMonth(selectedYear, selectedMonth)}
            </button>
            <button onClick={handleNextMonth} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Auth Status & Sync Status */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-700 dark:text-green-400">
                  {user?.name || '로그인됨'}
                </span>
              </div>
              <SyncStatusComponent status={syncStatus} onManualSync={manualSync} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">로그아웃</span>
              </div>
              <button
                onClick={() => googleLogin()}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">로그인</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
