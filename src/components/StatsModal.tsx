import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, Users, TrendingUp, Clock, BarChart3, Hash, Calendar, PieChart as PieChartIcon, Info, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Room, Booking } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, isAfter, subDays, subMonths, differenceInMinutes, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie, LabelList, ComposedChart, Line, Label } from 'recharts';

function syncRoomColor(hexStr: string) {
  let hex = hexStr?.match(/\[(.*?)\]/)?.[1] || hexStr || '#cbd098';
  if (!hex || !hex.startsWith('#')) return '#333333';
  
  // No more aggressive darkening (-50 was too much)
  // We keep the original theme color for synchronization
  return hex;
}

const CustomTooltip = ({ active, payload, label, mode }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-2 min-w-[140px] z-[2000]">
        {label && (
          <p className="text-[11px] font-black text-slate-900 border-b border-slate-100 pb-1.5">
            {label}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {payload.map((item: any, index: number) => {
            const color = item.fill || item.color || (item.payload && item.payload.color) || '#94a3b8';
            const name = item.name;
            const value = item.value;
            const unit = mode === 'minutes' ? '분' : (mode === 'count' ? '건' : '');
            
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px]">{name}</span>
                </div>
                <span className="text-[11px] font-black text-slate-900 whitespace-nowrap">{value.toLocaleString()}{unit}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

type StatsPeriod = 'today' | '7days' | '1month' | '3months' | 'all';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  rooms: Room[];
  backendStats?: any;
  onRefreshStats?: () => void;
}

export default function StatsModal({ isOpen, onClose, bookings, rooms, backendStats: initialBackendStats, onRefreshStats }: StatsModalProps) {
  const [period, setPeriod] = React.useState<StatsPeriod>('all');
  const [dayOfWeekMode, setDayOfWeekMode] = React.useState<'count' | 'minutes'>('count');
  const [localBackendStats, setLocalBackendStats] = React.useState<any>(initialBackendStats);
  const [isLoading, setIsLoading] = React.useState(!initialBackendStats);

  React.useEffect(() => {
    if (isOpen) {
      if (initialBackendStats) {
        setLocalBackendStats(initialBackendStats);
        setIsLoading(false);
      }
      fetchStats();
    }
  }, [isOpen, initialBackendStats]);

  const fetchStats = async () => {
    // If we don't have stats yet, show loading
    if (!localBackendStats) setIsLoading(true);
    
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setLocalBackendStats(data);
      }
    } catch (e) {
      console.warn("Failed to fetch stats", e);
    } finally {
      setIsLoading(false);
    }
  };

  const backendStats = localBackendStats;

  const now = new Date();

  // Filter bookings based on selected period
  const filteredBookings = React.useMemo(() => {
    return bookings.filter(b => {
      const startTime = new Date(b.startTime);
      if (period === 'all') return true;
      if (period === 'today') return isWithinInterval(startTime, { start: startOfDay(now), end: endOfDay(now) });
      if (period === '7days') return isAfter(startTime, subDays(now, 7));
      if (period === '1month') return isAfter(startTime, subMonths(now, 1));
      if (period === '3months') return isAfter(startTime, subMonths(now, 3));
      return true;
    });
  }, [bookings, period]);

  const periodOptions: { value: StatsPeriod; label: string; backendKey: string }[] = React.useMemo(() => [
    { value: 'today', label: '오늘', backendKey: 'today' },
    { value: '7days', label: '최근 7일', backendKey: 'week' },
    { value: '1month', label: '최근 1개월', backendKey: 'month' },
    { value: '3months', label: '최근 3개월', backendKey: 'three_months' },
    { value: 'all', label: '전체', backendKey: 'all' }
  ], []);

  const currentPeriodOption = periodOptions.find(o => o.value === period)!;
  const currentActions = backendStats?.actions?.[currentPeriodOption.backendKey] || { create: 0, update: 0, delete: 0 };
  const totalActions = currentActions.create + currentActions.update + currentActions.delete;
  
  // Calculate Cancellation Rate
  const cancelRate = totalActions > 0 ? Math.round((currentActions.delete / totalActions) * 100) : 0;

  // Total Duration for calculated period
  const data = React.useMemo(() => {
    let daysInRange = 1;
    if (period === '7days') daysInRange = 7;
    else if (period === '1month') daysInRange = 30;
    else if (period === '3months') daysInRange = 90;
    else if (period === 'all') {
      const start = bookings.length > 0 ? new Date(Math.min(...bookings.map(b => new Date(b.startTime).getTime()))) : subDays(now, 30);
      daysInRange = Math.max(1, Math.ceil(differenceInMinutes(now, start) / (24 * 60)));
    }

    // Room Detailed Stats
    let totalAllMinutes = 0;
    const roomStats = rooms.map(room => {
      const roomBookings = filteredBookings.filter(b => b.roomId === room.id);
      const totalMinutes = roomBookings.reduce((acc, b) => acc + differenceInMinutes(new Date(b.endTime), new Date(b.startTime)), 0);
      totalAllMinutes += totalMinutes;

      const avgMinutes = roomBookings.length > 0 ? totalMinutes / roomBookings.length : 0;
      const totalAvailableMinutes = daysInRange * 11 * 60; // 07:00 - 18:00
      const utilization = Math.min(100, (totalMinutes / totalAvailableMinutes) * 100);

      return {
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        utilization: utilization,
        count: roomBookings.length,
        avgMinutes: Math.round(avgMinutes),
        totalMinutes,
        color: room.color?.match(/\[(.*?)\]/)?.[1] || '#cbd098'
      };
    }).sort((a,b) => a.name.localeCompare(b.name)); // Sort by room name

    const overallAvgMinutes = filteredBookings.length > 0 ? Math.round(totalAllMinutes / filteredBookings.length) : 0;
    const overallUtilization = (totalAllMinutes / (rooms.length * daysInRange * 11 * 60)) * 100;

    // Peak Time Analysis (Time Slots)
    const timeSlots: { time: string; count: number; hour: number; min: number }[] = [];
    for (let h = 7; h <= 18; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 18 && m > 0) continue;
        timeSlots.push({ 
          time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, 
          count: 0, hour: h, min: m 
        });
      }
    }

    // Day of Week Analysis
    type DayOfWeekData = { name: string; total: number; totalMinutes: number; [key: string]: string | number };
    const dayOfWeekDataTemplate: DayOfWeekData[] = [
      { name: '월', total: 0, totalMinutes: 0 },
      { name: '화', total: 0, totalMinutes: 0 },
      { name: '수', total: 0, totalMinutes: 0 },
      { name: '목', total: 0, totalMinutes: 0 },
      { name: '금', total: 0, totalMinutes: 0 },
    ];
    const dayOfWeekData = [...dayOfWeekDataTemplate.map(d => ({ ...d }))];

    // Specialized Stats
    const organizerMap = new Map<string, { count: number; minutes: number }>();
    const projectMap = new Map<string, { count: number; minutes: number }>();
    const keywordMap = new Map<string, number>();

    filteredBookings.forEach(b => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      const day = getDay(start);
      
      if (day >= 1 && day <= 5) {
        const idx = day - 1;
        const room = rooms.find(r => r.id === b.roomId);
        const roomKey = room ? room.name : 'Unknown';
        const mins = differenceInMinutes(end, start);
        
        // Count data
        dayOfWeekData[idx][roomKey] = ((dayOfWeekData[idx][roomKey] as number) || 0) + 1;
        dayOfWeekData[idx].total += 1;
        
        // Minutes data (suffix with _min to avoid key collision)
        const minKey = `${roomKey}_min`;
        dayOfWeekData[idx][minKey] = ((dayOfWeekData[idx][minKey] as number) || 0) + mins;
        dayOfWeekData[idx].totalMinutes += mins;
      }
      
      timeSlots.forEach(slot => {
        const slotStart = new Date(start);
        slotStart.setHours(slot.hour, slot.min, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slot.min + 30);
        if (start < slotEnd && end > slotStart) {
          slot.count++;
        }
      });

      const org = b.organizer || '미지정';
      const mins = differenceInMinutes(end, start);
      const currentOrg = organizerMap.get(org) || { count: 0, minutes: 0 };
      organizerMap.set(org, { count: currentOrg.count + 1, minutes: currentOrg.minutes + mins });

      const prj = b.projectName || '미지정';
      const currentPrj = projectMap.get(prj) || { count: 0, minutes: 0 };
      projectMap.set(prj, { count: currentPrj.count + 1, minutes: currentPrj.minutes + mins });

      // Keyword Analysis with Stop Words
      const STOP_WORDS = ['예약', '회의', '미팅', '진행', '참석', '논의', '관련', '보고', '업무', '주방', '자리', '시간', '일정'];
      const text = b.description || '';
      const words = text.split(/\s+/).filter(w => 
        w.length >= 2 && !STOP_WORDS.some(sw => w.includes(sw))
      );
      words.forEach(w => {
        // Clean word (remove special chars)
        const cleanWord = w.replace(/[.,!?()[\]]/g, '');
        if (cleanWord.length >= 2) {
          keywordMap.set(cleanWord, (keywordMap.get(cleanWord) || 0) + 1);
        }
      });
    });

    const topOrganizers = Array.from(organizerMap.entries())
      .map(([name, data]) => ({ name, ...data, percent: (data.minutes / Math.max(1, totalAllMinutes)) * 100 }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 3);

    const topProjects = Array.from(projectMap.entries())
      .map(([name, data]) => ({ name, ...data, percent: (data.minutes / Math.max(1, totalAllMinutes)) * 100 }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 3);

    const topKeywords = Array.from(keywordMap.entries())
      .sort((a,b) => b[1] - a[1])
      .slice(0, 8);

    const roomActionStats = rooms.map(room => {
      const actions = backendStats?.roomActions?.filter((ra: any) => String(ra.room_id) === String(room.id)) || [];
      const create = parseInt(actions.find((a: any) => a.action === 'create_booking')?.count || '0');
      const update = parseInt(actions.find((a: any) => a.action === 'update_booking')?.count || '0');
      const del = parseInt(actions.find((a: any) => a.action === 'delete_booking')?.count || '0');
      return { name: room.name, create, update, del, total: create + update + del };
    });

    const actionSummary = roomActionStats.reduce((acc, curr) => ({
      create: acc.create + curr.create,
      update: acc.update + curr.update,
      del: acc.del + curr.del,
      total: acc.total + curr.total
    }), { create: 0, update: 0, del: 0, total: 0 });

    return {
      daysInRange,
      roomStats,
      totalAllMinutes,
      overallAvgMinutes,
      overallUtilization,
      timeSlots,
      dayOfWeekData,
      topOrganizers,
      topProjects,
      topKeywords,
      roomActionStats,
      actionSummary
    };
  }, [filteredBookings, rooms, bookings, backendStats, currentPeriodOption]);

  const {
    roomStats, totalAllMinutes, overallAvgMinutes, timeSlots, 
    dayOfWeekData, topOrganizers, topProjects, topKeywords, 
    roomActionStats, actionSummary
  } = data;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-[1200px] h-[90vh] bg-[#FDFDFD] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 lg:p-8 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
                  <BarChart3 className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-[#1A1A1A] tracking-tight">시스템 대시보드</h2>
                  <p className="text-[12px] font-bold text-slate-400 mt-0.5">회의실 사용 통계 및 고도화 분석</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative inline-block">
                  <select 
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as StatsPeriod)}
                    className="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-5 py-2.5 pr-12 text-[13px] font-black text-slate-600 focus:outline-none focus:ring-2 focus:ring-black/5 hover:border-slate-300 transition-all cursor-pointer shadow-sm"
                  >
                    {periodOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={14} />
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-100 rounded-2xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-hide">
              <div className="max-w-6xl mx-auto space-y-8">
                
                {/* 1. Global Metric Highlights */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <Users size={14}/> 방문 트래픽
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-black leading-none">{backendStats?.visitors?.[currentPeriodOption.backendKey] || 0}</span>
                      <span className="text-[12px] font-bold text-slate-400">명</span>
                    </div>
                  </div>

                   <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <Calendar size={14}/> 총 예약 현황
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-black leading-none">{filteredBookings.length}</span>
                      <span className="text-[14px] font-black text-slate-400 uppercase tracking-tighter">건 / {(totalAllMinutes / 60).toFixed(1)}시간</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <TrendingUp size={14}/> 생성 후 삭제율
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-black leading-none">{cancelRate}</span>
                      <span className="text-[12px] font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <Clock size={14}/> 평균 회의시간(건당)
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-black leading-none">{overallAvgMinutes}</span>
                      <span className="text-[12px] font-bold text-slate-400">분</span>
                    </div>
                  </div>
                </div>

                {/* 2. Main Middle Section: Peak Time & Detailed Table */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left: Peak Time Chart */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} className="opacity-70" />
                        시간대별 가동률 (Peak Time 분석)
                      </h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-bold">30분 단위</span>
                    </div>
                    
                    <div className="h-[280px] w-full bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeSlots} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1A1A1A" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#1A1A1A" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="time" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                            interval="preserveStartEnd"
                            minTickGap={30}
                          />
                          <YAxis 
                            allowDecimals={false}
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                          />
                          <Tooltip 
                            animationDuration={300}
                            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
                            content={<CustomTooltip />}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            name="예약 건수"
                            stroke="#1A1A1A" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                            animationDuration={500}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right: Pie Chart Preferences */}
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <PieChartIcon size={14} className="opacity-70" /> 회의실별 예약비중
                    </h3>
                    <div className="bg-white rounded-3xl border border-slate-100 flex items-center justify-center py-6 shadow-sm h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={roomStats.filter(r => r.totalMinutes > 0)}
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={8}
                            dataKey="totalMinutes"
                            nameKey="name"
                            stroke="none"
                            animationDuration={500}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = outerRadius * 1.15;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);

                              return (
                                <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="900">
                                  <tspan x={x} dy="-0.4em">{name}</tspan>
                                  <tspan x={x} dy="1.2em">{(percent * 100).toFixed(1)}%</tspan>
                                </text>
                              );
                            }}
                            labelLine={false}
                          >
                            {roomStats.filter(r => r.totalMinutes > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={syncRoomColor(entry.color)} />
                            ))}
                            <Label content={({ viewBox }: any) => {
                              const { cx, cy } = viewBox;
                              return (
                                <g>
                                  <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight={900} fill="#0f172a">
                                    {totalAllMinutes.toLocaleString()}분
                                  </text>
                                  <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={700} fill="#94a3b8">
                                    총 회의시간
                                  </text>
                                </g>
                              );
                            }} />
                          </Pie>
                          <Tooltip 
                            animationDuration={300}
                            content={<CustomTooltip mode="minutes" />}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

                {/* 3. Bottom Section: Specialized Insights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Insight 1: Day of Week Analysis */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                         <Calendar size={14} className="opacity-70" /> 요일별 예약 집중도
                      </h3>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button 
                          onClick={() => setDayOfWeekMode('count')}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-black rounded-md transition-all",
                            dayOfWeekMode === 'count' ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          건수
                        </button>
                        <button 
                          onClick={() => setDayOfWeekMode('minutes')}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-black rounded-md transition-all",
                            dayOfWeekMode === 'minutes' ? "bg-white text-black shadow-sm" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          시간
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-[160px] pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dayOfWeekData} margin={{ top: 20, right: 0, left: -30, bottom: 0 }}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                          <Tooltip 
                            animationDuration={300}
                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            content={<CustomTooltip mode={dayOfWeekMode} />}
                          />
                          {rooms.map((room) => {
                            const dataKey = dayOfWeekMode === 'count' ? room.name : `${room.name}_min`;
                            return (
                              <Bar 
                                key={room.id}
                                dataKey={dataKey} 
                                name={room.name}
                                stackId="a" 
                                radius={0}
                                fill={syncRoomColor(room.color)} 
                                animationDuration={500}
                              />
                            );
                          })}
                          <Line 
                            dataKey={dayOfWeekMode === 'count' ? 'total' : 'totalMinutes'} 
                            stroke="transparent" 
                            isAnimationActive={true} 
                            animationDuration={500} 
                            dot={false} 
                            activeDot={false}
                          >
                            <LabelList 
                              dataKey={dayOfWeekMode === 'count' ? 'total' : 'totalMinutes'} 
                              position="top" 
                              offset={10} 
                              fill="#64748b" 
                              fontSize={12} 
                              fontWeight={900} 
                              formatter={(val: number) => val > 0 ? (dayOfWeekMode === 'count' ? `${val}` : `${val}분`) : ''} 
                            />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Insight 2: Future Update - SameDay vs Advance */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white z-0"></div>
                    <div className="relative z-10 flex flex-col h-full">
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <Clock size={14} className="opacity-70" /> 당일 예약 vs 사전 예약
                      </h3>
                      
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3 text-slate-300">
                          <PieChartIcon size={20} />
                        </div>
                        <p className="text-[13px] font-black text-slate-600">데이터 수집 진행중</p>
                        <p className="text-[11px] font-medium text-slate-400 mt-1 leading-relaxed">
                          예약 생성 시점과 실제 예약 시작 시간 사이의 간격 분석 데이터가 축적되고 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Insight 3: Detailed Table */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-4">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 size={14} className="opacity-70" />
                      활동 상세 및 선호도
                    </h3>
                    
                    <div className="overflow-hidden flex flex-col flex-1 -mx-6 -mb-6 shadow-[inset_0_1px_0_0_rgba(241,245,249,1)]">
                      <div className="overflow-y-auto flex-1 scrollbar-hide">
                        <table className="w-full text-left text-[11px]">
                          <thead className="sticky top-0 bg-[#F9F9F9] z-10">
                            <tr className="text-slate-400 font-extrabold tracking-widest uppercase border-b border-slate-100">
                              <th className="px-5 py-3 w-[40%] text-left">회의실</th>
                              <th className="px-4 py-3 w-[25%] text-center">건수</th>
                              <th className="px-5 py-3 w-[35%] text-right">평균소요</th>
                            </tr>
                          </thead>
                          <tbody className="font-bold text-slate-700 divide-y divide-slate-50">
                            {roomStats.map((r, i) => (
                              <tr key={r.id} className="bg-white hover:bg-slate-50 transition-colors group">
                                <td className="px-5 py-3 w-[40%]">
                                  <div className="flex items-center gap-2 text-black font-black">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: syncRoomColor(r.color) }} />
                                    <span className="truncate">{r.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 w-[25%] text-center text-black font-black">{r.count}건</td>
                                <td className="px-5 py-3 w-[35%] text-right font-black">{r.avgMinutes.toLocaleString()}분</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0 z-10 font-black text-[11px] text-black shadow-[0_-2px_4px_rgba(0,0,0,0.02)]">
                            <tr>
                              <td className="px-5 py-3 w-[40%] text-slate-500 uppercase tracking-tighter">합계 / 전체평균</td>
                              <td className="px-4 py-3 w-[25%] text-center text-slate-900">{filteredBookings.length}건</td>
                              <td className="px-5 py-3 w-[35%] text-right text-slate-900">{overallAvgMinutes.toLocaleString()}분</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>

                </div>

                {/* 4. Bottom Keyword & Request Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                  
                  {/* Top Organizers / Projects */}
                  <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-6">
                    <div>
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Users size={14} className="opacity-70" /> 예약자 TOP 3 (건수/비중)
                      </h3>
                      <div className="space-y-3">
                        {topOrganizers.map((org, i) => (
                          <div key={org.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] bg-slate-900 text-white w-5 h-5 rounded-md flex items-center justify-center font-black">{i+1}</span>
                              <span className="text-[13px] font-black text-slate-700">{org.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-[12px] font-black text-black">{org.count}건</div>
                              <div className="text-[10px] font-bold text-slate-400">{org.percent.toFixed(1)}%</div>
                            </div>
                          </div>
                        ))}
                        {topOrganizers.length === 0 && <p className="text-[11px] text-slate-300 font-bold py-2">데이터 없음</p>}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50">
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Hash size={14} className="opacity-70" /> 프로젝트 TOP 3 (건수/비중)
                      </h3>
                      <div className="space-y-3">
                        {topProjects.map((prj, i) => (
                          <div key={prj.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] bg-slate-100 text-slate-400 w-5 h-5 rounded-md flex items-center justify-center font-black">{i+1}</span>
                              <span className="text-[13px] font-black text-slate-700">{prj.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-[12px] font-black text-black">{prj.count}건</div>
                              <div className="text-[10px] font-bold text-slate-400">{prj.percent.toFixed(1)}%</div>
                            </div>
                          </div>
                        ))}
                        {topProjects.length === 0 && <p className="text-[11px] text-slate-300 font-bold py-2">데이터 없음</p>}
                      </div>
                    </div>
                  </div>

                  {/* Keyword Analysis */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-4">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Hash size={14} className="opacity-70" /> 회의내용 성격 분석
                    </h3>
                    <div className="flex-1 flex flex-wrap gap-2 content-start pt-2">
                       {topKeywords.map(([word, count]) => (
                         <div key={word} className="bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl flex items-center gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:translate-y-[-2px] hover:bg-black group transition-all cursor-default">
                           <span className="text-[12px] font-black text-slate-700 group-hover:text-white">{word}</span>
                           <span className="text-[10px] font-black bg-white text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-100 group-hover:bg-slate-800 group-hover:text-slate-300 group-hover:border-transparent">{count}</span>
                         </div>
                       ))}
                       {topKeywords.length === 0 && (
                         <div className="flex-1 flex items-center justify-center text-slate-300 text-[11px] font-bold py-10">데이터 부족으로 분석 대기 중</div>
                       )}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <p className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Analysis Insight</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic">
                        전체 회의 예약의 <span className="text-black">설명(Description)</span> 텍스트 데이터를 분석한 결과, 
                        현재 예약들은 주로 <span className="text-blue-600">"{topKeywords[0]?.[0] || '특정 주제'}"</span> 및 
                        <span className="text-blue-600">"{topKeywords[1]?.[0] || '현안'}"</span> 키워드와 높은 상관관계를 보이고 있습니다.
                      </p>
                    </div>
                  </div>

                  {/* Request Stats Table */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col space-y-4">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={14} className="opacity-70" /> 회의실별 요청 현황
                    </h3>
                    
                    <div className="flex-1 overflow-hidden flex flex-col -mx-6 -mb-6 shadow-[inset_0_1px_0_0_rgba(241,245,249,1)]">
                      <div className="overflow-y-auto flex-1 scrollbar-hide">
                        <table className="w-full text-left text-[11px]">
                          <thead className="sticky top-0 bg-[#F9F9F9] z-10">
                            <tr className="text-slate-400 font-extrabold tracking-widest uppercase border-b border-slate-100">
                              <th className="px-5 py-3 w-[30%]">회의실</th>
                              <th className="px-2 py-3 w-[15%] text-center">작성</th>
                              <th className="px-2 py-3 w-[15%] text-center">수정</th>
                              <th className="px-2 py-3 w-[15%] text-center">삭제</th>
                              <th className="px-5 py-3 w-[25%] text-right">합계</th>
                            </tr>
                          </thead>
                          <tbody className="font-bold text-slate-700 divide-y divide-slate-50">
                            {roomActionStats.map((rs, i) => (
                              <tr key={rs.name} className="bg-white hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 w-[30%] text-black font-black truncate">{rs.name}</td>
                                <td className="px-2 py-3 w-[15%] text-center">{rs.create.toLocaleString()}</td>
                                <td className="px-2 py-3 w-[15%] text-center">{rs.update.toLocaleString()}</td>
                                <td className="px-2 py-3 w-[15%] text-center text-slate-400">{rs.del.toLocaleString()}</td>
                                <td className="px-5 py-3 w-[25%] text-right font-black text-black">{rs.total.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 border-t border-slate-100 sticky bottom-0 z-10 font-black text-[11px] text-black shadow-[0_-1px_0_0_rgba(241,245,249,1)]">
                            <tr>
                              <td className="px-5 py-3 w-[30%] text-slate-500 uppercase">Total</td>
                              <td className="px-2 py-3 w-[15%] text-center">{actionSummary.create.toLocaleString()}</td>
                              <td className="px-2 py-3 w-[15%] text-center">{actionSummary.update.toLocaleString()}</td>
                              <td className="px-2 py-3 w-[15%] text-center text-slate-400">{actionSummary.del.toLocaleString()}</td>
                              <td className="px-5 py-3 w-[25%] text-right text-[12px]">{actionSummary.total.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
            
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

