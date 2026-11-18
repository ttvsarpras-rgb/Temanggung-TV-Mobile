import type { BroadcastChannel, ProgramItem } from '../types/broadcast';

export const PRIMARY_SRT_URL = 'srt://103.79.90.150:5320';
export const PRIMARY_CHANNEL_ID = 'temanggung-tv';

export const HERO_POSTER_URL = '/src/assets/images/temanggung_landscape_hero_1794965653942.jpg';

export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

export const PRIMARY_CHANNEL: BroadcastChannel = {
  id: PRIMARY_CHANNEL_ID,
  name: 'Temanggung TV',
  tagline: 'Layar Kebanggaan Bumi Phala',
  srtUrl: PRIMARY_SRT_URL,
  category: 'Siaran Langsung',
  posterUrl: HERO_POSTER_URL,
};

interface RawSlot {
  startTime: string;
  endTime: string;
  title: string;
  category: string;
}

const COMMON_OPENING: RawSlot[] = [
  { startTime: '10:00', endTime: '10:05', title: 'Indonesia Raya', category: 'Pembukaan' },
  { startTime: '10:05', endTime: '11:00', title: 'Profil Temanggung', category: 'Profil Daerah' },
];

const COMMON_CLOSING: RawSlot = {
  startTime: '22:00',
  endTime: '22:05',
  title: 'Closing Indonesia Pusaka',
  category: 'Penutup',
};

function buildDayPrograms(day: DayOfWeek, slots: RawSlot[]): ProgramItem[] {
  const daySlug = day.toLowerCase();
  return slots.map((slot, idx) => ({
    id: `ps2026_${daySlug}_${idx}_${slot.startTime.replace(':', '')}`,
    title: slot.title,
    category: slot.category,
    startTime: slot.startTime,
    endTime: slot.endTime,
    description: `Tayangan ${slot.title} (${slot.category}) pada Pola Siar 2026 Temanggung TV hari ${day}.`,
    host: 'Temanggung TV',
    thumbnailUrl: HERO_POSTER_URL,
    streamUrl: PRIMARY_SRT_URL,
  }));
}

