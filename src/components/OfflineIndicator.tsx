import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-20 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-300 px-4 py-2.5 text-xs font-semibold text-amber-900 shadow-md"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-700" />
      <span>Koneksi terputus — menampilkan daftar favorit tersimpan.</span>
    </div>
  );
};
