import { Solar, Lunar } from 'lunar-javascript';
import { setYear, setMonth, setDate } from 'date-fns';

export interface StaticHoliday {
  name: string;
  month: number; // 1-indexed
  day: number;
  isSolar: boolean;
}

const STATIC_HOLIDAYS: StaticHoliday[] = [
  { name: '신정', month: 1, day: 1, isSolar: true },
  { name: '삼일절', month: 3, day: 1, isSolar: true },
  { name: '어린이날', month: 5, day: 5, isSolar: true },
  { name: '현충일', month: 6, day: 6, isSolar: true },
  { name: '광복절', month: 8, day: 15, isSolar: true },
  { name: '개천절', month: 10, day: 3, isSolar: true },
  { name: '한글날', month: 10, day: 9, isSolar: true },
  { name: '성탄절', month: 12, day: 25, isSolar: true },
  // Lunar holidays (Seollal, Buddha's Birthday, Chuseok) are calculated dynamically
];

export function getKoreanHolidays(year: number) {
  const holidays: { name: string; date: Date }[] = [];

  // 1. Static Solar Holidays
  STATIC_HOLIDAYS.forEach(h => {
    if (h.isSolar) {
      holidays.push({
        name: h.name,
        date: new Date(year, h.month - 1, h.day)
      });
    }
  });

  // 2. Lunar Holidays
  // Seollal (Previous day, Day, Next day)
  const seollal = Lunar.fromYmd(year, 1, 1).getSolar();
  const seollalStart = new Date(seollal.getYear(), seollal.getMonth() - 1, seollal.getDay());
  const prevSeollal = new Date(seollalStart);
  prevSeollal.setDate(seollalStart.getDate() - 1);
  const nextSeollal = new Date(seollalStart);
  nextSeollal.setDate(seollalStart.getDate() + 1);

  holidays.push({ name: '설날 연휴', date: prevSeollal });
  holidays.push({ name: '설날', date: seollalStart });
  holidays.push({ name: '설날 연휴', date: nextSeollal });

  // Buddha's Birthday
  const buddha = Lunar.fromYmd(year, 4, 8).getSolar();
  holidays.push({
    name: '부처님오신날',
    date: new Date(buddha.getYear(), buddha.getMonth() - 1, buddha.getDay())
  });

  // Chuseok (Previous day, Day, Next day)
  const chuseok = Lunar.fromYmd(year, 8, 15).getSolar();
  const chuseokStart = new Date(chuseok.getYear(), chuseok.getMonth() - 1, chuseok.getDay());
  const prevChuseok = new Date(chuseokStart);
  prevChuseok.setDate(chuseokStart.getDate() - 1);
  const nextChuseok = new Date(chuseokStart);
  nextChuseok.setDate(chuseokStart.getDate() + 1);

  holidays.push({ name: '추석 연휴', date: prevChuseok });
  holidays.push({ name: '추석', date: chuseokStart });
  holidays.push({ name: '추석 연휴', date: nextChuseok });

  return holidays;
}