export const POLA_SIAR_2026: Record<DayOfWeek, ProgramItem[]> = {
  Senin: buildDayPrograms('Senin', [
    ...COMMON_OPENING,
    { startTime: '11:00', endTime: '11:30', title: 'Bugar', category: 'Olahraga' },
    { startTime: '11:30', endTime: '12:00', title: 'Lensa Kampus', category: 'Pendidikan' },
    { startTime: '12:00', endTime: '12:30', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '12:30', endTime: '13:00', title: 'Nglaras Rasa', category: 'Kuliner & Gaya Hidup' },
    { startTime: '13:00', endTime: '14:00', title: 'Pawarta (RR)', category: 'Berita Jawa' },
    { startTime: '14:00', endTime: '15:00', title: 'Keluarga Sehat', category: 'Kesehatan' },
    { startTime: '15:00', endTime: '16:00', title: 'Lebih Dekat', category: 'Bincang Daerah' },
    { startTime: '16:00', endTime: '17:00', title: 'Mutiara Hati (New)', category: 'Religi' },
    { startTime: '17:00', endTime: '17:30', title: 'Kabar Temanggung Tapping', category: 'Berita' },
    { startTime: '17:30', endTime: '18:00', title: 'Cerita Usaha', category: 'UMKM' },
    { startTime: '18:00', endTime: '18:30', title: 'Pawarta', category: 'Berita Utama' },
    { startTime: '18:30', endTime: '19:30', title: 'Irama Dangdut (RR)', category: 'Musik' },
    { startTime: '19:30', endTime: '20:00', title: 'Cahaya Kasih (New)', category: 'Religi' },
    { startTime: '20:00', endTime: '20:30', title: 'Momong Temanggung (New)', category: 'Keluarga' },
    { startTime: '20:30', endTime: '21:00', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '21:00', endTime: '22:00', title: 'Melodi Kenangan (New)', category: 'Musik' },
    COMMON_CLOSING,
  ]),

  Selasa: buildDayPrograms('Selasa', [
    ...COMMON_OPENING,
    { startTime: '11:00', endTime: '11:30', title: 'Bugar', category: 'Olahraga' },
    { startTime: '11:30', endTime: '12:00', title: 'Public Milenial', category: 'Komunitas' },
    { startTime: '12:00', endTime: '12:30', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '12:30', endTime: '13:00', title: 'Musik Kita', category: 'Musik' },
    { startTime: '13:00', endTime: '14:00', title: 'Pawarta (RR)', category: 'Berita Jawa' },
    { startTime: '14:00', endTime: '16:00', title: 'Kethoprak', category: 'Budaya Jawa' },
    { startTime: '16:00', endTime: '17:00', title: 'Generasi Emas (New)', category: 'Pendidikan' },
    { startTime: '17:00', endTime: '17:30', title: 'Kabar Temanggung Tapping', category: 'Berita' },
    { startTime: '17:30', endTime: '18:00', title: 'Masakini', category: 'Kuliner & Tren' },
    { startTime: '18:00', endTime: '18:30', title: 'Pawarta', category: 'Berita Utama' },
    { startTime: '18:30', endTime: '19:30', title: 'Tembako (New)', category: 'Agrobisnis' },
    { startTime: '19:30', endTime: '20:00', title: 'Negeri Dongeng', category: 'Anak & Keluarga' },
    { startTime: '20:00', endTime: '20:30', title: 'English Fun', category: 'Edukasi' },
    { startTime: '20:30', endTime: '21:00', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '21:00', endTime: '22:00', title: 'Nglaras Rasa (New)', category: 'Kuliner & Gaya Hidup' },
    COMMON_CLOSING,
  ]),

  Rabu: buildDayPrograms('Rabu', [
    ...COMMON_OPENING,
    { startTime: '11:00', endTime: '11:30', title: 'Bugar', category: 'Olahraga' },
    { startTime: '11:30', endTime: '12:00', title: 'Sinelok', category: 'Kreatif Lokal' },
    { startTime: '12:00', endTime: '12:30', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '12:30', endTime: '13:00', title: 'Melodi Kenangan', category: 'Musik' },
    { startTime: '13:00', endTime: '14:00', title: 'Pawarta (RR)', category: 'Berita Jawa' },
    { startTime: '14:00', endTime: '15:00', title: 'Momongan', category: 'Keluarga' },
    { startTime: '15:00', endTime: '16:00', title: 'Musik Kita (RR)', category: 'Musik' },
    { startTime: '16:00', endTime: '17:00', title: 'Qasima', category: 'Religi & Musik' },
    { startTime: '17:00', endTime: '17:30', title: 'Kabar Temanggung Tapping', category: 'Berita' },
    { startTime: '17:30', endTime: '18:00', title: 'Nyamleng', category: 'Kuliner' },
    { startTime: '18:00', endTime: '18:30', title: 'Pawarta', category: 'Berita Utama' },
    { startTime: '18:30', endTime: '19:30', title: 'Nuansa Hikmah (New)', category: 'Religi' },
    { startTime: '19:30', endTime: '20:00', title: 'Paripurna Budhi (New)', category: 'Budaya & Tokoh' },
    { startTime: '20:00', endTime: '20:30', title: 'Kepoin Yuk (Podcast Kominfo) (New)', category: 'Informasi Publik' },
    { startTime: '20:30', endTime: '21:00', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '21:00', endTime: '22:00', title: 'Irama Dangdut (New)', category: 'Musik' },
    COMMON_CLOSING,
  ]),

  Kamis: buildDayPrograms('Kamis', [
    ...COMMON_OPENING,
    { startTime: '11:00', endTime: '11:30', title: 'Bugar', category: 'Olahraga' },
    { startTime: '11:30', endTime: '12:00', title: 'Lensa Kampus', category: 'Pendidikan' },
    { startTime: '12:00', endTime: '12:30', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '12:30', endTime: '13:00', title: 'Irama Dangdut', category: 'Musik' },
    { startTime: '13:00', endTime: '14:00', title: 'Pawarta (RR)', category: 'Berita Jawa' },
    { startTime: '14:00', endTime: '16:00', title: 'Kethoprak', category: 'Budaya Jawa' },
    { startTime: '16:00', endTime: '17:00', title: 'Mutiara Hati (RR)', category: 'Religi' },
    { startTime: '17:00', endTime: '17:30', title: 'Kabar Temanggung Tapping', category: 'Berita' },
    { startTime: '17:30', endTime: '18:00', title: 'Cerita Usaha (RR)', category: 'UMKM' },
    { startTime: '18:00', endTime: '18:30', title: 'Pawarta', category: 'Berita Utama' },
    { startTime: '18:30', endTime: '19:30', title: 'Nglaras Rasa (RR)', category: 'Kuliner & Gaya Hidup' },
    { startTime: '19:30', endTime: '20:00', title: 'Cahaya Kasih (RR)', category: 'Religi' },
    { startTime: '20:00', endTime: '20:30', title: 'Momong Temanggung (RR)', category: 'Keluarga' },
    { startTime: '20:30', endTime: '21:00', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '21:00', endTime: '22:00', title: 'Melodi Kenangan (RR)', category: 'Musik' },
    COMMON_CLOSING,
  ]),

  Jumat: buildDayPrograms('Jumat', [
    ...COMMON_OPENING,
    { startTime: '11:00', endTime: '11:30', title: 'Bugar', category: 'Olahraga' },
    { startTime: '11:30', endTime: '12:00', title: 'Public Milenial', category: 'Komunitas' },
    { startTime: '12:00', endTime: '12:30', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '12:30', endTime: '13:00', title: 'Nglaras Rasa', category: 'Kuliner & Gaya Hidup' },
    { startTime: '13:00', endTime: '14:00', title: 'Pawarta (RR)', category: 'Berita Jawa' },
    { startTime: '14:00', endTime: '15:00', title: 'Keluarga Sehat', category: 'Kesehatan' },
    { startTime: '15:00', endTime: '16:00', title: 'Melodi Kenangan (RR)', category: 'Musik' },
    { startTime: '16:00', endTime: '17:00', title: 'Generasi Emas (RR)', category: 'Pendidikan' },
    { startTime: '17:00', endTime: '17:30', title: 'Kabar Temanggung Tapping', category: 'Berita' },
    { startTime: '17:30', endTime: '18:00', title: 'Masakini (RR)', category: 'Kuliner & Tren' },
    { startTime: '18:00', endTime: '18:30', title: 'Pawarta', category: 'Berita Utama' },
    { startTime: '18:30', endTime: '19:30', title: 'Tembako (RR)', category: 'Agrobisnis' },
    { startTime: '19:30', endTime: '20:00', title: 'Negeri Dongeng', category: 'Anak & Keluarga' },
    { startTime: '20:00', endTime: '20:30', title: 'English Fun', category: 'Edukasi' },
    { startTime: '20:30', endTime: '21:00', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '21:00', endTime: '22:00', title: 'Irama Dangdut (RR)', category: 'Musik' },
    COMMON_CLOSING,
  ]),

  Sabtu: buildDayPrograms('Sabtu', [
    ...COMMON_OPENING,
    { startTime: '11:00', endTime: '11:30', title: 'Bugar', category: 'Olahraga' },
    { startTime: '11:30', endTime: '12:00', title: 'Sinelok', category: 'Kreatif Lokal' },
    { startTime: '12:00', endTime: '12:30', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '12:30', endTime: '13:00', title: 'Melodi Kenangan', category: 'Musik' },
    { startTime: '13:00', endTime: '14:00', title: 'Pawarta (RR)', category: 'Berita Jawa' },
    { startTime: '14:00', endTime: '15:00', title: 'Momongan', category: 'Keluarga' },
    { startTime: '15:00', endTime: '16:00', title: 'Sore / Pamirso', category: 'Hiburan Daerah' },
    { startTime: '16:00', endTime: '17:00', title: 'Qasima', category: 'Religi & Musik' },
    { startTime: '17:00', endTime: '17:30', title: 'Kabar Temanggung Tapping', category: 'Berita' },
    { startTime: '17:30', endTime: '18:00', title: 'Nyamleng (RR)', category: 'Kuliner' },
    { startTime: '18:00', endTime: '18:30', title: 'Pawarta', category: 'Berita Utama' },
    { startTime: '18:30', endTime: '19:30', title: 'Nuansa Hikmah (RR)', category: 'Religi' },
    { startTime: '19:30', endTime: '20:00', title: 'Paripurna Budhi (RR)', category: 'Budaya & Tokoh' },
    { startTime: '20:00', endTime: '20:30', title: 'Road Show Minggon (RR)', category: 'Jelajah Daerah' },
    { startTime: '20:30', endTime: '21:00', title: 'Kabar Temanggung (RR)', category: 'Berita' },
    { startTime: '21:00', endTime: '22:00', title: 'Musik Kita (New)', category: 'Musik' },
    COMMON_CLOSING,
  ]),

  Minggu: buildDayPrograms('Minggu', [
    ...COMMON_OPENING,
    { startTime: '11:00', endTime: '12:00', title: 'Njo Nang Temanggung', category: 'Wisata & Budaya' },
    { startTime: '12:00', endTime: '13:00', title: 'Generasi Emas (RR)', category: 'Pendidikan' },
    { startTime: '13:00', endTime: '14:00', title: 'Nuansa Hikmah (RR)', category: 'Religi' },
    { startTime: '14:00', endTime: '15:00', title: 'Nglaras Rasa (RR)', category: 'Kuliner & Gaya Hidup' },
    { startTime: '15:00', endTime: '16:00', title: 'Musik Kita (RR)', category: 'Musik' },
    { startTime: '16:00', endTime: '16:30', title: 'Kepoin Yuk (Podcast Kominfo) (RR)', category: 'Informasi Publik' },
    { startTime: '16:30', endTime: '17:00', title: 'Road Show Minggon (New)', category: 'Jelajah Daerah' },
    { startTime: '17:00', endTime: '18:00', title: 'Kabar Temanggung Sepekan', category: 'Berita Sepekan' },
    { startTime: '18:00', endTime: '19:00', title: 'Melodi Kenangan', category: 'Musik' },
    { startTime: '19:00', endTime: '20:00', title: 'Irama Dangdut (RR)', category: 'Musik' },
    { startTime: '20:00', endTime: '22:00', title: 'Ketoprak (New)', category: 'Budaya Jawa' },
    COMMON_CLOSING,
  ]),
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function getWibTimeFormatted(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function getWibDayOfWeek(date: Date = new Date()): DayOfWeek {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
  }).format(date);

  const map: Record<string, DayOfWeek> = {
    Mon: 'Senin',
    Tue: 'Selasa',
    Wed: 'Rabu',
    Thu: 'Kamis',
    Fri: 'Jumat',
    Sat: 'Sabtu',
    Sun: 'Minggu',
  };
  return map[weekday] ?? 'Senin';
}

