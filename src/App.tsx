/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { setHours, setMinutes, startOfDay, addDays, getYear, isSameDay } from 'date-fns';
import Sidebar from './components/Sidebar';
import WeeklyView from './components/WeeklyView';
import BookingModal from './components/BookingModal';
import SettingsModal from './components/SettingsModal';
import { Booking, Room, Holiday } from './types';
import { BOOKING_COLORS, ROOMS as INITIAL_ROOMS } from './constants';
import { getKoreanHolidays } from './lib/holidays';

export default function App() {
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<'week' | 'day'>('week');
  const [rooms, setRooms] = React.useState<Room[]>(INITIAL_ROOMS);
  const [holidays, setHolidays] = React.useState<Holiday[]>([]);
  
  // Initialize holidays for current and next year
  React.useEffect(() => {
    const currentYear = getYear(new Date());
    const h1 = getKoreanHolidays(currentYear);
    const h2 = getKoreanHolidays(currentYear + 1);
    
    setHolidays([...h1, ...h2].map(h => ({
      id: `${h.name}-${h.date.getTime()}`,
      ...h
    })));
  }, []);

  const [bookings, setBookings] = React.useState<Booking[]>([
    {
      id: '1',
      title: '디자인 시스템 리뷰',
      roomId: 'room-1',
      startTime: setHours(setMinutes(startOfDay(new Date()), 0), 10),
      endTime: setHours(setMinutes(startOfDay(new Date()), 0), 11),
      organizer: '김진관',
      color: BOOKING_COLORS[0]
    },
    {
      id: '2',
      title: '주간 기획 회의',
      roomId: 'room-2',
      startTime: setHours(setMinutes(startOfDay(addDays(new Date(), 1)), 30), 14),
      endTime: setHours(setMinutes(startOfDay(addDays(new Date(), 1)), 30), 15),
      organizer: '이서윤',
      color: BOOKING_COLORS[1]
    }
  ]);

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

  const handleSubmitBooking = (bookingData: Omit<Booking, 'id'> & { id?: string }) => {
    // Check for overlaps (ignore current booking if editing)
    const hasOverlap = bookings.some(b => {
      if (bookingData.id && b.id === bookingData.id) return false;
      if (b.roomId !== bookingData.roomId) return false;
      
      const bStart = b.startTime.getTime();
      const bEnd = b.endTime.getTime();
      const newDataStart = bookingData.startTime.getTime();
      const newDataEnd = bookingData.endTime.getTime();

      // (StartA < EndB) and (EndA > StartB)
      return newDataStart < bEnd && newDataEnd > bStart;
    });

    if (hasOverlap) {
      alert("이미 예약이 있습니다");
      return;
    }

    if (bookingData.id) {
      setBookings(prev => prev.map(b => b.id === bookingData.id ? (bookingData as Booking) : b));
    } else {
      const newBooking: Booking = {
        ...bookingData,
        id: Math.random().toString(36).substr(2, 9)
      };
      setBookings(prev => [...prev, newBooking]);
    }
    setIsModalOpen(false); // Close modal only if no overlap
  };

  const handleDeleteBooking = (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
    setIsModalOpen(false);
  };

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
        onUpdateRooms={setRooms}
        onUpdateHolidays={setHolidays}
      />
    </div>
  );
}
