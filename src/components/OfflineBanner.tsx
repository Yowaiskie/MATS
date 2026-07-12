import React from 'react';
import { usePWA } from '@/context/PWAContext';

export const OfflineBanner: React.FC = () => {
  const { isOffline } = usePWA();

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold text-center flex items-center justify-center gap-2 shadow-sm transition-all duration-200 animate-in slide-in-from-top">
      <svg className="w-4 h-4 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414M3 3l18 18" />
      </svg>
      <span>
        You are currently offline. Firestore records & real-time attendance require an active internet connection.
      </span>
    </div>
  );
};