export function getWibMinutes(date: Date = new Date()): number {
  const wibStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return timeToMinutes(wibStr);
}

export function getCurrentAndNextPrograms(date: Date = new Date()): {
  day: DayOfWeek;
  isOnSchedule: boolean;
  current: ProgramItem;
  next: ProgramItem;
} {
  const day = getWibDayOfWeek(date);
  const programs = POLA_SIAR_2026[day];
  const nowMinutes = getWibMinutes(date);

  const currentIdx = programs.findIndex((prog) => {
    const start = timeToMinutes(prog.startTime);
    const end = timeToMinutes(prog.endTime);
    return nowMinutes >= start && nowMinutes < end;
  });

  if (currentIdx >= 0) {
    const nextIdx = (currentIdx + 1) % programs.length;
    return {
      day,
      isOnSchedule: true,
      current: programs[currentIdx],
      next: programs[nextIdx],
    };
  }

  // Outside 10:00 - 22:05 WIB broadcast window
  const nextDayIdx = (DAYS_OF_WEEK.indexOf(day) + (nowMinutes >= timeToMinutes('22:05') ? 1 : 0)) % 7;
  const upcomingDay = DAYS_OF_WEEK[nextDayIdx];
  const upcomingProgram = POLA_SIAR_2026[upcomingDay][0];

  return {
    day,
    isOnSchedule: false,
    current: {
      id: `offair_${day.toLowerCase()}`,
      title: 'Siaran Temanggung TV',
      category: 'Pola Siar 10:00 – 22:05 WIB',
      startTime: '22:05',
      endTime: '10:00',
      description: `Siaran reguler Pola Siar 2026 berlangsung pukul 10:00 – 22:05 WIB. Pemutaran langsung tetap terhubung ke server SRT.`,
      host: 'Temanggung TV',
      thumbnailUrl: HERO_POSTER_URL,
      streamUrl: PRIMARY_SRT_URL,
    },
    next: upcomingProgram,
  };
}
