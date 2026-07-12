import React from 'react';
import { usePWA } from '@/context/PWAContext';

export const InstallPWAButton: React.FC = () => {
  const { isInstallable, isStandalone, promptInstall } = usePWA();

  // Hide button if already installed in standalone mode or prompt is unavailable
  if (isStandalone || !isInstallable) {
    return null;
  }

  return (
    <button
      onClick={promptInstall}
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
      title="Install MATS App on Desktop or Mobile"
    >
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span>Install App</span>
    </button>
  );
};
