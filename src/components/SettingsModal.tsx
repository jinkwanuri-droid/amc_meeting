import React from 'react';
import { cn } from '../lib/utils';
import { X, Plus, Trash2, MapPin, Calendar, GripVertical, Check, Pencil, ChevronDown, Lock, ChevronRight, BarChart3, Users, Clock, Hash, TrendingUp } from 'lucide-react';
import { Room, Holiday, Booking } from '../types';
import { format, isValid, startOfDay, endOfDay, isWithinInterval, differenceInMinutes, subDays, subMonths, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { ROOM_THEME_COLORS } from '../constants';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRoomItemProps {
  key?: string;
  room: Room;
  onUpdate: (id: string, updates: Partial<Room>) => void;
  onRemove: (id: string) => void;
  isEditMode: boolean;
}

function SortableRoomItem({ room, onUpdate, onRemove, isEditMode }: SortableRoomItemProps) {
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColorPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: room.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`flex items-center gap-2 px-2 bg-white rounded-xl border border-slate-100 shadow-sm transition-all h-11 group ${isDragging ? 'shadow-lg ring-2 ring-black/5' : ''}`}
    >
      <div className={`w-5 flex items-center justify-center shrink-0 ${isEditMode ? 'cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500' : 'opacity-0'}`} {...(isEditMode ? attributes : {})} {...(isEditMode ? listeners : {})}>
        {isEditMode && <GripVertical size={14} />}
      </div>
      
      <input 
        disabled={!isEditMode}
        type="text" 
        placeholder="Room Name"
        className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[13px] font-bold placeholder:text-slate-200 disabled:text-slate-700 truncate min-w-0"
        value={room.name}
        onChange={(e) => onUpdate(room.id, { name: e.target.value })}
      />
      
      <div className="flex items-center justify-end gap-3 shrink-0 w-[120px]">
        <div className="flex items-center gap-1">
          <input 
            disabled={!isEditMode}
            type="number" 
            placeholder="Cap"
            className="w-8 bg-transparent border-none focus:ring-0 p-0 text-[12px] font-bold text-slate-400 text-right placeholder:text-slate-200 disabled:opacity-50"
            value={room.capacity}
            onChange={(e) => onUpdate(room.id, { capacity: Number(e.target.value) })}
          />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">명</span>
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            disabled={!isEditMode}
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            className="w-5 h-5 rounded-full transition-all flex items-center justify-center hover:scale-105 disabled:hover:scale-100 shadow-sm"
            style={{ backgroundColor: room.color?.match(/\[(.*?)\]/)?.[1] || '#cbd098' }}
          >
            {isEditMode && <ChevronDown size={10} className="text-white drop-shadow-sm" />}
          </button>

          <AnimatePresence>
            {isColorPickerOpen && isEditMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 p-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 grid grid-cols-4 gap-2 w-[140px]"
              >
                {ROOM_THEME_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onUpdate(room.id, { color });
                      setIsColorPickerOpen(false);
                    }}
                    className="w-5 h-5 rounded-full transition-all relative hover:scale-110 flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: color.match(/\[(.*?)\]/)?.[1] }}
                  >
                    {room.color === color && <Check size={8} className="text-white drop-shadow-sm" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={`w-8 shrink-0 flex items-center justify-center transition-opacity ${isEditMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button 
          onClick={() => onRemove(room.id)}
          disabled={!isEditMode}
          className="p-1.5 text-[#ff6b6b] hover:text-white hover:bg-[#ff6b6b] rounded-md transition-colors"
        >
          <Trash2 size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

type StatsPeriod = 'today' | '7days' | '1month' | '3months' | 'all';

function StatisticsView({ bookings, rooms, backendStats }: { bookings: Booking[], rooms: Room[], backendStats: any }) {
  const [period, setPeriod] = React.useState<StatsPeriod>('all');
  const now = new Date();

  // 0. Filter bookings based on selected period
  const filteredBookings = React.useMemo(() => {
    return bookings.filter(b => {
      // Booking times are ISO strings from backend, need to wrap in new Date() if they aren't already Date objects
      const startTime = new Date(b.startTime);
      if (period === 'all') return true;
      if (period === 'today') return isWithinInterval(startTime, { start: startOfDay(now), end: endOfDay(now) });
      if (period === '7days') return isAfter(startTime, subDays(now, 7));
      if (period === '1month') return isAfter(startTime, subMonths(now, 1));
      if (period === '3months') return isAfter(startTime, subMonths(now, 3));
      return true;
    });
  }, [bookings, period]);

  // 1. Room Statistics
  const roomStats = rooms.map(room => {
    const roomBookings = filteredBookings.filter(b => b.roomId === room.id);
    const totalMinutes = roomBookings.reduce((acc, b) => acc + differenceInMinutes(new Date(b.endTime), new Date(b.startTime)), 0);
    
    // Utilization calculation based on period
    let daysWithData = 30; // Default for 'all'
    if (period === 'today') daysWithData = 1;
    else if (period === '7days') daysWithData = 7;
    else if (period === '1month') daysWithData = 30;
    else if (period === '3months') daysWithData = 90;
    else {
      // For 'all', calculate actual spread if possible, or use a reasonable window
      if (bookings.length > 0) {
        const start = bookings.reduce((min, b) => {
          const t = new Date(b.startTime);
          return t < min ? t : min;
        }, new Date(bookings[0].startTime));
        const end = bookings.reduce((max, b) => {
          const t = new Date(b.endTime);
          return t > max ? t : max;
        }, new Date(bookings[0].endTime));
        daysWithData = Math.max(1, Math.ceil(differenceInMinutes(end, start) / (24 * 60)));
      }
    }

    const totalAvailableMinutes = daysWithData * 11 * 60; // 07:00 - 18:00
    const utilization = Math.min(100, (totalMinutes / totalAvailableMinutes) * 100);

    return {
      name: room.name,
      count: roomBookings.length,
      minutes: totalMinutes,
      hours: (totalMinutes / 60).toFixed(1),
      utilization: parseFloat(utilization.toFixed(1)),
      color: room.color?.match(/\[(.*?)\]/)?.[1] || '#cbd098'
    };
  });

  // 2. Keyword Analysis
  const organizerCounts: Record<string, number> = {};
  const projectCounts: Record<string, number> = {};
  
  filteredBookings.forEach(b => {
    organizerCounts[b.organizer] = (organizerCounts[b.organizer] || 0) + 1;
    if (b.projectName) {
      projectCounts[b.projectName] = (projectCounts[b.projectName] || 0) + 1;
    }
  });

  const topOrganizers = Object.entries(organizerCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const topProjects = Object.entries(projectCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const periodOptions: { value: StatsPeriod; label: string }[] = [
    { value: 'today', label: '오늘' },
    { value: '7days', label: '7일' },
    { value: '1month', label: '1개월' },
    { value: '3months', label: '3개월' },
    { value: 'all', label: '전체' }
  ];

  return (
    <div className="space-y-8 pb-10 relative">
      {/* Period Filter (Blue box area position) */}
      <div className="absolute top-[-52px] right-2 z-10 flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-slate-200">
        {periodOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={cn(
              "px-2 py-1 text-[9px] font-black rounded-md transition-all whitespace-nowrap",
              period === opt.value 
                ? "bg-white text-black shadow-sm" 
                : "text-slate-400 hover:text-slate-500"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 1. Traffic Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#F9F9F9] rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-black/10 group-hover:bg-black transition-colors" />
          <div className="flex items-center gap-3 text-slate-400 mb-3">
            <Users size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">오늘 방문자</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-black">{backendStats?.visitors || 0}</span>
            <span className="text-[12px] font-bold text-slate-400">명</span>
          </div>
        </div>
        <div className="bg-[#F9F9F9] rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-100 group-hover:bg-emerald-500 transition-colors" />
          <div className="flex items-center gap-3 text-slate-400 mb-3">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">오늘 요청건수</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-black">
              {(backendStats?.actions?.today?.create || 0) + (backendStats?.actions?.today?.update || 0) + (backendStats?.actions?.today?.delete || 0)}
            </span>
            <span className="text-[12px] font-bold text-slate-400">건</span>
          </div>
        </div>
      </div>

      {/* 2. Action History Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Clock size={14} />
          요청 기록 요약
        </h3>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="bg-[#F9F9F9] text-slate-400 font-black tracking-widest uppercase">
                <th className="px-4 py-2 border-b border-slate-100">기간</th>
                <th className="px-4 py-2 border-b border-slate-100">작성</th>
                <th className="px-4 py-2 border-b border-slate-100">수정</th>
                <th className="px-4 py-2 border-b border-slate-100">삭제</th>
                <th className="px-4 py-2 border-b border-slate-100 text-right">합계</th>
              </tr>
            </thead>
            <tbody className="font-bold text-slate-600">
              {['today', 'week', 'month', 'all'].map(period => {
                const data = backendStats?.actions?.[period] || { create: 0, update: 0, delete: 0 };
                const total = data.create + data.update + data.delete;
                const labels: Record<string, string> = { today: '오늘', week: '최근 7일', month: '최근 30일', all: '전체' };
                return (
                  <tr key={period} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-black text-black">{labels[period]}</td>
                    <td className="px-4 py-2.5">{data.create}</td>
                    <td className="px-4 py-2.5">{data.update}</td>
                    <td className="px-4 py-2.5">{data.delete}</td>
                    <td className="px-4 py-2.5 text-right text-black font-black">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Room Utilization Bar Chart */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <BarChart3 size={14} />
          회의실 가동률 (%)
        </h3>
        <div className="h-[200px] w-full bg-[#FDFDFD] rounded-2xl border border-slate-100 p-4 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roomStats} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
              />
              <Bar dataKey="utilization" radius={[6, 6, 0, 0]}>
                {roomStats.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Room Share Pie Chart & Reservation Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Hash size={14} />
            예약 비중 (건수)
          </h3>
          <div className="h-[180px] bg-white rounded-2xl border border-slate-100 flex items-center justify-center p-2 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roomStats}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {roomStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             분석 요약
          </h3>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4 shadow-sm h-[180px] overflow-y-auto scrollbar-hide">
             <div className="space-y-1.5">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">주요 예약자</span>
               <div className="flex flex-wrap gap-1.5">
                 {topOrganizers.map((o, idx) => (
                   <span key={idx} className="px-2 py-1 bg-slate-50 text-[10px] font-bold text-slate-600 rounded-lg border border-slate-100 whitespace-nowrap">
                     {o.name} <span className="text-black ml-1">{o.value}</span>
                   </span>
                 ))}
               </div>
             </div>
             <div className="space-y-1.5">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">주요 프로젝트</span>
               <div className="flex flex-wrap gap-1.5">
                 {topProjects.length > 0 ? topProjects.map((p, idx) => (
                   <span key={idx} className="px-2 py-1 bg-black text-white text-[10px] font-bold rounded-lg whitespace-nowrap shadow-sm">
                     {p.name} <span className="opacity-60 ml-1">{p.value}</span>
                   </span>
                 )) : <span className="text-[10px] font-medium text-slate-400">데이터 없음</span>}
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  bookings: Booking[];
  holidays: Holiday[];
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateHolidays: (holidays: Holiday[]) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  rooms: initialRooms,
  bookings,
  holidays: initialHolidays,
  onUpdateRooms,
  onUpdateHolidays
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = React.useState<'rooms' | 'holidays' | 'stats'>('rooms');
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [passwordInput, setPasswordInput] = React.useState('');
  const [passwordError, setPasswordError] = React.useState(false);
  const [backendStats, setBackendStats] = React.useState<any>(null);
  
  // Local state for immediate feedback
  const [localRooms, setLocalRooms] = React.useState<Room[]>(initialRooms);
  const [localHolidays, setLocalHolidays] = React.useState<Holiday[]>(initialHolidays);

  const SETTINGS_PASSWORD = import.meta.env.VITE_SETTINGS_PASSWORD || '1234';

  // Sync from props when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalRooms(initialRooms);
      setLocalHolidays(initialHolidays);
      setIsAuthenticated(false);
      setPasswordInput('');
      setPasswordError(false);
      fetchStats();
    }
  }, [isOpen, initialRooms, initialHolidays]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setBackendStats(data);
      }
    } catch (e) {
      console.warn("Failed to fetch stats", e);
    }
  };

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === SETTINGS_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setPasswordInput('');
      // Vibrate effect could be added here
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isEditMode) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditMode, onClose]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localRooms.findIndex((r) => r.id === active.id);
      const newIndex = localRooms.findIndex((r) => r.id === over.id);
      const nextRooms = arrayMove(localRooms, oldIndex, newIndex) as Room[];
      setLocalRooms(nextRooms);
      onUpdateRooms(nextRooms);
    }
  };

  const addRoom = () => {
    const newRoom: Room = {
      id: `room-${Math.random().toString(36).substring(2, 9)}`,
      name: '새 회의실',
      capacity: 4,
      color: ROOM_THEME_COLORS[0]
    };
    const nextRooms = [newRoom, ...localRooms];
    setLocalRooms(nextRooms);
    onUpdateRooms(nextRooms);
  };

  const removeRoom = (id: string) => {
    const nextRooms = localRooms.filter(r => r.id !== id);
    setLocalRooms(nextRooms);
    onUpdateRooms(nextRooms);
  };

  const updateRoom = (id: string, updates: Partial<Room>) => {
    const nextRooms = localRooms.map(r => r.id === id ? { ...r, ...updates } : r);
    setLocalRooms(nextRooms);
    // Don't sync on every keystroke, but maybe on blur? 
    // For now, let's just use the "Check" button to save or wait for completion.
  };

  const addHoliday = () => {
    const newHoliday: Holiday = {
      id: `holiday-${Math.random().toString(36).substring(2, 9)}`,
      name: '새 일정',
      date: new Date(),
      isCustom: true
    };
    const nextHolidays = [newHoliday, ...localHolidays];
    setLocalHolidays(nextHolidays);
    onUpdateHolidays(nextHolidays);
  };

  const removeHoliday = (id: string) => {
    const nextHolidays = localHolidays.filter(h => h.id !== id);
    setLocalHolidays(nextHolidays);
    onUpdateHolidays(nextHolidays);
  };

  const updateHoliday = (id: string, updates: Partial<Holiday>) => {
    const nextHolidays = localHolidays.map(h => h.id === id ? { ...h, ...updates } : h);
    setLocalHolidays(nextHolidays);
  };

  const customHolidays = localHolidays.filter(h => h.isCustom);

  const handleSaveAndSync = () => {
    if (activeTab === 'rooms') onUpdateRooms(localRooms);
    else onUpdateHolidays(localHolidays);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="bg-white rounded-3xl w-full max-w-xl h-[500px] flex overflow-hidden border border-[#E5E5E5] shadow-2xl relative"
        >
          <AnimatePresence mode="wait">
            {!isAuthenticated ? (
              <motion.div 
                key="auth"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-8"
              >
                <div className="w-16 h-16 bg-[#F9F9F9] rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <Lock size={28} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tighter mb-2">관리자 인증</h2>
                <p className="text-slate-400 text-[13px] font-medium mb-8 text-center">
                  회의실 및 공휴일 관리를 위해<br />비밀번호를 입력해주세요.
                </p>

                <form onSubmit={handlePasswordSubmit} className="w-full max-w-[240px] space-y-4">
                  <motion.div 
                    animate={passwordError ? { x: [-10, 10, -10, 10, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className="relative"
                  >
                    <input 
                      autoFocus
                      type="password"
                      placeholder="••••"
                      className={cn(
                        "w-full bg-[#F9F9F9] border-2 rounded-2xl px-5 py-4 text-center text-2xl font-black tracking-[0.5em] transition-all focus:outline-none focus:ring-0",
                        passwordError ? "border-[#ff6b6b]" : "border-transparent focus:border-black/5"
                      )}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError(false);
                      }}
                    />
                    {passwordError && (
                      <p className="absolute -bottom-6 left-0 right-0 text-center text-[#ff6b6b] text-[10px] font-bold uppercase tracking-widest">
                        Incorrect password
                      </p>
                    )}
                  </motion.div>

                  <button 
                    type="submit"
                    className="w-full bg-black text-white rounded-2xl py-4 font-black text-[14px] flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all active:scale-[0.98]"
                  >
                    인증하기
                    <ChevronRight size={18} />
                  </button>
                </form>

                <button 
                  onClick={onClose}
                  className="mt-8 text-slate-400 text-[12px] font-bold hover:text-black transition-colors"
                >
                  돌아가기
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full flex h-full"
              >
                {/* Settings Sidebar */}
                <div className="w-40 bg-[#F9F9F9] border-r border-[#E5E5E5] p-6 flex flex-col gap-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Settings</h3>
                  <button 
                    onClick={() => setActiveTab('rooms')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'rooms' ? 'bg-black text-white' : 'text-slate-600 hover:bg-black/5'
                    }`}
                  >
                    <MapPin size={14} />
                    회의실
                  </button>
                  <button 
                    onClick={() => setActiveTab('holidays')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'holidays' ? 'bg-black text-white' : 'text-slate-600 hover:bg-black/5'
                    }`}
                  >
                    <Calendar size={14} />
                    공휴일
                  </button>
                  
                  <div className="h-[1px] bg-slate-200 my-2 mx-2" />

                  <button 
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'stats' ? 'bg-black text-white' : 'text-slate-600 hover:bg-black/5'
                    }`}
                  >
                    <BarChart3 size={14} />
                    통계
                  </button>

                  <div className="mt-auto">
                      <button 
                      onClick={() => {
                        handleSaveAndSync();
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-black transition-all"
                      >
                      <X size={14} />
                      닫기
                      </button>
                  </div>
                </div>

                {/* Settings Content */}
                <div className="flex-1 p-8 flex flex-col min-w-0 bg-[#FDFDFD]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight">
                      {activeTab === 'rooms' ? '회의실 관리' : activeTab === 'holidays' ? '공휴일 관리' : '시스템 통계'}
                    </h2>
                    <div className="flex items-center gap-2">
                      {activeTab !== 'stats' && (
                        isEditMode ? (
                          <>
                            <button 
                              onClick={activeTab === 'rooms' ? addRoom : addHoliday}
                              className="p-1.5 bg-black text-white rounded-full hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                              title="Add New"
                            >
                              <Plus size={15} strokeWidth={3} />
                            </button>
                            <button 
                              onClick={() => {
                                handleSaveAndSync();
                                setIsEditMode(false);
                              }}
                              className="p-1.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-all shadow-sm active:scale-95"
                              title="Complete"
                            >
                              <Check size={15} strokeWidth={3} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => setIsEditMode(true)}
                            className="p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-all shadow-sm active:scale-95"
                            title="Edit Settings"
                          >
                            <Pencil size={15} />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {activeTab === 'rooms' ? (
                       <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext 
                          items={localRooms.map(r => r.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {localRooms.map(room => (
                            <SortableRoomItem 
                              key={room.id} 
                              room={room} 
                              onUpdate={(id, updates) => updateRoom(id, updates)} 
                              onRemove={removeRoom} 
                              isEditMode={isEditMode}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : activeTab === 'holidays' ? (
                      customHolidays.map(holiday => (
                        <div key={holiday.id} className="flex items-center gap-2 px-2 bg-white rounded-xl border border-slate-100 shadow-sm h-11 group">
                          <div className="w-5 shrink-0" />
                          
                          <input 
                            disabled={!isEditMode}
                            type="text" 
                            placeholder="Holiday Name"
                            className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[13px] font-bold placeholder:text-slate-200 disabled:text-slate-700 truncate min-w-0"
                            value={holiday.name}
                            onChange={(e) => updateHoliday(holiday.id, { name: e.target.value })}
                          />
                          
                          <div className="relative flex items-center justify-end shrink-0 w-[120px]">
                            <div className="flex items-center justify-end text-[11px] font-bold text-slate-400 whitespace-nowrap min-w-[100px]">
                              {isValid(holiday.date) ? format(holiday.date, 'yyyy.MM.dd') : '날짜 선택'}
                              {isValid(holiday.date) && <span className="ml-1">({format(holiday.date, 'EEEEEE', { locale: ko })})</span>}
                            </div>
                            <input 
                              disabled={!isEditMode}
                              type="date" 
                              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-auto"
                              value={isValid(holiday.date) ? format(holiday.date, 'yyyy-MM-dd') : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const d = new Date(e.target.value);
                                  if (isValid(d)) updateHoliday(holiday.id, { date: d });
                                }
                              }}
                            />
                          </div>
                          
                          <div className={`w-8 shrink-0 flex items-center justify-center transition-opacity ${isEditMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <button 
                              onClick={() => removeHoliday(holiday.id)}
                              disabled={!isEditMode}
                              className="p-1.5 text-[#ff6b6b] hover:text-white hover:bg-[#ff6b6b] rounded-md transition-colors"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <StatisticsView bookings={bookings} rooms={localRooms} backendStats={backendStats} />
                    )}
                    {activeTab === 'holidays' && customHolidays.length === 0 && (
                      <div className="h-40 flex flex-col items-center justify-center text-slate-300">
                        <Calendar size={32} className="mb-2 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No custom holidays</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
