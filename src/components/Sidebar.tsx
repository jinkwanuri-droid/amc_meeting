import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isWithinInterval
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, MapPin, Presentation, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Holiday, Room } from '../types';

interface SidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onOpenSettings: () => void;
  holidays: Holiday[];
  rooms: Room[];
  viewMode: 'week' | 'day';
  onRoomBooking?: (roomId: string) => void;
}

export default function Sidebar({ selectedDate, onDateSelect, onOpenSettings, holidays, rooms, viewMode, onRoomBooking }: SidebarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(selectedDate));
  const [hoveredHoliday, setHoveredHoliday] = React.useState<{ date: Date; name: string } | null>(null);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 }); // Sunday
  const weekEnd = addDays(weekStart, 6); // Entire week

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

  const roomColors = ['bg-blue-500', 'bg-orange-400', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500'];

  return (
    <aside className="w-72 bg-[#F9F9F9] border-r border-[#E5E5E5] h-full flex flex-col p-8 pt-[max(2rem,5vh)] overflow-y-auto shrink-0 transition-colors scrollbar-hide">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Presentation size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-bold text-lg tracking-tighter text-[#1A1A1A]">AMC RoomBook</h1>
        </div>
        <button 
          onClick={onOpenSettings}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-black hover:bg-black/5 rounded-full transition-all"
        >
          <Settings size={15} />
        </button>
      </div>

      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-[#1A1A1A] tracking-tight">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </h2>
          <div className="flex gap-1">
            <button 
              onClick={prevMonth}
              className="p-1 hover:bg-black/5 rounded-md text-slate-400 hover:text-black transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => {
                onDateSelect(new Date());
                setCurrentMonth(new Date());
              }}
              className="px-2 text-[11px] font-bold text-slate-400 hover:text-black hover:bg-black/5 rounded-md transition-all"
            >
              T
            </button>
            <button 
              onClick={nextMonth}
              className="p-1 hover:bg-black/5 rounded-md text-slate-400 hover:text-black transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center mb-3">
          {daysOfWeek.map((day, idx) => (
            <div 
              key={`sidebar-day-${day}-${idx}`} 
              className={cn(
                "text-[11px] font-bold tracking-widest",
                (idx === 0 || idx === 6) ? "text-slate-400 opacity-60" : "text-slate-400"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1.5">
          {calendarDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());
            const holiday = holidays.find(h => isSameDay(h.date, day));
            
            // Highlight area logic
            const isInWeekRange = viewMode === 'week' && isWithinInterval(day, { start: weekStart, end: weekEnd });
            const isRangeStart = isInWeekRange && isSameDay(day, weekStart);
            const isRangeEnd = isInWeekRange && isSameDay(day, weekEnd);

            return (
              <div key={day.toString()} className="relative">
                {isInWeekRange && (
                  <div className={cn(
                    "absolute inset-y-0 bg-black/[0.04] z-0",
                    isRangeStart ? "left-[10%] rounded-l-full" : "left-0",
                    isRangeEnd ? "right-[10%] rounded-r-full" : "right-0"
                  )} />
                )}
                <button
                  onClick={() => onDateSelect(day)}
                  onMouseEnter={() => holiday && setHoveredHoliday({ date: day, name: holiday.name })}
                  onMouseLeave={() => setHoveredHoliday(null)}
                  className={cn(
                    "h-7 w-7 mx-auto flex items-center justify-center text-[12px] rounded-full transition-all relative z-10",
                    !isCurrentMonth && "text-slate-200",
                    isCurrentMonth && !isToday && !isSelected && !holiday && (day.getDay() === 0 || day.getDay() === 6) && "text-slate-400/70 hover:bg-black/5",
                    isCurrentMonth && !isToday && !isSelected && !holiday && (day.getDay() !== 0 && day.getDay() !== 6) && "text-slate-700 font-medium hover:bg-black/5",
                    isCurrentMonth && !isToday && !isSelected && holiday && "text-rose-500 font-bold hover:bg-rose-50",
                    isToday && "bg-black text-white font-bold shadow-lg shadow-black/20",
                    isSelected && !isToday && "border border-slate-300 font-bold text-black bg-white shadow-sm"
                  )}
                >
                  {format(day, 'd')}
                </button>

                <AnimatePresence>
                  {hoveredHoliday && isSameDay(hoveredHoliday.date, day) && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.9 }}
                      className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-white border border-[#E5E5E5] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.12)] whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#1A1A1A]">{holiday?.name}</span>
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[7px] border-t-[#E5E5E5] -z-10" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-4">
          <h3 className="text-[14px] font-bold text-[#1A1A1A] tracking-tight mb-1">회의실 예약</h3>
          <p className="text-[11px] text-slate-400 font-medium">원하시는 회의실을 선택해 주세요</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.isArray(rooms) && rooms.map((room) => {
            const hexColor = room.color?.match(/\[(.*?)\]/)?.[1] || '#cbd098';
            return (
              <div 
                key={room.id} 
                onClick={() => onRoomBooking?.(room.id)}
                className="flex flex-col justify-end p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-black/20 cursor-pointer group active:scale-[0.98] h-[72px] relative overflow-hidden"
              >
                {/* Accent Tag */}
                <div 
                  className="absolute top-2.5 left-2.5 w-7 h-4 rounded-md pointer-events-none shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
                  style={{ backgroundColor: hexColor }}
                />
                
                <div className="flex items-center justify-end mb-1">
                  <p className="text-[10px] text-slate-400 font-black whitespace-nowrap shrink-0">{room.capacity}인</p>
                </div>
                <p className="text-[15px] font-black text-[#1A1A1A] truncate leading-tight">{room.name || '방 이름 없음'}</p>
              </div>
            );
          })}
          {rooms.length === 0 && (
            <p className="text-[10px] text-slate-400 italic col-span-2">회의실이 없습니다.</p>
          )}
        </div>
      </div>

    </aside>
  );
}
