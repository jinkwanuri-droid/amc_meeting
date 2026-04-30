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
  isWithinInterval
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
  onNavigate 
}: WeeklyViewProps) {
  const [now, setNow] = React.useState(new Date());

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

    const layouts = new Map<string, { width: string; left: string }>();
    groups.forEach(group => {
      group.forEach((booking, idx) => {
        layouts.set(booking.id, {
          width: `calc(${100 / group.length}% - 8px)`,
          left: `calc(${(100 / group.length) * idx}% + 4px)`
        });
      });
    });
    return layouts;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden transition-all">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#E5E5E5] px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-8">
          <h2 className="text-lg font-bold text-[#1A1A1A] tracking-tight">
            {viewMode === 'week' ? (
              <>{format(weekStart, 'M/d', { locale: ko })} — {format(addDays(weekStart, 4), 'M/d, yyyy', { locale: ko })}</>
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
                "px-4 py-1 text-[10px] font-bold rounded transition-all",
                viewMode === 'week' ? "bg-white shadow-sm text-black" : "text-slate-400 hover:text-slate-600"
              )}
            >
              WEEKLY
            </button>
            <button 
              onClick={() => onViewModeChange('day')}
              className={cn(
                "px-4 py-1 text-[10px] font-bold rounded transition-all",
                viewMode === 'day' ? "bg-white shadow-sm text-black" : "text-slate-400 hover:text-slate-600"
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
      <div className="flex-1 overflow-auto bg-[#FDFDFD] relative">
        <div className="min-w-[1000px] flex flex-col h-full">
          {/* Headers */}
          <div 
            className="grid bg-white sticky top-0 z-30 border-b border-[#E5E5E5] h-12"
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
                           <span className="px-1.5 py-0.5 bg-[#ff6b6b]/5 text-[#ff6b6b] text-[9px] font-bold rounded-md border border-[#ff6b6b]/20 whitespace-nowrap">
                             {holiday.name}
                           </span>
                         </div>
                       )}

                       {/* Date (Center) */}
                       <span className={cn(
                         "text-[13px] font-extrabold tracking-tight",
                         (holiday || isSun) ? "text-[#ff6b6b]" : isSat ? "text-blue-500" : "text-[#1A1A1A]"
                       )}>
                         {format(col, 'd')}
                       </span>

                       {/* Weekday (approx 75% from left) */}
                       <div className="absolute right-[15%] translate-x-1/2">
                         <span className={cn(
                           "text-[10px] font-bold",
                           (holiday || isSun) ? "text-[#ff6b6b]/80" : isSat ? "text-blue-400" : "text-slate-400"
                         )}>
                           {format(col, 'EEE', { locale: ko })}
                         </span>
                       </div>
                    </div>
                  ) : (
                    <span className="text-[12px] font-bold text-black truncate max-w-full px-2">
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
                 const columnBookings = bookings.filter(booking => {
                   if (viewMode === 'week') {
                     return isSameDay(booking.startTime, columns[colIdx] as Date);
                   } else {
                     return isSameDay(booking.startTime, selectedDate) && booking.roomId === (columns[colIdx] as Room).id;
                   }
                 });
                 const layouts = getBookingLayout(columnBookings);

                 return (
                   <div key={colIdx} className="relative h-full pointer-events-none">
                      {columnBookings.map((booking) => {
                          const startMins = booking.startTime.getHours() * 60 + booking.startTime.getMinutes();
                          const gridStartMins = START_HOUR * 60;
                          const top = ((startMins - gridStartMins) / 60) * 80;
                          const height = (differenceInMinutes(booking.endTime, booking.startTime) / 60) * 80;

                          const layout = layouts.get(booking.id)!;
                          const bookingRoom = rooms.find(r => r.id === booking.roomId);
                          const themeColor = bookingRoom?.color || 'bg-[#cbd098]';
                          const hexColor = themeColor.match(/\[(.*?)\]/)?.[1] || '#cbd098';

                          return (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              key={booking.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditBooking(booking);
                              }}
                              className={cn(
                                "absolute px-3 py-2 pointer-events-auto cursor-pointer flex flex-col justify-between transition-all hover:brightness-90 rounded-lg shadow-sm font-['Pretendard']"
                              )}
                              style={{
                                left: layout.left,
                                width: layout.width,
                                top: `${top + 24}px`, // Added offset for pt-6
                                height: `${height}px`,
                                zIndex: 10,
                                backgroundColor: hexColor,
                                color: 'white'
                              }}
                            >
                              <div className="overflow-hidden">
                                <h4 className="text-[11px] font-extrabold truncate leading-tight uppercase tracking-tight">{booking.title}</h4>
                                <p className="text-[9px] mt-0.5 font-bold truncate opacity-80">{booking.organizer}</p>
                              </div>
                              <div className="flex items-center justify-between text-[9px] font-bold mt-1 opacity-80">
                                  <span>{format(booking.startTime, 'HH:mm')} - {format(booking.endTime, 'HH:mm')}</span>
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
