/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { setHours, setMinutes, startOfDay, addDays, getYear, parseISO } from 'date-fns';
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. 회의실 가져오기
      const roomsRes = await fetch("/api/rooms");
      const roomsData = await roomsRes.json();
      setRooms(Array.isArray(roomsData) ? roomsData : []);

      // 2. 예약 가져오기
      const bookingsRes = await fetch("/api/bookings");
      const bookingsData = await bookingsRes.json();
      
      const mappedBookings = (Array.isArray(bookingsData) ? bookingsData : []).map((b: any) => ({
        id: b.id,
        title: b.title,
        roomId: b.room_id,
        startTime: parseISO(b.start_time),
        endTime: parseISO(b.end_time),
        organizer: b.organizer,
        description: b.description,
        color: b.color
      }));
      setBookings(mappedBookings);

      // 3. 공휴일 가져오기
      const currentYear = getYear(new Date());
      const basicHolidays = [...getKoreanHolidays(currentYear), ...getKoreanHolidays(currentYear + 1)]
        .map(h => ({ id: `basic-${h.name}-${h.date.getTime()}`, ...h }));
      
      const holidaysRes = await fetch("/api/holidays");
      const customHolidays = await holidaysRes.json();
      
      const mappedCustomHolidays = (Array.isArray(customHolidays) ? customHolidays : []).map((h: any) => ({
        id: h.id,
        name: h.name,
        date: parseISO(h.date)
      }));

      setHolidays([...basicHolidays, ...mappedCustomHolidays]);
    } catch (error) {
      console.error('Error fetching data:', error);
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
      if (bookingData.id && b.id === bookingData.id) return false;
      if (b.roomId !== bookingData.roomId) return false;
      
      const bStart = b.startTime.getTime();
      const bEnd = b.endTime.getTime();
      const newDataStart = bookingData.startTime.getTime();
      const newDataEnd = bookingData.endTime.getTime();

      return newDataStart < bEnd && newDataEnd > bStart;
    });

    if (hasOverlap) {
      alert("이미 해당 시간에 예약이 있습니다.");
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
      
      fetchData(); // 데이터 새로고침
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
      
      fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  const handleUpdateRooms = async (newRooms: Room[]) => {
    try {
      // 순서 보존을 위해 order 필드 업데이트
      const payload = newRooms.map((r, i) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        capacity: r.capacity,
        order: i
      }));

      await fetch("/api/rooms/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      fetchData();
    } catch (error) {
      console.error('Error updating rooms:', error);
    }
  };

  const handleUpdateHolidays = async (newHolidays: Holiday[]) => {
    try {
      const customOnes = newHolidays.filter(h => h.isCustom).map(h => ({
        id: h.id,
        name: h.name,
        date: h.date instanceof Date ? h.date.toISOString().split('T')[0] : h.date
      }));

      // 삭제된 항목 처리는 더 복잡할 수 있으나, 여기서는 단순화하여 Upsert만 처리
      // 실제로는 전체 목록을 비교하여 삭제된 ID를 찾아 DELETE 요청을 보내야 함
      if (customOnes.length > 0) {
        await fetch("/api/holidays/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customOnes)
        });
      }
      fetchData();
    } catch (error) {
      console.error('Error updating holidays:', error);
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
