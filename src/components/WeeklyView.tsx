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
import { ChevronLeft, ChevronRight, Plus, Users, Clock, Presentation } from 'lucide-react';
import { Booking, Room, Holiday } from '../types';
import { START_HOUR, END_HOUR, ROOMS } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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

  const [direction, setDirection] = React.useState(0);
  const [hoveredCardId, setHoveredCardId] = React.useState<string | null>(null);
  const prevDateRef = React.useRef(selectedDate);
  const isDraggingRef = React.useRef(false);

  React.useEffect(() => {
    if (selectedDate.getTime() > prevDateRef.current.getTime()) {
      setDirection(1);
    } else if (selectedDate.getTime() < prevDateRef.current.getTime()) {
      setDirection(-1);
    }
    prevDateRef.current = selectedDate;
  }, [selectedDate]);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const deltaY = e.clientY - dragState.startY;
      const deltaX = e.clientX - dragState.startX;
      
      // Drag threshold: Only start "dragging" after 5px movement
      if (!dragState.hasMoved && Math.abs(deltaY) < 5 && Math.abs(deltaX) < 5) return;
      
      if (!dragState.hasMoved) {
        setDragState(prev => prev ? { ...prev, hasMoved: true } : null);
        isDraggingRef.current = true;
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
          const colWidth = gridWidth / displayColumns.length;
          const colIndex = Math.floor((e.clientX - rect.left - 80) / colWidth);
          
          if (colIndex >= 0 && colIndex < displayColumns.length) {
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
      
      // Delay resetting the dragging flag to allow onClick to see it
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
      
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
  const timeLineTop = ((nowMins - gridStartMins) / 60) * 80;

  const getHolidayForDay = (date: Date) => holidays.find(h => isSameDay(h.date, date));

  // Determine columns based on view mode
  const columns = viewMode === 'week' ? weekDays : rooms;
  
  // Always ensure 5 columns for Daily view (Room View)
  const displayColumns = [...columns];
  if (viewMode === 'day' && displayColumns.length < 5) {
    while (displayColumns.length < 5) {
      displayColumns.push({ id: `empty-${displayColumns.length}`, name: '', isPlaceholder: true } as any);
    }
  }

  // Helper to calculate visual offsets for overlapping bookings in a column
  const getBookingLayout = (columnBookings: Booking[]) => {
    const layouts = new Map<string, { width: string; left: string; index: number; groupSize: number }>();
    if (columnBookings.length === 0) return layouts;
    
    // 1. Sort bookings by start time
    const sortedBookings = [...columnBookings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    // 2. Group into overlapping clusters correctly using graph connected components
    const clusters: Booking[][] = [];
    for (const booking of sortedBookings) {
      const overlappingIndices: number[] = [];
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].some(cb => booking.startTime < cb.endTime && booking.endTime > cb.startTime)) {
          overlappingIndices.push(i);
        }
      }
      
      if (overlappingIndices.length > 0) {
        const primaryIdx = overlappingIndices[0];
        clusters[primaryIdx].push(booking);
        // Merge from the end to avoid shifting indices
        for (let i = overlappingIndices.length - 1; i > 0; i--) {
          const idxToMerge = overlappingIndices[i];
          clusters[primaryIdx].push(...clusters[idxToMerge]);
          clusters.splice(idxToMerge, 1);
        }
      } else {
        clusters.push([booking]);
      }
    }

    // 3. Layout each cluster securely
    clusters.forEach(cluster => {
      // Find all unique rooms in this interconnected cluster
      const uniqueRoomIds = Array.from(new Set(cluster.map(b => b.roomId)))
        .sort((a, b) => rooms.findIndex(r => r.id === a) - rooms.findIndex(r => r.id === b));
        
      const roomsInClusterCount = uniqueRoomIds.length;
      
      cluster.forEach(booking => {
        const roomIdx = rooms.findIndex(r => r.id === booking.roomId);
        const localRoomIdx = uniqueRoomIds.indexOf(booking.roomId);
        
        // Strictly overlapping count for extreme density scenarios
        const overlappingCount = cluster.filter(b => b.startTime < booking.endTime && b.endTime > booking.startTime).length;
        
        if (cluster.length === 1) {
          // [FULL WIDTH] - No overlap at all
          layouts.set(booking.id, {
            width: 'calc(100% - 8px)',
            left: '4px',
            index: roomIdx,
            groupSize: 1
          });
        } else {
          // [SIDE-BY-SIDE DYNAMIC]
          const n = roomsInClusterCount;
          const colWidth = 100 / n;
          
          // Unified formula for G=4px gap/margin
          layouts.set(booking.id, {
            width: `calc(${colWidth}% - ${ ( (n + 1) * 4 ) / n }px)`,
            left: `calc(${localRoomIdx * colWidth}% - ${ (localRoomIdx * 4) / n }px + 4px)`,
            index: roomIdx,
            groupSize: n
          });
        }
      });
    });

    // Safety pass
    columnBookings.forEach(booking => {
      if (!layouts.has(booking.id)) {
        layouts.set(booking.id, { width: '92%', left: '4%', index: 0, groupSize: 1 });
      }
    });

    return layouts;
  };

  const [isMobile, setIsMobile] = React.useState(false);
  
  // Scroll to current time on mount
  React.useEffect(() => {
    const grid = document.getElementById('calendar-grid');
    if (grid) {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Check if current hour is within our grid display range
      if (currentHour >= START_HOUR && currentHour <= END_HOUR) {
        // Each hour is 80px, plus 20px padding at the top
        const top = ((currentHour - START_HOUR) * 80) + 20;
        // Center the hour in the grid container
        const scrollPos = top - (grid.clientHeight / 2) + 40;
        grid.scrollTo({ top: Math.max(0, scrollPos), behavior: 'smooth' });
      } else {
        // Default scroll to 9 AM if current time is outside grid
        const scrollPos = ((9 - START_HOUR) * 80);
        grid.scrollTo({ top: Math.max(0, scrollPos), behavior: 'smooth' });
      }
    }
  }, []);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden select-none scrollbar-hide">
      {/* Mobile Top Header (Logo & View Toggle) */}
      <div className="md:hidden h-[calc(56px+5vh)] pt-[5vh] bg-white border-b border-[#E5E5E5] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <Presentation size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-bold text-base tracking-tighter text-[#1A1A1A]">AMC RoomBook</h1>
        </div>

        {/* Mobile View Toggle - Only visible on smallest screens */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-[#E5E5E5]">
          <button 
            onClick={() => onViewModeChange('week')}
            className={cn(
              "px-3 py-1 text-[11px] rounded transition-all",
              viewMode === 'week' ? "bg-white shadow-sm text-black font-bold" : "text-slate-400 font-medium"
            )}
          >
            WEEKLY
          </button>
          <button 
            onClick={() => onViewModeChange('day')}
            className={cn(
              "px-3 py-1 text-[11px] rounded transition-all",
              viewMode === 'day' ? "bg-white shadow-sm text-black font-bold" : "text-slate-400 font-medium"
            )}
          >
            DAILY
          </button>
        </div>
      </div>
      {/* Header */}
      <header className="h-16 md:h-[calc(64px+5vh)] md:pt-[5vh] bg-white border-b border-[#E5E5E5] px-4 md:px-8 flex items-center justify-between shrink-0 relative z-40">
        {/* Left: Date Range (Desktop & Mobile) */}
        <div className="flex items-center gap-2 md:gap-8 overflow-hidden min-w-[100px] md:min-w-0">
          <h2 className="text-base md:text-xl font-bold text-[#1A1A1A] tracking-tight w-auto md:w-[250px] truncate shrink-0">
            {viewMode === 'week' ? (
              <>
                <span className="hidden lg:inline">{format(weekStart, 'yyyy.MM.dd')} - {format(addDays(weekStart, 4), 'MM.dd')}</span>
                <span className="lg:hidden text-[17px] md:text-[16px] font-bold text-[#1A1A1A]">{format(weekStart, 'MM.dd')} - {format(addDays(weekStart, 4), 'MM.dd')}</span>
              </>
            ) : (
              <>{format(selectedDate, 'yyyy. MM. dd (EEEEEE)', { locale: ko })}</>
            )}
          </h2>
        </div>

        {/* Center: Navigation (Main Header Navigation) */}
        <div className="flex-1 flex justify-center lg:justify-start lg:flex-none">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-[#E5E5E5] scale-90 md:scale-100">
            <button 
              onClick={() => onNavigate(addDays(selectedDate, viewMode === 'week' ? -7 : -1))}
              className="p-1 px-1.5 md:px-2 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-black transition-all flex items-center"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => onNavigate(new Date())}
              className="px-2 py-1.5 text-[10px] md:text-[11px] font-black text-slate-600 hover:text-black transition-all"
            >
              TODAY
            </button>
            <button 
              onClick={() => onNavigate(addDays(selectedDate, viewMode === 'week' ? 7 : 1))}
              className="p-1 px-1.5 md:px-2 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-black transition-all flex items-center"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-4 ml-2 md:ml-0">
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button 
              onClick={() => onViewModeChange('week')}
              className={cn(
                "px-3 md:px-4 py-1 text-[12px] rounded transition-all",
                viewMode === 'week' ? "bg-white shadow-sm text-black font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
              )}
            >
              WEEKLY
            </button>
            <button 
              onClick={() => onViewModeChange('day')}
              className={cn(
                "px-3 md:px-4 py-1 text-[12px] rounded transition-all",
                viewMode === 'day' ? "bg-white shadow-sm text-black font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
              )}
            >
              DAILY
            </button>
          </div>
          
          <button 
            onClick={() => onAddBooking(selectedDate, START_HOUR, 0)}
            className="md:hidden bg-black hover:bg-zinc-800 text-white w-10 h-10 rounded-md flex items-center justify-center transition-all shadow-md active:scale-95"
          >
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* Grid */}
      <div 
        id="calendar-grid" 
        className={cn(
          "flex-1 overflow-x-hidden overflow-y-auto bg-[#FDFDFD] relative scrollbar-hide",
          dragState && "select-none"
        )}
        style={{ userSelect: dragState ? 'none' : 'auto' }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          :root { --time-col-width: 48px; }
          @media (min-width: 768px) { :root { --time-col-width: 80px; } }
          
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />

        <div className="min-w-fit md:min-w-[1000px] flex h-full">
          {/* Static Time Sidebar */}
          <div className="w-[var(--time-col-width)] shrink-0 sticky left-0 z-[40] bg-white/95 backdrop-blur-sm border-r border-[#E5E5E5] flex flex-col h-full pointer-events-none self-start">
            <div className="h-[45px] md:h-[50px] border-b border-[#E1E1E1] shrink-0" /> {/* Spacer for header */}
            <div className="flex-1 relative pt-[20px]">
              {hours.map(hour => (
                <div key={hour} className="h-20 flex items-start justify-center">
                  <span className="text-[10px] md:text-[12px] font-bold text-slate-400 -translate-y-1/2 bg-white px-1">
                    {format(setHours(new Date(), hour), 'HH:00')}
                  </span>
                </div>
              ))}
              
              {/* Static Current Time Mark (Label part) */}
              {isNowInGrid && (
                <div 
                  className="absolute right-2 z-50 flex items-center h-0"
                  style={{ top: `${timeLineTop + 20}px`, transition: 'top 0.3s ease' }}
                >
                  <span className="bg-[#ff6b6b] text-white text-[10px] md:text-[12px] font-black px-1 md:px-1.5 py-0.5 shadow-md rounded-sm leading-none">
                    {format(now, 'HH:mm')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sliding Content Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div 
                key={viewMode === 'week' ? format(weekStart, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd')}
                initial={{ x: direction * 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -direction * 50, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200, mass: 0.8 }}
                className="flex flex-col h-full"
              >
                {/* Headers */}
                <div 
                  className="grid bg-white sticky top-0 z-30 border-b border-[#E5E5E5] shrink-0 h-[45px] md:h-[50px]"
                  style={{ gridTemplateColumns: `repeat(${displayColumns.length}, 1fr)` }}
                >
                  {displayColumns.map((col, idx) => {
                    const isDay = col instanceof Date;
                    const holiday = isDay ? getHolidayForDay(col) : null;
                    const isSun = isDay && col.getDay() === 0;
                    const isSat = isDay && col.getDay() === 6;
                    const isPlaceholder = (col as any).isPlaceholder;

                    return (
                      <div 
                        key={isDay ? `header-${col.toString()}` : `header-${(col as Room).id}-${idx}`} 
                        className={cn(
                          "flex flex-col items-center justify-center border-r border-[#EEEEEE] last:border-r-0 relative px-1 h-full bg-white",
                          isDay && isSameDay(col, new Date()) && "bg-black/5",
                          isPlaceholder && "bg-[#f9f9f9]"
                        )}
                      >
                        {isDay ? (
                          <div className="w-full h-full relative flex flex-col items-center justify-center">
                              {/* Web Layout */}
                              <div className="hidden md:grid grid-cols-[3fr_4fr_3fr] items-center w-full h-full px-1">
                                <div className="flex justify-center overflow-hidden">
                                    {holiday && (
                                      <span className="px-1.5 py-0.5 bg-[#ff6b6b]/5 text-[#ff6b6b] text-[8px] font-bold rounded-md border border-[#ff6b6b]/20 whitespace-nowrap">
                                        {holiday.name.length > 6 ? holiday.name.slice(0, 5) + '...' : holiday.name}
                                      </span>
                                    )}
                                </div>
                                <div className="flex justify-center">
                                    <span className={cn(
                                      "text-[16px] font-black tracking-tight leading-none",
                                      (holiday || isSun) ? "text-[#ff6b6b]" : isSat ? "text-blue-500" : "text-[#1A1A1A]"
                                    )}>
                                      {format(col, 'MM.dd')}
                                    </span>
                                </div>
                                <div className="flex justify-center">
                                    <span className={cn(
                                      "text-[12px] font-bold whitespace-nowrap",
                                      (holiday || isSun) ? "text-[#ff6b6b]/80" : isSat ? "text-blue-400" : "text-slate-400"
                                    )}>
                                      {['일', '월', '화', '수', '목', '금', '토'][col.getDay()]}
                                    </span>
                                </div>
                              </div>
                              {/* Mobile Layout */}
                              <div className="md:hidden flex flex-col items-center justify-center gap-1">
                                <span className={cn(
                                  "text-[15px] font-black tracking-tight",
                                  (holiday || isSun) ? "text-[#ff6b6b]" : isSat ? "text-blue-500" : "text-[#1A1A1A]"
                                )}>
                                  {format(col, 'MM.dd')}
                                </span>
                                <div className="flex items-center justify-center">
                                  {holiday ? (
                                    <span className="px-1 py-0.5 bg-[#ff6b6b]/5 text-[#ff6b6b] text-[8px] font-bold rounded-md border border-[#ff6b6b]/20 whitespace-nowrap">
                                      {holiday.name}
                                    </span>
                                  ) : (
                                    <span className={cn(
                                      "text-[10px] font-bold",
                                      isSun ? "text-[#ff6b6b]/80" : isSat ? "text-blue-400" : "text-slate-400"
                                    )}>
                                      {['일', '월', '화', '수', '목', '금', '토'][col.getDay()]}
                                    </span>
                                  )}
                                </div>
                              </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 md:gap-2 px-2 truncate max-w-full">
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]" 
                                style={{ backgroundColor: (col as Room).color?.match(/\[(.*?)\]/)?.[1] || '#cbd098' }}
                              ></div>
                              <span className="text-[12px] md:text-[14px] font-bold text-black truncate">
                                {(col as Room).name}
                              </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grid Rows & Bookings Area */}
                <div className="flex-1 relative pt-[20px]">
                  {hours.map((hour) => (
                    <div 
                      key={hour} 
                      className="grid h-20 border-b border-[#EEEEEE] last:border-b-0 relative"
                      style={{ gridTemplateColumns: `repeat(${displayColumns.length}, 1fr)` }}
                    >
                      {/* 30-min helper line (dashed) */}
                      <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-[#F0F0F0] pointer-events-none" />

                      {/* Columns */}
                      {displayColumns.map((col, idx) => {
                        const isDay = col instanceof Date;
                        const day = isDay ? col : selectedDate;
                        const roomId = isDay ? undefined : (col as Room).id;
                        const holiday = getHolidayForDay(day);
                        const isPlaceholder = (col as any).isPlaceholder;
                        
                        return (
                          <div 
                            key={isDay ? `${day}-${hour}` : `${(col as Room).id}-${hour}-${idx}`} 
                            className={cn(
                              "border-r border-[#EEEEEE] last:border-r-0 relative hover:bg-black/[0.01] transition-colors cursor-pointer px-2.5",
                              holiday && "bg-rose-50/20",
                              isPlaceholder && "bg-[#f9f9f9]"
                            )}
                          >
                            {!isPlaceholder && (
                              <>
                                <div className="h-1/2 w-full hover:bg-black/[0.02]" onClick={(e) => { e.stopPropagation(); onAddBooking(day, hour, 0, roomId); }} />
                                <div className="h-1/2 w-full hover:bg-black/[0.02]" onClick={(e) => { e.stopPropagation(); onAddBooking(day, hour, 30, roomId); }} />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Red Line part (Grid part) */}
                  {isNowInGrid && (
                    <div 
                      className="absolute left-0 right-0 z-40 pointer-events-none h-[1px] bg-[#ff6b6b]"
                      style={{ top: `${timeLineTop + 20}px`, transition: 'top 0.3s ease' }}
                    >
                      <div className="absolute left-0 w-2 h-2 rounded-full bg-[#ff6b6b] -translate-y-1/2 -translate-x-1/2 shadow-[0_0_8px_#ff6b6b]" />
                    </div>
                  )}

                  {/* Bookings Layer */}
                  <div 
                    className="absolute inset-0 pointer-events-none grid"
                    style={{ gridTemplateColumns: `repeat(${displayColumns.length}, 1fr)` }}
                  >
                    {displayColumns.map((col, colIdx) => {
                      const isDayCol = col instanceof Date;

                      if ((col as any).isPlaceholder) return <div key={colIdx} />;

                      const columnBookings = bookings.filter(booking => {
                        if (dragState && dragState.id === booking.id) {
                          if (viewMode === 'week') {
                            return isSameDay(dragState.currentDate, col as Date);
                          } else {
                            return isSameDay(dragState.currentDate, selectedDate) && dragState.currentRoomId === (col as Room).id;
                          }
                        }
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

                                const startMins = displayStart.getHours() * 60 + displayStart.getMinutes();
                                const gridStartMins = START_HOUR * 60;
                                const topOffset = ((startMins - gridStartMins) / 60) * 80;
                                const heightOffset = (differenceInMinutes(displayEnd, displayStart) / 60) * 80;

                                const bookingLayout = layouts.get(booking.id) || { width: '90%', left: '5%', index: 0, groupSize: 1 };
                                const bookingRoom = rooms.find(r => r.id === booking.roomId);
                                const hexColor = (bookingRoom?.color || 'bg-[#cbd098]').match(/\[(.*?)\]/)?.[1] || '#cbd098';

                                return (
                                  <motion.div
                                    layout={!isDragging}
                                    layoutId={isDragging ? undefined : `booking-${booking.id}`}
                                    key={booking.id}
                                    transition={{
                                      layout: { type: "tween", ease: [0.85, 0, 0.15, 1], duration: 0.5 },
                                      opacity: { duration: 0.2 }
                                    }}
                                    whileHover={!isDragging ? {
                                      zIndex: 320,
                                      scale: 1.02,
                                      minWidth: bookingLayout.groupSize >= 3 ? '140px' : undefined,
                                      boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
                                    } : undefined}
                                    onHoverStart={() => setHoveredCardId(booking.id)}
                                    onHoverEnd={() => setHoveredCardId(null)}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      isDraggingRef.current = false;
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
                                      if (isDraggingRef.current) return;
                                      e.stopPropagation();
                                      onEditBooking(booking);
                                    }}
                                    className={cn(
                                      "absolute px-1 md:px-3 py-1 md:py-2 pointer-events-auto cursor-grab active:cursor-grabbing flex flex-col justify-between rounded-lg md:rounded-xl font-['Pretendard'] group transition-shadow shadow-[0_4px_12px_-2px_rgba(0,0,0,0.12),0_2px_8px_-1px_rgba(0,0,0,0.08)] border border-white/40 text-[#4E5057] antialiased",
                                      isDragging && "z-50 shadow-2xl ring-2 ring-white/50 opacity-95 scale-[1.03] cursor-grabbing"
                                    )}
                                    style={{
                                      left: bookingLayout.left,
                                      width: bookingLayout.width,
                                      top: `${topOffset + 20}px`, 
                                      height: `${heightOffset - 2}px`, 
                                      zIndex: isDragging ? 200 : (10 + bookingLayout.index),
                                      background: `linear-gradient(135deg, color-mix(in srgb, ${hexColor}, white 15%) 0%, color-mix(in srgb, ${hexColor}, white 35%) 100%)`,
                                      transition: isDragging ? 'none' : undefined,
                                      paddingLeft: isMobile ? '1px' : undefined,
                                      paddingRight: isMobile ? '1px' : undefined,
                                      backfaceVisibility: 'hidden',
                                      WebkitFontSmoothing: 'antialiased',
                                      transform: isDragging ? 'scale(1.03) translateZ(0)' : 'translateZ(0)'
                                    }}
                                  >
                                    {/* Resize Handles */}
                                    <div 
                                      className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20"
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        isDraggingRef.current = false;
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
                                        isDraggingRef.current = false;
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

                                    <motion.div 
                                      layout 
                                      transition={isDragging ? { duration: 0 } : {
                                        layout: { type: "spring", stiffness: 500, damping: 40, mass: 1 }
                                      }}
                                      className={cn("flex flex-col overflow-hidden h-full pointer-events-none origin-top-left")}
                                    >
                                      {(hoveredCardId === booking.id) || (bookingLayout.groupSize <= 2 && (heightOffset >= 40 || !isMobile)) ? (
                                        <div className="flex flex-col h-full px-1.5 py-1">
                                          <div className="flex-1 overflow-hidden">
                                            <motion.h4 
                                              layout="position" 
                                              initial={bookingLayout.groupSize >= 3 ? { opacity: 0, scale: 0.95, y: 5 } : false}
                                              animate={{ opacity: 1, scale: 1, y: 0 }}
                                              transition={isDragging ? { duration: 0 } : { 
                                                layout: { duration: 0.15 },
                                                opacity: { delay: bookingLayout.groupSize >= 3 ? 0.35 : 0, duration: 0.25 }
                                              }}
                                              className={cn(
                                                "text-[13px] font-bold tracking-tight text-[#4E5057]",
                                                hoveredCardId === booking.id ? "" : "truncate"
                                              )}
                                            >
                                              {booking.title}
                                            </motion.h4>
                                            <AnimatePresence>
                                              {(booking.projectName && (bookingLayout.groupSize <= 2 || hoveredCardId === booking.id) && heightOffset >= 50) && (
                                                <motion.div 
                                                  layout="position"
                                                  initial={bookingLayout.groupSize >= 3 ? { opacity: 0, x: -5, y: 5 } : false}
                                                  animate={{ opacity: 1, x: 0, y: 0 }}
                                                  exit={{ opacity: 0 }}
                                                  transition={isDragging ? { duration: 0 } : { 
                                                    layout: { duration: 0.15 },
                                                    opacity: { delay: bookingLayout.groupSize >= 3 ? 0.38 : 0, duration: 0.25 }
                                                  }}
                                                  className={cn(
                                                    "text-[10px] opacity-90 font-semibold text-[#4E5057]/90",
                                                    hoveredCardId === booking.id ? "" : "truncate"
                                                  )}
                                                >
                                                  [{booking.projectName}]
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                            
                                            <AnimatePresence>
                                              {((((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60)) > 1 || hoveredCardId === booking.id) && heightOffset >= 80) && (
                                                <motion.div 
                                                  layout="position"
                                                  initial={{ opacity: 0, y: 8 }}
                                                  animate={{ opacity: 1, y: 0 }}
                                                  exit={{ opacity: 0 }}
                                                  transition={isDragging ? { duration: 0 } : { 
                                                    layout: { duration: 0.15 },
                                                    opacity: { delay: 0.41, duration: 0.25 }
                                                  }}
                                                  className={cn(
                                                    "text-[10px] mt-0.5 opacity-80 font-medium text-[#4E5057]/80",
                                                    hoveredCardId === booking.id ? "" : "truncate"
                                                  )}
                                                >
                                                  {booking.organizer}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>

                                          <AnimatePresence>
                                            {((((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60)) > 1 || hoveredCardId === booking.id) && heightOffset >= 100) && (
                                              <motion.div 
                                                layout="position"
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                transition={isDragging ? { duration: 0 } : { 
                                                  layout: { duration: 0.15 },
                                                  opacity: { delay: 0.44, duration: 0.25 }
                                                }}
                                                className="mt-auto shrink-0"
                                              >
                                                <div className="h-[1px] bg-[#4E5057]/15 w-full my-1" />
                                                <div className="text-[10px] leading-[1.2] opacity-90 pb-0.5 text-[#4E5057]">
                                                  <div className="font-bold">
                                                    {format(displayStart, 'HH:mm')} - {format(displayEnd, 'HH:mm')}
                                                  </div>
                                                  <div className={cn(
                                                    "opacity-80 font-medium",
                                                    hoveredCardId === booking.id ? "" : "truncate"
                                                  )}>
                                                    {bookingRoom ? bookingRoom.name : '회의실'}
                                                  </div>
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col h-full px-1 justify-center items-center overflow-hidden">
                                          {bookingLayout.groupSize <= 2 && (
                                            <span className="text-[10px] font-bold text-[#4E5057] truncate w-full text-center opacity-80">
                                              {booking.title}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </motion.div>
                                  </motion.div>
                                );
                            })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
