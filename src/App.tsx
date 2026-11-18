import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Heart,
  LogIn,
  LogOut,
  Maximize2,
  Play,
  Plus,
  Trash2,
  Tv,
  Wifi,
  X,
} from 'lucide-react';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { VideoPlayer, type VideoPlayerHandle } from './components/VideoPlayer';
import {
  DAYS_OF_WEEK,
  getCurrentAndNextPrograms,
  getWibDayOfWeek,
  getWibTimeFormatted,
  HERO_POSTER_URL,
  POLA_SIAR_2026,
  PRIMARY_CHANNEL,
  PRIMARY_SRT_URL,
  type DayOfWeek,
} from './data/temanggungSchedule';
import { useFavorites } from './hooks/useFavorites';
import type { BroadcastChannel, FavoriteBroadcast, StreamQuality } from './types/broadcast';

type TVTab = 'live' | 'schedule' | 'favorites';

export default function App() {
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const {
    user,
    authReady,
    authError,
    syncing,
    favorites,
    preferences,
    isFavorited,
    saveFavorite,
    removeFavorite,
    updatePreferences,
    signInWithGoogle,
    signOutUser,
  } = useFavorites();

  const [activeTab, setActiveTab] = useState<TVTab>('live');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => getWibDayOfWeek());
  const [activeChannel, setActiveChannel] = useState<BroadcastChannel>(PRIMARY_CHANNEL);
  const [now, setNow] = useState<Date>(() => new Date());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customSrt, setCustomSrt] = useState('srt://');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Spatial D-Pad / TV Remote arrow-key navigation across focusable controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        void playerRef.current?.togglePlay();
        return;
      }

      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }

      const focusables = Array.from(
        document.querySelectorAll<HTMLElement>('.tv-focusable:not([disabled])')
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) return;

      const current = document.activeElement as HTMLElement | null;
      const currentIdx = current ? focusables.indexOf(current) : -1;

      if (currentIdx === -1) {
        e.preventDefault();
        focusables[0].focus();
        return;
      }

      const currentRect = focusables[currentIdx].getBoundingClientRect();
      const cx = currentRect.left + currentRect.width / 2;
      const cy = currentRect.top + currentRect.height / 2;

      let bestEl: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const candidate of focusables) {
        if (candidate === focusables[currentIdx]) continue;
        const r = candidate.getBoundingClientRect();
        const tx = r.left + r.width / 2;
        const ty = r.top + r.height / 2;
        const dx = tx - cx;
        const dy = ty - cy;

        const inDirection =
          (e.key === 'ArrowRight' && dx > 12) ||
          (e.key === 'ArrowLeft' && dx < -12) ||
          (e.key === 'ArrowDown' && dy > 12) ||
          (e.key === 'ArrowUp' && dy < -12);

        if (!inDirection) continue;

        const primaryDist = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
        const crossDist = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
        const score = primaryDist + crossDist * 2.2;

        if (score < bestScore) {
          bestScore = score;
          bestEl = candidate;
        }
      }

      if (bestEl) {
        e.preventDefault();
        bestEl.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2600);
  };

  const {
    day: todayWibDay,
    isOnSchedule,
    current: currentProgram,
    next: nextProgram,
  } = useMemo(() => getCurrentAndNextPrograms(now), [now]);

  const wibClock = useMemo(() => getWibTimeFormatted(now), [now]);
  const dayPrograms = useMemo(() => POLA_SIAR_2026[selectedDay], [selectedDay]);
  const isChannelFavorited = isFavorited(activeChannel.id);

  const handleToggleChannelFavorite = async () => {
    if (isChannelFavorited) {
      await removeFavorite(activeChannel.id);
      showToast(`${activeChannel.name} dihapus dari favorit`);
    } else {
      await saveFavorite({
        itemId: activeChannel.id,
        itemType: 'channel',
        title: activeChannel.name,
        category: activeChannel.category,
        scheduleTime: '10:00 – 22:05 WIB · Pola Siar 2026',
        streamUrl: activeChannel.srtUrl,
        reminderEnabled: true,
      });
      showToast(`${activeChannel.name} disimpan ke favorit`);
    }
  };

  const handleToggleProgramFavorite = async (progId: string) => {
    const allPrograms = Object.values(POLA_SIAR_2026).flat();
    const prog = allPrograms.find((p) => p.id === progId);
    if (!prog) return;
    if (isFavorited(prog.id)) {
      await removeFavorite(prog.id);
      showToast(`${prog.title} dihapus dari favorit`);
    } else {
      await saveFavorite({
        itemId: prog.id,
        itemType: 'program',
        title: prog.title,
        category: prog.category,
        scheduleTime: `${selectedDay}, ${prog.startTime} – ${prog.endTime} WIB`,
        streamUrl: prog.streamUrl,
        reminderEnabled: true,
      });
      showToast(`${prog.title} disimpan ke favorit`);
    }
  };

  const handleAddCustomChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomFormError(null);
    const trimmedName = customName.trim();
    const trimmedUrl = customSrt.trim();
    if (!trimmedName) {
      setCustomFormError('Nama siaran wajib diisi.');
      return;
    }
    if (!/^srt:\/\/[a-zA-Z0-9.-]+:\d{1,5}(\?.*)?$/i.test(trimmedUrl)) {
      setCustomFormError('Format link SRT harus seperti srt://103.79.90.150:5320');
      return;
    }
    const id = `ch_${Date.now()}`;
    await saveFavorite({
      itemId: id,
      itemType: 'channel',
      title: trimmedName,
      category: 'Saluran SRT',
      scheduleTime: 'Siaran Langsung',
      streamUrl: trimmedUrl,
      reminderEnabled: false,
    });
    setCustomName('');
    setCustomSrt('srt://');
    setShowAddChannelModal(false);
    showToast(`${trimmedName} ditambahkan ke favorit`);
  };

  const handlePlayFavorite = (fav: FavoriteBroadcast) => {
    const normalizedUrl = fav.streamUrl || PRIMARY_SRT_URL;
    const isPrimary = normalizedUrl.toLowerCase() === PRIMARY_SRT_URL.toLowerCase();
    setActiveChannel({
      id: isPrimary ? PRIMARY_CHANNEL.id : fav.itemId,
      name: fav.itemType === 'channel' ? fav.title : `${PRIMARY_CHANNEL.name} · ${fav.title}`,
      tagline: fav.category,
      srtUrl: normalizedUrl,
      category: fav.category,
      posterUrl: HERO_POSTER_URL,
    });
    setActiveTab('live');
    showToast(`Memutar ${fav.title}`);
  };

  const handleQualitySelect = (q: StreamQuality) => {
    void updatePreferences({
      preferredQuality: q,
      dataSaver: q === '480p' ? preferences.dataSaver : false,
    });
    showToast(q === 'auto' ? 'Kualitas: Otomatis' : `Kualitas: ${q}`);
  };

  const handleToggleDataSaver = () => {
    const next = !preferences.dataSaver;
    void updatePreferences({
      dataSaver: next,
      preferredQuality: next ? '480p' : 'auto',
    });
    showToast(next ? 'Mode Lancar 480p aktif' : 'Kualitas kembali ke Otomatis');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <OfflineIndicator />

      {/* Clean Bright-White Header Matching Official Temanggung TV Logo */}
      <header className="sticky top-0 z-40 h-16 md:h-[72px] bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            aria-label="Beranda Temanggung TV"
            className="tv-focusable flex items-center rounded-lg py-1 shrink-0"
          >
            <img
              src="/temanggung-tv-logo.png"
              alt="Temanggung TV"
              className="h-8 sm:h-10 w-auto object-contain"
            />
          </button>

          <nav aria-label="Menu utama" className="hidden sm:flex items-center gap-6 md:gap-8 text-sm md:text-base font-semibold">
            {(
              [
                { id: 'live', label: 'Siaran TV' },
                { id: 'schedule', label: 'Pola Siar' },
                { id: 'favorites', label: `Favorit (${favorites.length})` },
              ] as const
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`tv-focusable min-h-[44px] px-2 py-2 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'text-[#D82425] border-[#D82425]'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden lg:block">
              <PWAInstallButton />
            </div>
            {authReady && user ? (
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="tv-focusable min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <span className="max-w-[120px] truncate">{user.displayName || user.email}</span>
                <LogOut className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="tv-focusable min-h-[44px] px-4 py-2 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>Masuk Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 pt-5 md:pt-7 pb-24 sm:pb-10">
        {authError && (
          <div className="mb-5 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
            {authError}
          </div>
        )}

        {/* TAB 1: SIARAN TV */}
        <div
          className={
            activeTab === 'live'
              ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start'
              : 'hidden'
          }
        >
          <section className="lg:col-span-8 space-y-4">
            <VideoPlayer
              ref={playerRef}
              channelId={activeChannel.id}
              channelName={activeChannel.name}
              srtUrl={activeChannel.srtUrl}
              preferredQuality={preferences.preferredQuality}
              dataSaver={preferences.dataSaver}
              autoPlay={preferences.autoPlay}
              onQualityChange={handleQualitySelect}
            />
          </section>

          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200 p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-[#D82425] tabular-nums">
                  {isOnSchedule ? 'Sedang Tayang' : 'Pola Siar 2026'} · {todayWibDay},{' '}
                  {currentProgram.startTime} – {currentProgram.endTime} WIB
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug text-balance">
                  {activeChannel.id === PRIMARY_CHANNEL.id
                    ? currentProgram.title
                    : activeChannel.name}
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {activeChannel.id === PRIMARY_CHANNEL.id
                    ? currentProgram.description
                    : `Saluran SRT (${activeChannel.srtUrl})`}
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void playerRef.current?.enterFullscreen()}
                  className="tv-focusable w-full min-h-[52px] px-4 py-3 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-sm sm:text-base font-semibold flex items-center justify-center gap-2.5 transition-colors"
                >
                  <Maximize2 className="w-5 h-5 shrink-0" />
                  <span>Layar Penuh TV</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleToggleChannelFavorite()}
                  className={`tv-focusable w-full min-h-[52px] px-4 py-3 rounded-xl border text-sm sm:text-base font-semibold flex items-center justify-center gap-2.5 transition-colors ${
                    isChannelFavorited
                      ? 'bg-[#D82425]/10 border-[#D82425] text-[#D82425]'
                      : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-900'
                  }`}
                >
                  {isChannelFavorited ? (
                    <BookmarkCheck className="w-5 h-5 shrink-0" />
                  ) : (
                    <Bookmark className="w-5 h-5 shrink-0" />
                  )}
                  <span>{isChannelFavorited ? 'Tersimpan di Favorit' : 'Simpan ke Favorit'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleDataSaver}
                  className={`tv-focusable w-full min-h-[52px] px-4 py-3 rounded-xl border text-sm sm:text-base font-semibold flex items-center justify-center gap-2.5 transition-colors ${
                    preferences.dataSaver
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-900'
                  }`}
                >
                  <Wifi className="w-5 h-5 shrink-0" />
                  <span>{preferences.dataSaver ? 'Mode Lancar 480p: Aktif' : 'Mode Lancar 480p'}</span>
                </button>

                {activeChannel.id !== PRIMARY_CHANNEL.id && (
                  <button
                    type="button"
                    onClick={() => setActiveChannel(PRIMARY_CHANNEL)}
                    className="tv-focusable w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                  >
                    Kembali ke Temanggung TV
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Acara Berikutnya</span>
                <span className="text-xs font-medium text-slate-500 tabular-nums">
                  {nextProgram.startTime} – {nextProgram.endTime} WIB
                </span>
              </div>
              <div className="text-base font-bold text-slate-900">{nextProgram.title}</div>
              <div className="text-xs text-slate-600">{nextProgram.category}</div>
            </div>
          </aside>
        </div>

        {/* TAB 2: POLA SIAR 2026 (7-DAY SCHEDULE) */}
        {activeTab === 'schedule' && (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 tabular-nums">
                  Pola Siar 2026 · Hari ini {todayWibDay}, {wibClock} WIB
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Jadwal Acara Temanggung TV
                </h1>
              </div>

              {/* 7-Day Selector for Android TV D-Pad & Touch */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F8FAFC] border border-slate-200 overflow-x-auto no-scrollbar">
                {DAYS_OF_WEEK.map((day) => {
                  const active = selectedDay === day;
                  const isToday = day === todayWibDay;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`tv-focusable min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-[#D82425] text-white'
                          : 'text-slate-700 hover:bg-slate-200/70'
                      }`}
                    >
                      {isToday ? `${day} (Hari Ini)` : day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {dayPrograms.map((prog) => {
                const isLiveNow = selectedDay === todayWibDay && isOnSchedule && prog.id === currentProgram.id;
                const saved = isFavorited(prog.id);
                return (
                  <div
                    key={prog.id}
                    className={`rounded-2xl bg-white border p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors ${
                      isLiveNow ? 'border-[#D82425] bg-[#D82425]/[0.03]' : 'border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
                        {isLiveNow && (
                          <>
                            <span className="font-bold text-[#D82425]">Sedang Tayang</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="font-semibold text-slate-800">
                          {prog.startTime} – {prog.endTime} WIB
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{prog.category}</span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                        {prog.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isLiveNow && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChannel(PRIMARY_CHANNEL);
                            setActiveTab('live');
                          }}
                          className="tv-focusable min-h-[44px] px-3.5 py-2 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Tonton</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleToggleProgramFavorite(prog.id)}
                        aria-label={saved ? `Hapus ${prog.title} dari favorit` : `Simpan ${prog.title} ke favorit`}
                        className={`tv-focusable min-w-[44px] min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                          saved
                            ? 'border-[#D82425] bg-[#D82425]/10 text-[#D82425]'
                            : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
                        <span className="hidden sm:inline">{saved ? 'Favorit' : 'Simpan'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: FAVORIT PENGGUNA */}
        {activeTab === 'favorites' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500">
                  {user
                    ? `Tersinkron ke akun ${user.email || user.displayName}${syncing ? ' · Memuat...' : ''}`
                    : 'Tersimpan di perangkat ini · Masuk Google untuk sinkronisasi antar TV & HP'}
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Siaran Favorit
                </h1>
              </div>

              <button
                type="button"
                onClick={() => setShowAddChannelModal(true)}
                className="tv-focusable min-h-[48px] px-5 py-2.5 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Link SRT</span>
              </button>
            </div>

            {favorites.length === 0 ? (
              <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200 p-10 text-center space-y-4 max-w-xl mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#D82425]/10 text-[#D82425] flex items-center justify-center mx-auto">
                  <Bookmark className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-slate-900">Belum Ada Siaran Favorit</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Simpan Temanggung TV atau acara favorit dari Pola Siar 2026 agar mudah diputar langsung dari layar Android TV.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleToggleChannelFavorite()}
                    className="tv-focusable min-h-[48px] px-5 py-2.5 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-sm font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>Simpan Temanggung TV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('schedule')}
                    className="tv-focusable min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-colors"
                  >
                    Lihat Pola Siar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-500">
                        <span>{fav.category}</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span className="tabular-nums">{fav.scheduleTime}</span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">{fav.title}</h2>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handlePlayFavorite(fav)}
                        className="tv-focusable flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Tonton</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void removeFavorite(fav.id)}
                        aria-label={`Hapus ${fav.title}`}
                        className="tv-focusable min-w-[48px] min-h-[48px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:border-rose-300 text-slate-700 hover:text-rose-700 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Compact Mobile Bottom Nav (Shown only on very small phone screens < 640px) */}
      <nav
        aria-label="Navigasi ponsel"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-3 items-center h-16">
          {(
            [
              { id: 'live', label: 'Siaran TV', icon: Tv },
              { id: 'schedule', label: 'Pola Siar', icon: CalendarClock },
              {
                id: 'favorites',
                label: favorites.length > 0 ? `Favorit (${favorites.length})` : 'Favorit',
                icon: Bookmark,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-[#D82425]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal: Tambah Saluran SRT Favorit */}
      {showAddChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form
            onSubmit={(e) => void handleAddCustomChannel(e)}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Tambah Saluran SRT Favorit</h3>
              <button
                type="button"
                onClick={() => setShowAddChannelModal(false)}
                aria-label="Tutup"
                className="tv-focusable min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customFormError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-800">
                {customFormError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Siaran
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Contoh: Temanggung TV Cadangan"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#D82425]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alamat Link SRT
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={customSrt}
                  onChange={(e) => setCustomSrt(e.target.value)}
                  placeholder="srt://103.79.90.150:5320"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-white border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:border-[#D82425]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowAddChannelModal(false)}
                className="tv-focusable flex-1 min-h-[48px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="tv-focusable flex-1 min-h-[48px] rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-sm font-semibold text-white"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clean White Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-xl whitespace-nowrap"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
