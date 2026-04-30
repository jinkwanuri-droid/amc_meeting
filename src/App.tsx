/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { setHours, setMinutes, startOfDay, addDays, getYear, parseISO, format } from 'date-fns';
import Sidebar from './components/Sidebar';
import WeeklyView from './components/WeeklyView';
import BookingModal from './components/BookingModal';
import SettingsModal from './components/SettingsModal';
import { Booking, Room, Holiday } from './types';
import { BOOKING_COLORS } from './constants';
import { getKoreanHolidays } from './lib/holidays';

export default function App() {
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<'week' | 'day'>('week');
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [holidays, setHolidays] = React.useState<Holiday[]>([]);
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // 데이터 초기 로딩
  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // 1. 회의실 가져오기
      const roomsRes = await fetch("/api/rooms");
      if (!roomsRes.ok) throw new Error(`Rooms fetch failed: ${roomsRes.status}`);
      const roomsData = await roomsRes.json();
      setRooms(Array.isArray(roomsData) ? roomsData : []);

      // 2. 예약 가져오기
      const bookingsRes = await fetch("/api/bookings");
      if (!bookingsRes.ok) throw new Error(`Bookings fetch failed: ${bookingsRes.status}`);
      const bookingsData = await bookingsRes.json();
      
      const mappedBookings = (Array.isArray(bookingsData) ? bookingsData : []).map((b: any) => {
        try {
          const parseDate = (val: any) => {
            if (!val) return new Date();
            if (val instanceof Date) return val;
            if (typeof val === 'number') return new Date(val);
            return parseISO(val);
          };

          return {
            id: b.id,
            title: b.title,
            roomId: b.room_id,
            startTime: parseDate(b.start_time),
            endTime: parseDate(b.end_time),
            organizer: b.organizer,
            description: b.description,
            color: b.color
          };
        } catch (e) {
          console.warn("Invalid booking date:", b, e);
          return null;
        }
      }).filter(Boolean) as Booking[];
      setBookings(mappedBookings);

      // 3. 공휴일 가져오기
      const currentYear = getYear(new Date());
      const basicKoreanHolidays = [...getKoreanHolidays(currentYear), ...getKoreanHolidays(currentYear + 1)];
      const basicHolidays = basicKoreanHolidays.map(h => ({ 
        id: `basic-${h.name}-${h.date.getTime()}`, 
        ...h 
      }));
      
      let customHolidaysData = [];
      try {
        const holidaysRes = await fetch("/api/holidays");
        if (holidaysRes.ok) {
          customHolidaysData = await holidaysRes.json();
        } else {
          console.warn(`Holidays API returned ${holidaysRes.status}`);
        }
      } catch (e) {
        console.warn("Could not fetch custom holidays:", e);
      }
      
      const mappedCustomHolidays = (Array.isArray(customHolidaysData) ? customHolidaysData : []).map((h: any) => {
        try {
          const parseDate = (val: any) => {
            if (!val) return new Date();
            if (val instanceof Date) return val;
            if (typeof val === 'number') return new Date(val);
            // Handle ISO strings from database
            return parseISO(val);
          };
          return {
            id: h.id,
            name: h.name,
            date: parseDate(h.date),
            isCustom: true
          };
        } catch (e) {
          console.warn("Invalid holiday date:", h, e);
          return null;
        }
      }).filter(Boolean) as Holiday[];

      // Sort holidays by date for better management view
      const allHolidays = [...basicHolidays, ...mappedCustomHolidays].sort((a, b) => a.date.getTime() - b.date.getTime());
      setHolidays(allHolidays);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Optional: set some UI state to show error
    } finally {
      setIsLoading(false);
    }
  };

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [editingBooking, setEditingBooking] = React.useState<Partial<Booking> | undefined>(undefined);

  const handleAddBooking = (date: Date, hour: number, minutes: number = 0, roomId?: string) => {
    setEditingBooking({
      startTime: setHours(setMinutes(startOfDay(date), minutes), hour),
      endTime: setHours(setMinutes(startOfDay(date), minutes), hour + 1),
      roomId: roomId || (rooms.length > 0 ? rooms[0].id : '')
    });
    setIsModalOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setIsModalOpen(true);
  };

  const handleSubmitBooking = async (bookingData: Omit<Booking, 'id'> & { id?: string }) => {
    // 중복 체크
    const hasOverlap = bookings.some(b => {
      // 본인이면 제외
      if (bookingData.id && String(b.id) === String(bookingData.id)) return false;
      
      // 같은 회의실인지 체크 (데이터 타입 다를 수 있으므로 문자열 변환후 비교)
      const isSameRoom = String(b.roomId) === String(bookingData.roomId);
      if (!isSameRoom) return false;
      
      const bStart = b.startTime.getTime();
      const bEnd = b.endTime.getTime();
      const newDataStart = bookingData.startTime.getTime();
      const newDataEnd = bookingData.endTime.getTime();

      // 시간 중첩 여부 (밀리초 단위 비교)
      const overlaps = newDataStart < bEnd && newDataEnd > bStart;
      
      return overlaps;
    });

    if (hasOverlap) {
      alert("기존 예약이 있어 저장할 수 없습니다.");
      return;
    }

    try {
      const dbPayload = {
        title: bookingData.title,
        room_id: bookingData.roomId,
        start_time: bookingData.startTime.toISOString(),
        end_time: bookingData.endTime.toISOString(),
        organizer: bookingData.organizer,
        description: bookingData.description,
        color: bookingData.color
      };

      const url = bookingData.id ? `/api/bookings/${bookingData.id}` : "/api/bookings";
      const method = bookingData.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbPayload)
      });

      if (!res.ok) throw new Error("Failed to save booking");
      
      fetchData(false); // 데이터 새로고침
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving booking:', error);
      alert('예약 저장 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteBooking = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete booking");
      
      fetchData(false);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  const handleUpdateRooms = async (newRooms: Room[]) => {
    // 긍정적 업데이트 (Optimistic Update)
    setRooms(newRooms);

    try {
      const payload = newRooms.map((r, i) => ({
        id: r.id,
        name: r.name || '새 회의실',
        color: r.color || 'bg-slate-400',
        capacity: r.capacity || 4,
        order: i
      }));

      const res = await fetch("/api/rooms/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Sync failed: ${res.status}`);
      }
      fetchData(false); // 최종 데이터 동기화
    } catch (error: any) {
      console.error('Error updating rooms:', error);
      alert(`회의실 저장 중 오류가 발생했습니다: ${error.message}`);
      fetchData(false); // 실패 시 원래대로 복구
    }
  };

  const handleUpdateHolidays = async (newHolidays: Holiday[]) => {
    // 필터링 및 매핑
    const currentYear = getYear(new Date());
    const basicIds = getKoreanHolidays(currentYear).map(h => `basic-${h.name}-${h.date.getTime()}`);
    
    // 로컬 상태 업데이트
    setHolidays(newHolidays);

    try {
      const customOnes = newHolidays.filter(h => h.isCustom).map(h => ({
        id: h.id,
        name: h.name,
        date: h.date instanceof Date ? format(h.date, 'yyyy-MM-dd') : h.date
      }));

      const res = await fetch("/api/holidays/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customOnes)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Holiday sync failed: ${res.status}`);
      }
      fetchData(false);
    } catch (error: any) {
      console.error('Error updating holidays:', error);
      alert(`공휴일 저장 중 오류가 발생했습니다: ${error.message}`);
      fetchData(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white font-sans text-slate-900 overflow-hidden">
      <Sidebar 
        selectedDate={selectedDate} 
        onDateSelect={setSelectedDate} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        holidays={holidays}
        rooms={rooms}
        viewMode={viewMode}
      />
      
      <WeeklyView 
        selectedDate={selectedDate}
        bookings={bookings}
        holidays={holidays}
        rooms={rooms}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddBooking={handleAddBooking}
        onEditBooking={handleEditBooking}
        onNavigate={setSelectedDate}
        onUpdateBooking={handleSubmitBooking}
      />

      <BookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitBooking}
        onDelete={handleDeleteBooking}
        initialBooking={editingBooking}
        selectedDate={selectedDate}
        rooms={rooms}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        rooms={rooms}
        holidays={holidays}
        onUpdateRooms={handleUpdateRooms}
        onUpdateHolidays={handleUpdateHolidays}
      />
    </div>
  );
}
