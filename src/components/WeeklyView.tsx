import React from 'react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  isSameDay, 
  setHours, 
  setMinutes, 
  addMinutes,
  differenceInMinutes,
  startOfDay,
  isWithinInterval,
  isBefore,
  isAfter
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Users, Clock } from 'lucide-react';
import { Booking, Room, Holiday } from '../types';
import { START_HOUR, END_HOUR, ROOMS } from '../constants';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface WeeklyViewProps {
  selectedDate: Date;
  bookings: Booking[];
  holidays: Holiday[];
  rooms: Room[];
  viewMode: 'week' | 'day';
  onViewModeChange: (mode: 'week' | 'day') => void;
  onAddBooking: (date: Date, hour: number, minutes: number, roomId?: string) => void;
  onEditBooking: (booking: Booking) => void;
  onNavigate: (date: Date) => void;
  onUpdateBooking?: (booking: Booking) => void;
}

export default function WeeklyView({ 
  selectedDate, 
  bookings, 
  holidays,
  rooms,
  viewMode,
  onViewModeChange,
  onAddBooking, 
  onEditBooking,
  onNavigate,
  onUpdateBooking
}: WeeklyViewProps) {
  const [now, setNow] = React.useState(new Date());
  
  // Drag & Resize state
  const [dragState, setDragState] = React.useState<{
    id: string;
    type: 'move' | 'resize-top' | 'resize-bottom';
    startY: number;
    startX: number;
    hasMoved: boolean;
    gridRect: DOMRect | null;
    originalStart: Date;
    originalEnd: Date;
    originalRoomId: string;
    originalDate: Date;
    currentStart: Date;
    currentEnd: Date;
    currentRoomId: string;
    currentDate: Date;
  } | null>(null);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const deltaY = e.clientY - dragState.startY;
      const deltaX = e.clientX - dragState.startX;
      
      // Drag threshold: Only start "dragging" after 5px movement
      if (!dragState.hasMoved && Math.abs(deltaY) < 5 && Math.abs(deltaX) < 5) return;
      
      if (!dragState.hasMoved) {
        setDragState(prev => prev ? { ...prev, hasMoved: true } : null);
      }

      // Calculate time delta (80px = 60mins, 40px = 30mins, 20px = 15mins)
      // We snap to 30 min intervals (40px)
      const snapMinutes = 30;
      const pixelsPerMinute = 80 / 60;
      const stepPixels = snapMinutes * pixelsPerMinute;
      
      const snappedDeltaY = Math.round(deltaY / stepPixels) * snapMinutes;
      
      if (dragState.type === 'move') {
        const newStart = addMinutes(dragState.originalStart, snappedDeltaY);
        const newEnd = addMinutes(dragState.originalEnd, snappedDeltaY);
        
        // Handle column change (X delta)
        // Use cached rect for performance
        const rect = dragState.gridRect;
        if (rect) {
          const gridWidth = rect.width - 80; // subtracting time column
          const colWidth = gridWidth / (viewMode === 'week' ? 5 : rooms.length);
          const colIndex = Math.floor((e.clientX - rect.left - 80) / colWidth);
          
          if (colIndex >= 0 && colIndex < (viewMode === 'week' ? 5 : rooms.length)) {
            if (viewMode === 'week') {
              const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
              const newDate = addDays(weekStart, colIndex);
              
              // Maintain hours/mins but change day
              const dStart = setMinutes(setHours(newDate, newStart.getHours()), newStart.getMinutes());
              const dEnd = setMinutes(setHours(newDate, newEnd.getHours()), newEnd.getMinutes());
              
              if (dStart.getTime() !== dragState.currentStart.getTime() || dEnd.getTime() !== dragState.currentEnd.getTime() || !isSameDay(newDate, dragState.currentDate)) {
                setDragState(prev => prev ? { ...prev, currentStart: dStart, currentEnd: dEnd, currentDate: newDate } : null);
              }
            } else {
              const newRoom = rooms[colIndex];
              if (newStart.getTime() !== dragState.currentStart.getTime() || newEnd.getTime() !== dragState.currentEnd.getTime() || newRoom.id !== dragState.currentRoomId) {
                setDragState(prev => prev ? { ...prev, currentStart: newStart, currentEnd: newEnd, currentRoomId: newRoom.id } : null);
              }
            }
          } else {
            if (newStart.getTime() !== dragState.currentStart.getTime() || newEnd.getTime() !== dragState.currentEnd.getTime()) {
              setDragState(prev => prev ? { ...prev, currentStart: newStart, currentEnd: newEnd } : null);
            }
          }
        }
      } else if (dragState.type === 'resize-top') {
        const newStart = addMinutes(dragState.originalStart, snappedDeltaY);
        if (isBefore(newStart, dragState.originalEnd)) {
          setDragState(prev => prev ? { ...prev, currentStart: newStart } : null);
        }
      } else if (dragState.type === 'resize-bottom') {
        const newEnd = addMinutes(dragState.originalEnd, snappedDeltaY);
        if (isAfter(newEnd, dragState.originalStart)) {
          setDragState(prev => prev ? { ...prev, currentEnd: newEnd } : null);
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState && onUpdateBooking && dragState.hasMoved) {
        // Only update if there was actual movement or resizing
        const hasMoved = dragState.type === 'move' && (
          dragState.currentStart.getTime() !== dragState.originalStart.getTime() ||
          dragState.currentEnd.getTime() !== dragState.originalEnd.getTime() ||
          dragState.currentRoomId !== dragState.originalRoomId
        );
        const hasResized = (dragState.type === 'resize-top' || dragState.type === 'resize-bottom') && (
          dragState.currentStart.getTime() !== dragState.originalStart.getTime() ||
          dragState.currentEnd.getTime() !== dragState.originalEnd.getTime()
        );

        if (hasMoved || hasResized) {
          const booking = bookings.find(b => b.id === dragState.id);
          if (booking) {
            onUpdateBooking({
              ...booking,
              startTime: dragState.currentStart,
              endTime: dragState.currentEnd,
              roomId: dragState.currentRoomId
            });
          }
        }
      }
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, onUpdateBooking, bookings, rooms, viewMode, selectedDate]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000); // 30초마다 업데이트
    return () => clearInterval(timer);
  }, []);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Start on Monday
  const weekDays = [...Array(5)].map((_, i) => addDays(weekStart, i)); // 5 days (Mon-Fri)
  const hours = [...Array(END_HOUR - START_HOUR + 1)].map((_, i) => START_HOUR + i);

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const gridStartMins = START_HOUR * 60;
  const gridEndMins = (END_HOUR + 1) * 60;
  const isNowInGrid = nowMins >= gridStartMins && nowMins <= gridEndMins;
  const timeLineTop = ((nowMins - gridStartMins) / 60) * 80 + 24; // 24px = pt-6

  const getHolidayForDay = (date: Date) => holidays.find(h => isSameDay(h.date, date));

  // Determine columns based on view mode
  const columns = viewMode === 'week' ? weekDays : rooms;

  // Helper to calculate visual offsets for overlapping bookings in a column
  const getBookingLayout = (columnBookings: Booking[]) => {
    const sorted = [...columnBookings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const groups: Booking[][] = [];
    
    sorted.forEach(booking => {
      let added = false;
      for (const group of groups) {
        if (group.some(g => booking.startTime < g.endTime && booking.endTime > g.startTime)) {
          group.push(booking);
          added = true;
          break;
        }
      }
      if (!added) groups.push([booking]);
    });

    const layouts = new Map<string, { width: string; left: string; index: number; groupSize: number }>();
    
    // Identify active rooms for this column (day) to create consistent lanes
    const columnRoomIds = Array.from(new Set(columnBookings.map(b => b.roomId)))
      .sort((a, b) => {
        const idxA = rooms.findIndex(r => r.id === a);
        const idxB = rooms.findIndex(r => r.id === b);
        return idxA - idxB;
      });
    const activeRoomsCount = columnRoomIds.length;

    groups.forEach(group => {
      const n = group.length;
      
      const roomOrderGroup = [...group].sort((a, b) => {
        const roomAIdx = rooms.findIndex(r => r.id === a.roomId);
        const roomBIdx = rooms.findIndex(r => r.id === b.roomId);
        return roomAIdx - roomBIdx;
      });

      roomOrderGroup.forEach((booking, idx) => {
        if (n >= 6) {
          // Side-by-side for 6+ items
          // Use global active rooms for the day to ensure constant alignment
          const roomIdxInDay = columnRoomIds.indexOf(booking.roomId);
          const laneWidth = 100 / activeRoomsCount;
          
          layouts.set(booking.id, {
            width: `calc(${laneWidth}% - 4px)`,
            left: `calc(${laneWidth * roomIdxInDay}% + 2px)`,
            index: roomIdxInDay,
            groupSize: n
          });
        } else {
          // Stacked for 2-5 items
          const offset = n > 1 ? 40 : 0;
          layouts.set(booking.id, {
            width: n > 1 ? `calc(100% - ${(n - 1) * offset}px - 10px)` : `calc(100% - 10px)`,
            left: `calc(${idx * offset}px + 5px)`,
            index: idx,
            groupSize: n
          });
        }
      });
    });
    return layouts;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden transition-all">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#E5E5E5] px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-8">
          <h2 className="text-lg font-bold text-[#1A1A1A] tracking-tight w-[200px]">
            {viewMode === 'week' ? (
              <>{format(weekStart, 'yyyy.MM.dd')} - {format(addDays(weekStart, 4), 'MM.dd')}</>
            ) : (
              <>{format(selectedDate, 'yyyy. MM. dd', { locale: ko })}</>
            )}
          </h2>
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button 
              onClick={() => onNavigate(addDays(selectedDate, viewMode === 'week' ? -7 : -1))}
              className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-400 hover:text-black transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => onNavigate(new Date())}
              className="px-4 py-1 text-[11px] font-bold text-slate-600 hover:text-black transition-all"
            >
              TODAY
            </button>
            <button 
              onClick={() => onNavigate(addDays(selectedDate, viewMode === 'week' ? 7 : 1))}
              className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-400 hover:text-black transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button 
              onClick={() => onViewModeChange('week')}
              className={cn(
                "px-4 py-1 text-[12px] rounded transition-all",
                viewMode === 'week' ? "bg-white shadow-sm text-black font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
              )}
            >
              WEEKLY
            </button>
            <button 
              onClick={() => onViewModeChange('day')}
              className={cn(
                "px-4 py-1 text-[12px] rounded transition-all",
                viewMode === 'day' ? "bg-white shadow-sm text-black font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
              )}
            >
              DAILY
            </button>
          </div>
          <button 
            onClick={() => onAddBooking(selectedDate, START_HOUR, 0)}
            className="bg-black hover:bg-zinc-800 text-white px-5 py-2 rounded-md flex items-center gap-2 text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Plus size={16} strokeWidth={3} />
            <span>New Reservation</span>
          </button>
        </div>
      </header>

      {/* Grid */}
      <div id="calendar-grid" className="flex-1 overflow-auto bg-[#FDFDFD] relative">
        <div className="min-w-[1000px] flex flex-col h-full">
          {/* Headers */}
          <div 
            className="grid bg-white sticky top-0 z-30 border-b border-[#E5E5E5] shrink-0 h-[50px]"
            style={{ gridTemplateColumns: `80px repeat(${columns.length}, 1fr)` }}
          >
            <div className="border-r border-[#EEEEEE]" />
            {columns.map((col, idx) => {
              const isDay = col instanceof Date;
              const holiday = isDay ? getHolidayForDay(col) : null;
              const isSun = isDay && col.getDay() === 0;
              const isSat = isDay && col.getDay() === 6;

              return (
                <div 
                  key={isDay ? col.toString() : (col as Room).id} 
                  className={cn(
                    "flex items-center justify-center border-r border-[#EEEEEE] last:border-r-0 relative px-1 h-full",
                    isDay && isSameDay(col, new Date()) && "bg-black/5"
                  )}
                >
                  {isDay ? (
                    <div className="w-full h-full relative flex items-center justify-center">
                       {/* Holiday (approx 25% from left) */}
                       {holiday && (
                         <div className="absolute left-[15%] -translate-x-1/2">
                           <span className="px-1.5 py-0.5 bg-[#ff6b6b]/5 text-[#ff6b6b] text-[11px] font-bold rounded-md border border-[#ff6b6b]/20 whitespace-nowrap">
                             {holiday.name}
                           </span>
                         </div>
                       )}

                       {/* Date (Center) */}
                       <span className={cn(
                         "text-[15px] font-extrabold tracking-tight",
                         (holiday || isSun) ? "text-[#ff6b6b]" : isSat ? "text-blue-500" : "text-[#1A1A1A]"
                       )}>
                         {format(col, 'MM.dd')}
                       </span>

                       {/* Weekday (approx 75% from left) */}
                       <div className="absolute right-[15%] translate-x-1/2">
                         <span className={cn(
                           "text-[12px] font-bold",
                           (holiday || isSun) ? "text-[#ff6b6b]/80" : isSat ? "text-blue-400" : "text-slate-400"
                         )}>
                           {format(col, 'EEE', { locale: ko })}
                         </span>
                       </div>
                    </div>
                  ) : (
                    <span className="text-[14px] font-bold text-black truncate max-w-full px-2">
                       {(col as Room).name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time Slots & Bookings Area */}
          <div className="flex-1 relative pt-6">
            {hours.map((hour) => (
              <div 
                key={hour} 
                className="grid h-20 border-b border-[#EEEEEE] last:border-b-0 relative"
                style={{ gridTemplateColumns: `80px repeat(${columns.length}, 1fr)` }}
              >
                {/* 30-min helper line (dashed) */}
                <div className="absolute top-1/2 left-20 right-0 border-t border-dashed border-[#F0F0F0] pointer-events-none" />

                {/* Time Label */}
                <div className="shrink-0 border-r border-[#EEEEEE] flex items-start justify-center bg-white transition-colors z-10">
                  <span className="text-[10px] font-bold text-slate-400 -translate-y-1/2 bg-white px-1">
                    {format(setHours(new Date(), hour), 'HH:00')}
                  </span>
                </div>

                {/* Columns */}
                {columns.map((col) => {
                  const isDay = col instanceof Date;
                  const day = isDay ? col : selectedDate;
                  const roomId = isDay ? undefined : (col as Room).id;
                  const holiday = getHolidayForDay(day);
                  
                  return (
                    <div 
                      key={isDay ? `${day}-${hour}` : `${(col as Room).id}-${hour}`} 
                      className={cn(
                        "border-r border-[#EEEEEE] last:border-r-0 relative hover:bg-black/[0.01] transition-colors cursor-pointer",
                        holiday && "bg-rose-50/20"
                      )}
                    >
                      {/* Clickable regions for 30m increments */}
                      <div className="h-1/2 w-full hover:bg-black/[0.02]" onClick={(e) => { e.stopPropagation(); onAddBooking(day, hour, 0, roomId); }} />
                      <div className="h-1/2 w-full hover:bg-black/[0.02]" onClick={(e) => { e.stopPropagation(); onAddBooking(day, hour, 30, roomId); }} />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Current Time Line */}
            {isNowInGrid && (
              <div 
                className="absolute left-0 right-0 z-40 pointer-events-none"
                style={{ top: `${timeLineTop}px`, transition: 'top 0.3s ease' }}
              >
                <div 
                  className="grid"
                  style={{ gridTemplateColumns: `80px 1fr` }}
                >
                  <div className="flex justify-end items-center pr-2 h-0">
                    <span className="bg-[#ff6b6b] text-white text-[10px] font-black px-1.5 py-0.5 shadow-md whitespace-nowrap rounded-sm leading-none flex items-center justify-center">
                      {format(now, 'HH:mm')}
                    </span>
                  </div>
                  <div className="relative h-[1px] bg-[#ff6b6b]">
                    <div className="absolute left-0 w-2 h-2 rounded-full bg-[#ff6b6b] -translate-y-1/2 -translate-x-1/2 shadow-[0_0_8px_#ff6b6b]" />
                  </div>
                </div>
              </div>
            )}

            {/* Bookings Layer */}
            <div 
              className="absolute inset-0 pointer-events-none grid"
              style={{ gridTemplateColumns: `80px repeat(${columns.length}, 1fr)` }}
            >
               <div className="pointer-events-none" /> {/* Spacer for time column */}
               {columns.map((_, colIdx) => {
                 const col = columns[colIdx];
                 const isDayCol = col instanceof Date;

                 const columnBookings = bookings.filter(booking => {
                   if (viewMode === 'week') {
                     return isSameDay(booking.startTime, col as Date);
                   } else {
                     return isSameDay(booking.startTime, selectedDate) && booking.roomId === (col as Room).id;
                   }
                 });
                 const layouts = getBookingLayout(columnBookings);

                 return (
                   <div key={colIdx} className="relative h-full pointer-events-none">
                      {columnBookings.map((booking) => {
                          const isDragging = dragState?.id === booking.id;
                          const displayStart = isDragging ? dragState.currentStart : booking.startTime;
                          const displayEnd = isDragging ? dragState.currentEnd : booking.endTime;
                          const displayRoomId = isDragging ? dragState.currentRoomId : booking.roomId;
                          const displayDate = isDragging ? dragState.currentDate : (isDayCol ? col as Date : selectedDate);

                          // Only show the booking in its current/target column
                          if (viewMode === 'week') {
                            if (!isSameDay(displayStart, col as Date)) return null;
                          } else {
                            if (displayRoomId !== (col as Room).id) return null;
                          }

                          const startMins = displayStart.getHours() * 60 + displayStart.getMinutes();
                          const gridStartMins = START_HOUR * 60;
                          const top = ((startMins - gridStartMins) / 60) * 80;
                          const height = (differenceInMinutes(displayEnd, displayStart) / 60) * 80;

                          const layout = layouts.get(booking.id)!;
                          const bookingRoom = rooms.find(r => r.id === booking.roomId);
                          const themeColor = bookingRoom?.color || 'bg-[#cbd098]';
                          const hexColor = themeColor.match(/\[(.*?)\]/)?.[1] || '#cbd098';

                          return (
                            <motion.div
                              layout={!isDragging}
                              layoutId={isDragging ? undefined : `booking-${booking.id}`}
                              key={booking.id}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const gridElement = document.getElementById('calendar-grid');
                                setDragState({
                                  id: booking.id,
                                  type: 'move',
                                  startY: e.clientY,
                                  startX: e.clientX,
                                  hasMoved: false,
                                  gridRect: gridElement?.getBoundingClientRect() || null,
                                  originalStart: booking.startTime,
                                  originalEnd: booking.endTime,
                                  originalRoomId: booking.roomId,
                                  originalDate: isDayCol ? col as Date : selectedDate,
                                  currentStart: booking.startTime,
                                  currentEnd: booking.endTime,
                                  currentRoomId: booking.roomId,
                                  currentDate: isDayCol ? col as Date : selectedDate
                                });
                              }}
                              onClick={(e) => {
                                if (dragState?.hasMoved) return;
                                e.stopPropagation();
                                onEditBooking(booking);
                              }}
                              className={cn(
                                "absolute px-3 py-2 pointer-events-auto cursor-grab active:cursor-grabbing flex flex-col justify-between rounded-xl shadow-sm font-['Pretendard'] group",
                                !isDragging && "transition-all duration-200",
                                isDragging && "z-50 shadow-xl opacity-95 scale-[1.03] cursor-grabbing"
                              )}
                              style={{
                                left: layout.left,
                                width: layout.width,
                                top: `${top + 24}px`, // Added offset for pt-6
                                height: `${height - 2}px`, // Minor adjustment for gap
                                zIndex: isDragging ? 100 : (10 + layout.index),
                                background: `linear-gradient(135deg, ${hexColor} 0%, color-mix(in srgb, ${hexColor}, white 20%) 100%)`,
                                color: 'white',
                                transition: isDragging ? 'none' : undefined
                              }}
                            >
                              {/* Resize Handles */}
                              <div 
                                className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const gridElement = document.getElementById('calendar-grid');
                                  setDragState({
                                    id: booking.id,
                                    type: 'resize-top',
                                    startY: e.clientY,
                                    startX: e.clientX,
                                    hasMoved: false,
                                    gridRect: gridElement?.getBoundingClientRect() || null,
                                    originalStart: booking.startTime,
                                    originalEnd: booking.endTime,
                                    originalRoomId: booking.roomId,
                                    originalDate: isDayCol ? col as Date : selectedDate,
                                    currentStart: booking.startTime,
                                    currentEnd: booking.endTime,
                                    currentRoomId: booking.roomId,
                                    currentDate: isDayCol ? col as Date : selectedDate
                                  });
                                }}
                              />
                              <div 
                                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-20"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const gridElement = document.getElementById('calendar-grid');
                                  setDragState({
                                    id: booking.id,
                                    type: 'resize-bottom',
                                    startY: e.clientY,
                                    startX: e.clientX,
                                    hasMoved: false,
                                    gridRect: gridElement?.getBoundingClientRect() || null,
                                    originalStart: booking.startTime,
                                    originalEnd: booking.endTime,
                                    originalRoomId: booking.roomId,
                                    originalDate: isDayCol ? col as Date : selectedDate,
                                    currentStart: booking.startTime,
                                    currentEnd: booking.endTime,
                                    currentRoomId: booking.roomId,
                                    currentDate: isDayCol ? col as Date : selectedDate
                                  });
                                }}
                              />

                              <div className="flex flex-col overflow-hidden h-full pointer-events-none">
                                {layout.groupSize < 6 ? (
                                  <>
                                    <h4 className="text-[15px] font-bold truncate tracking-tight">{booking.title}</h4>
                                    {layout.groupSize >= 3 ? (
                                      <>
                                        <div className="text-[12px] mt-1 opacity-90 leading-[1.2]">
                                            <div>{format(displayStart, 'HH:mm')}</div>
                                            <div>-</div>
                                            <div>{format(displayEnd, 'HH:mm')}</div>
                                        </div>
                                        <div className="text-[12px] mt-1.5 opacity-90 leading-tight">
                                          <div className="truncate">{booking.organizer}</div>
                                          <div className="truncate">{bookingRoom ? bookingRoom.name : '삭제된 회의실'}</div>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="text-[13px] mt-1 opacity-90 truncate">
                                            {format(displayStart, 'HH:mm')} - {format(displayEnd, 'HH:mm')}
                                        </div>
                                        <p className="text-[13px] mt-0.5 opacity-90 truncate">
                                          {booking.organizer} • {bookingRoom ? bookingRoom.name : '삭제된 회의실'}
                                        </p>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex flex-col h-full justify-center items-center opacity-40">
                                    {/* Optional: Add a small icon or nothing at all as per request */}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                      })}
                   </div>
                 );
               })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
