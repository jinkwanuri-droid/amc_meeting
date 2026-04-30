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

  const isDraggingRef = React.useRef(false);

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
    
    if (isMobile) {
      // [MOBILE VIEW] - Consistent lanes per room (Lane-based logic)
      const roomsCount = rooms.length || 1;
      const laneWidth = 100 / roomsCount;

      const bookingsByRoom = new Map<string, Booking[]>();
      columnBookings.forEach(b => {
        const roomBookings = bookingsByRoom.get(b.roomId) || [];
        roomBookings.push(b);
        bookingsByRoom.set(b.roomId, roomBookings);
      });

      rooms.forEach((room, roomIdx) => {
        const roomBookings = bookingsByRoom.get(room.id) || [];
        if (roomBookings.length === 0) return;

        const sorted = [...roomBookings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        const roomGroups: Booking[][] = [];
        sorted.forEach(booking => {
          let added = false;
          for (const group of roomGroups) {
            if (group.some(g => booking.startTime < g.endTime && booking.endTime > g.startTime)) {
              group.push(booking);
              added = true;
              break;
            }
          }
          if (!added) roomGroups.push([booking]);
        });

        roomGroups.forEach(group => {
          const n = group.length;
          group.forEach((booking, idx) => {
            const laneLeft = laneWidth * roomIdx;
            const cardWidthPercent = n > 1 ? (90 / n) : 92;
            const gutter = (laneWidth * (100 - (cardWidthPercent * n)) / 2) / 100;
            layouts.set(booking.id, {
              width: `${laneWidth * (cardWidthPercent / 100)}%`,
              left: `${laneLeft + (gutter) + (idx * laneWidth * cardWidthPercent / 100)}%`,
              index: roomIdx,
              groupSize: roomsCount
            });
          });
        });
      });
    } else {
      // [WEB VIEW] - Dynamic Cascading with Strong Room Alignment
      const sorted = [...columnBookings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      const clusters: Booking[][] = [];
      let currentCluster: Booking[] = [];
      let clusterEnd = 0;
      sorted.forEach(b => {
        if (currentCluster.length === 0 || b.startTime.getTime() < clusterEnd) {
          currentCluster.push(b);
          clusterEnd = Math.max(clusterEnd, b.endTime.getTime());
        } else {
          clusters.push(currentCluster);
          currentCluster = [b];
          clusterEnd = b.endTime.getTime();
        }
      });
      if (currentCluster.length > 0) clusters.push(currentCluster);

      clusters.forEach(cluster => {
        const clusterSize = cluster.length;
        
        // Find unique rooms in this cluster for better distribution
        const uniqueRoomIds = Array.from(new Set(cluster.map(b => b.roomId)))
          .sort((a, b) => rooms.findIndex(r => r.id === a) - rooms.findIndex(r => r.id === b));
        const roomsInClusterCount = uniqueRoomIds.length;

        cluster.forEach(booking => {
          const roomIdx = rooms.findIndex(r => r.id === booking.roomId);
          const localRoomIdx = uniqueRoomIds.indexOf(booking.roomId);
          
          if (clusterSize > 6) {
            // [GRID MODE] - Proper Column Packing for perfect vertical alignment
            const columns: Booking[][] = [];
            const sortedByStartTime = [...cluster].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
            
            sortedByStartTime.forEach(b => {
              let placed = false;
              for (const col of columns) {
                // If this booking doesn't overlap with any in this column, place it
                if (!col.some(cb => b.startTime < cb.endTime && b.endTime > cb.startTime)) {
                  col.push(b);
                  placed = true;
                  break;
                }
              }
              if (!placed) columns.push([b]);
            });

            const numCols = columns.length;
            const colIndex = columns.findIndex(col => col.includes(booking));
            const widthPct = 100 / numCols;
            const leftPct = (colIndex / numCols) * 100;

            layouts.set(booking.id, {
              width: `calc(${widthPct}% - 4px)`,
              left: `calc(${leftPct}% + 2px)`,
              index: colIndex,
              groupSize: numCols
            });
          } else if (clusterSize === 1) {
            // [DYNAMIC FULL WIDTH]
            layouts.set(booking.id, {
              width: 'calc(100% - 24px)',
              left: '12px',
              index: roomIdx,
              groupSize: 1
            });
          } else {
            // [INTERACTIVE CASCADE] - Reduced overlap even more (approx 5% more gap)
            const stagger = 48; // Increased from 42 to reduce overlap further
            const left = 12 + (localRoomIdx * stagger);
            
            // Width: Slightly narrower to reduce overlap coverage
            const baseWidth = (80 / Math.max(roomsInClusterCount, 1)) + 12;
            
            const isLastInCluster = localRoomIdx === roomsInClusterCount - 1;
            const width = isLastInCluster 
              ? `calc(100% - ${left + 14}px)` 
              : `${Math.min(baseWidth, 55)}%`; 

            layouts.set(booking.id, {
              width: width,
              left: `${left}px`,
              index: roomIdx,
              groupSize: clusterSize
            });
          }
        });
      });
    }

    // Safety pass
    columnBookings.forEach(booking => {
      if (!layouts.has(booking.id)) {
        layouts.set(booking.id, { width: '92%', left: '4%', index: 0, groupSize: 1 });
      }
    });

    return layouts;
  };

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden select-none scrollbar-hide">
      {/* Mobile Top Header (Logo) */}
      <div className="lg:hidden h-14 bg-white border-b border-[#E5E5E5] px-6 flex items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <Presentation size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-bold text-base tracking-tighter text-[#1A1A1A]">AMC RoomBook</h1>
        </div>
      </div>
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#E5E5E5] px-4 md:px-8 flex items-center justify-between shrink-0 relative">
        {/* Left: Date Range (Desktop & Mobile) */}
        <div className="flex items-center gap-2 md:gap-8 overflow-hidden min-w-[100px] md:min-w-0">
          <h2 className="text-sm md:text-lg font-bold text-[#1A1A1A] tracking-tight w-auto md:w-[200px] truncate shrink-0">
            {viewMode === 'week' ? (
              <>
                <span className="hidden lg:inline">{format(weekStart, 'yyyy.MM.dd')} - {format(addDays(weekStart, 4), 'MM.dd')}</span>
                <span className="lg:hidden text-[16px] md:text-[14px] font-bold text-[#1A1A1A]">{format(weekStart, 'MM.dd')} - {format(addDays(weekStart, 4), 'MM.dd')}</span>
              </>
            ) : (
              <>{format(selectedDate, 'yyyy. MM. dd', { locale: ko })}</>
            )}
          </h2>
        </div>

        {/* Center: Navigation */}
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
          <div className="hidden md:flex bg-gray-100 p-1 rounded-md">
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
                "hidden md:block px-4 py-1 text-[12px] rounded transition-all",
                viewMode === 'day' ? "bg-white shadow-sm text-black font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
              )}
            >
              DAILY
            </button>
          </div>
          
          <button 
            onClick={() => onAddBooking(selectedDate, START_HOUR, 0)}
            className="bg-black hover:bg-zinc-800 text-white px-3 md:px-5 py-2 rounded-md flex items-center gap-2 text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Plus size={16} strokeWidth={3} />
            <span className="hidden sm:inline">New Reservation</span>
          </button>
        </div>
      </header>

      {/* Grid */}
      <div 
        id="calendar-grid" 
        className={cn(
          "flex-1 overflow-auto bg-[#FDFDFD] relative scrollbar-hide",
          dragState && "select-none"
        )}
        style={{ userSelect: dragState ? 'none' : 'auto' }}
      >
        <div className="min-w-fit md:min-w-[1000px] flex flex-col h-full">
          {/* Headers */}
          <div 
            className="grid bg-white sticky top-0 z-30 border-b border-[#E5E5E5] shrink-0 h-[45px] md:h-[50px]"
            style={{ gridTemplateColumns: `var(--time-col-width) repeat(${displayColumns.length}, 1fr)` }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              :root { --time-col-width: 48px; }
              @media (min-width: 768px) { :root { --time-col-width: 80px; } }
            `}} />
            <div className="border-r md:border-r border-[#EEEEEE] bg-transparent" />
            {displayColumns.map((col, idx) => {
              const isDay = col instanceof Date;
              const holiday = isDay ? getHolidayForDay(col) : null;
              const isSun = isDay && col.getDay() === 0;
              const isSat = isDay && col.getDay() === 6;
              const isPlaceholder = (col as any).isPlaceholder;

              return (
                <div 
                  key={isDay ? col.toString() : (col as Room).id} 
                  className={cn(
                    "flex flex-col items-center justify-center border-r border-[#EEEEEE] last:border-r-0 relative px-1 h-full bg-white",
                    isDay && isSameDay(col, new Date()) && "bg-black/5",
                    isPlaceholder && "bg-[#f9f9f9]"
                  )}
                >
                  {isDay ? (
                    <div className="w-full h-full relative flex flex-col items-center justify-center">
                       {/* Web Layout: 요일(30% L), 날짜(Center), 공휴일(70% R) */}
                       <div className="hidden md:flex w-full h-full relative items-center justify-center">
                          {/* 요일 (30% L) */}
                          <div className="absolute left-[30%] -translate-x-1/2">
                             <span className={cn(
                               "text-[11px] font-bold",
                               (holiday || isSun) ? "text-[#ff6b6b]/80" : isSat ? "text-blue-400" : "text-slate-400"
                             )}>
                               {format(col, 'EEE', { locale: ko })}
                             </span>
                          </div>

                          {/* 날짜 (Center) */}
                          <span className={cn(
                            "text-[14px] font-extrabold tracking-tight",
                            (holiday || isSun) ? "text-[#ff6b6b]" : isSat ? "text-blue-500" : "text-[#1A1A1A]"
                          )}>
                            {format(col, 'MM.dd')}
                          </span>

                          {/* 공휴일 (70% R) */}
                          {holiday && (
                            <div className="absolute left-[70%] -translate-x-1/2">
                              <span className="px-1.5 py-0.5 bg-[#ff6b6b]/5 text-[#ff6b6b] text-[9px] font-bold rounded-md border border-[#ff6b6b]/20 whitespace-nowrap">
                                {holiday.name}
                              </span>
                            </div>
                          )}
                       </div>

                       {/* Mobile Layout: Date top, Weekday/Holiday bottom */}
                       <div className="md:hidden flex flex-col items-center justify-center gap-0.5">
                          <span className={cn(
                            "text-[13px] font-extrabold tracking-tight",
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
                                "text-[9px] font-bold",
                                isSun ? "text-[#ff6b6b]/80" : isSat ? "text-blue-400" : "text-slate-400"
                              )}>
                                {format(col, 'EEE', { locale: ko })}
                              </span>
                            )}
                          </div>
                       </div>
                    </div>
                  ) : (
                    <span className="text-[12px] md:text-[14px] font-bold text-black truncate max-w-full px-2">
                       {(col as Room).name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time Slots & Bookings Area */}
          <div className="flex-1 relative scrollbar-hide pt-[20px]">
            {hours.map((hour) => (
              <div 
                key={hour} 
                className="grid h-20 border-b border-[#EEEEEE] last:border-b-0 relative"
                style={{ gridTemplateColumns: `var(--time-col-width) repeat(${displayColumns.length}, 1fr)` }}
              >
                {/* 30-min helper line (dashed) */}
                <div className="absolute top-1/2 left-[var(--time-col-width)] right-0 border-t border-dashed border-[#F0F0F0] pointer-events-none" />
                <style dangerouslySetInnerHTML={{ __html: `
                  .hour-label { top: 0 !important; }
                  @media (max-width: 1024px) { 
                    .time-col-box { border-right: 1px solid #DDDDDD !important; background: transparent !important; }
                    .hour-label { background: transparent !important; }
                  }
                `}} />

                {/* Time Label */}
                <div className="shrink-0 border-r border-[#EEEEEE] flex items-start justify-center bg-white transition-colors z-10 time-col-box">
                  <span className="text-[10px] md:text-[12px] font-bold text-slate-400 -translate-y-1/2 bg-white px-0.5 md:px-1 hour-label">
                    {format(setHours(new Date(), hour), 'HH:00')}
                  </span>
                </div>

                {/* Columns */}
                {displayColumns.map((col) => {
                  const isDay = col instanceof Date;
                  const day = isDay ? col : selectedDate;
                  const roomId = isDay ? undefined : (col as Room).id;
                  const holiday = getHolidayForDay(day);
                  const isPlaceholder = (col as any).isPlaceholder;
                  
                  return (
                    <div 
                      key={isDay ? `${day}-${hour}` : `${(col as Room).id}-${hour}`} 
                      className={cn(
                        "border-r border-[#EEEEEE] last:border-r-0 relative hover:bg-black/[0.01] transition-colors cursor-pointer px-2.5",
                        holiday && "bg-rose-50/20",
                        isPlaceholder && "bg-[#f9f9f9]"
                      )}
                    >
                      {!isPlaceholder && (
                        <>
                          {/* Clickable regions for 30m increments */}
                          <div className="h-1/2 w-full hover:bg-black/[0.02]" onClick={(e) => { e.stopPropagation(); onAddBooking(day, hour, 0, roomId); }} />
                          <div className="h-1/2 w-full hover:bg-black/[0.02]" onClick={(e) => { e.stopPropagation(); onAddBooking(day, hour, 30, roomId); }} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Current Time Line */}
            {isNowInGrid && (
              <div 
                className="absolute left-0 right-0 z-40 pointer-events-none"
                style={{ top: `${timeLineTop + 20}px`, transition: 'top 0.3s ease' }}
              >
                <div 
                  className="grid"
                  style={{ gridTemplateColumns: `var(--time-col-width) 1fr` }}
                >
                  <div className="flex justify-end items-center pr-2 h-0">
                    <span className="bg-[#ff6b6b] text-white text-[10px] md:text-[12px] font-black px-1 md:px-1.5 py-0.5 shadow-md whitespace-nowrap rounded-sm leading-none flex items-center justify-center">
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
              style={{ gridTemplateColumns: `var(--time-col-width) repeat(${displayColumns.length}, 1fr)` }}
            >
               <div className="pointer-events-none" /> {/* Spacer for time column */}
               {displayColumns.map((_, colIdx) => {
                 const col = displayColumns[colIdx];
                 const isDayCol = col instanceof Date;

                 if ((col as any).isPlaceholder) return <div key={colIdx} />;

                 const columnBookings = bookings.filter(booking => {
                   // If this booking is being dragged, it belongs to its "current" drag column
                   if (dragState && dragState.id === booking.id) {
                     if (viewMode === 'week') {
                       return isSameDay(dragState.currentDate, col as Date);
                     } else {
                       return isSameDay(dragState.currentDate, selectedDate) && dragState.currentRoomId === (col as Room).id;
                     }
                   }

                   // Original filtering for non-dragged bookings
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

                          const startMins = displayStart.getHours() * 60 + displayStart.getMinutes();
                          const gridStartMins = START_HOUR * 60;
                          const top = ((startMins - gridStartMins) / 60) * 80;
                          const height = (differenceInMinutes(displayEnd, displayStart) / 60) * 80;

                          const layout = layouts.get(booking.id) || { width: '90%', left: '5%', index: 0, groupSize: 1 };
                          const bookingRoom = rooms.find(r => r.id === booking.roomId);
                          const themeColor = bookingRoom?.color || 'bg-[#cbd098]';
                          const hexColor = themeColor.match(/\[(.*?)\]/)?.[1] || '#cbd098';

                          return (
                            <motion.div
                              layout={!isDragging}
                              layoutId={isDragging ? undefined : `booking-${booking.id}`}
                              key={booking.id}
                              transition={{
                                layout: { 
                                  type: "tween", 
                                  ease: [0.85, 0, 0.15, 1], // Fast start, slow middle, fast end (S-curve)
                                  duration: 0.5 
                                },
                                opacity: { duration: 0.2 }
                              }}
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
                                "absolute px-1 md:px-3 py-1 md:py-2 pointer-events-auto cursor-grab active:cursor-grabbing flex flex-col justify-between rounded-lg md:rounded-xl shadow-sm font-['Pretendard'] group",
                                isDragging && "z-50 shadow-xl opacity-95 scale-[1.03] cursor-grabbing"
                              )}
                              style={{
                                left: isMobile ? `calc(${layout.index * (100 / layout.groupSize)}% + 1px)` : layout.left,
                                width: isMobile ? `calc(${100 / layout.groupSize}% - 2px)` : layout.width,
                                top: `${top + 20}px`, 
                                height: `${height - 2}px`, 
                                zIndex: isDragging ? 100 : (10 + layout.index),
                                background: `linear-gradient(135deg, ${hexColor} 0%, color-mix(in srgb, ${hexColor}, white 20%) 100%)`,
                                color: 'white',
                                transition: isDragging ? 'none' : undefined,
                                paddingLeft: isMobile ? '1px' : undefined,
                                paddingRight: isMobile ? '1px' : undefined
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

                              <div className="hidden md:flex flex-col overflow-hidden h-full pointer-events-none">
                                {layout.groupSize <= 6 ? (
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
