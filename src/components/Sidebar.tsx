import React from 'react';
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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';
import { Holiday, Room } from '../types';

interface SidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onOpenSettings: () => void;
  holidays: Holiday[];
  rooms: Room[];
  viewMode: 'week' | 'day';
}

export default function Sidebar({ selectedDate, onDateSelect, onOpenSettings, holidays, rooms, viewMode }: SidebarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(selectedDate));

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

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = addDays(weekStart, 4); // Friday

  const daysOfWeek = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

  const roomColors = ['bg-blue-500', 'bg-orange-400', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500'];

  return (
    <aside className="w-72 bg-[#F9F9F9] border-r border-[#E5E5E5] h-full flex flex-col p-8 overflow-y-auto shrink-0 transition-colors">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-sm"></div>
        </div>
        <h1 className="font-bold text-lg tracking-tighter text-[#1A1A1A]">RoomBook</h1>
      </div>

      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-[#1A1A1A] tracking-tight">
            {format(currentMonth, 'yyyy. M', { locale: ko })}
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={prevMonth}
              className="p-1 hover:bg-black/5 rounded-md text-slate-400 hover:text-black transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={nextMonth}
              className="p-1 hover:bg-black/5 rounded-md text-slate-400 hover:text-black transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center mb-4">
          {daysOfWeek.map((day) => (
            <div key={day} className="text-[10px] font-bold text-slate-400 tracking-widest">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-3">
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
                  className={cn(
                    "h-6 w-6 mx-auto flex items-center justify-center text-[11px] rounded-full transition-all relative z-10",
                    !isCurrentMonth && "text-slate-200",
                    isCurrentMonth && !isSelected && !holiday && "text-slate-700 font-medium hover:bg-black/5",
                    isCurrentMonth && !isSelected && holiday && "text-rose-500 font-bold hover:bg-rose-50",
                    isSelected && "bg-black text-white font-bold shadow-lg shadow-black/20"
                  )}
                  title={holiday?.name}
                >
                  {format(day, 'd')}
                  {isToday && !isSelected && (
                    <span className={cn("absolute -bottom-1 w-1 h-1 rounded-full", holiday ? "bg-rose-500" : "bg-black")} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Conference Rooms</h3>
        <div className="space-y-3">
          {Array.isArray(rooms) && rooms.map((room) => (
            <div key={room.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#E5E5E5] shadow-sm transition-all hover:shadow-md cursor-pointer group">
              <div className={cn("w-2 h-2 rounded-full", room.color || 'bg-slate-300')}></div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#1A1A1A] truncate">{room.name || 'Unnamed Room'}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate">{room.capacity} seats</p>
              </div>
            </div>
          ))}
          {rooms.length === 0 && (
            <p className="text-[10px] text-slate-400 italic">No rooms configured.</p>
          )}
        </div>
      </div>

      <div className="mt-auto pt-8 border-t border-[#E5E5E5]">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-black hover:bg-black/5 rounded-xl transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
            <Settings size={18} />
          </div>
          <span className="text-sm font-bold">Settings</span>
        </button>
      </div>
    </aside>
  );
}
