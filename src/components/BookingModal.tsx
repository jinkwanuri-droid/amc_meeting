import React from 'react';
import { 
  format, 
  setHours, 
  setMinutes, 
  addMinutes,
  isBefore,
  isAfter,
  isEqual,
  startOfDay
} from 'date-fns';
import { X, Calendar, Clock, User, MessageSquare, Trash2, MapPin, Pencil, Check, ChevronDown } from 'lucide-react';
import { Booking, Room } from '../types';
import { ROOMS, BOOKING_COLORS, START_HOUR, END_HOUR } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (booking: Omit<Booking, 'id'> & { id?: string }) => Promise<{ success: boolean; message?: string } | void>;
  onDelete?: (id: string) => void;
  initialBooking?: Partial<Booking>;
  selectedDate: Date;
  rooms: Room[];
}

export default function BookingModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialBooking,
  selectedDate,
  rooms
}: BookingModalProps) {
  const [isEditing, setIsEditing] = React.useState(!initialBooking?.id);
  const [title, setTitle] = React.useState(initialBooking?.title || '');
  const [roomId, setRoomId] = React.useState(initialBooking?.roomId || (rooms.length > 0 ? rooms[0].id : ''));
  const [organizer, setOrganizer] = React.useState(initialBooking?.organizer || '');
  const [description, setDescription] = React.useState(initialBooking?.description || '');
  const [startTime, setStartTime] = React.useState(
    format(initialBooking?.startTime || setHours(setMinutes(selectedDate, 0), START_HOUR), 'HH:mm')
  );
  const [endTime, setEndTime] = React.useState(
    format(initialBooking?.endTime || setHours(setMinutes(selectedDate, 0), START_HOUR + 1), 'HH:mm')
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
  const [isStartTimeOpen, setIsStartTimeOpen] = React.useState(false);
  const [isEndTimeOpen, setIsEndTimeOpen] = React.useState(false);
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = React.useState(false);
  const startTimeRef = React.useRef<HTMLDivElement>(null);
  const endTimeRef = React.useRef<HTMLDivElement>(null);
  const roomDropdownRef = React.useRef<HTMLDivElement>(null);
  const startTimeListRef = React.useRef<HTMLDivElement>(null);
  const endTimeListRef = React.useRef<HTMLDivElement>(null);

  // Scroll active time into view
  React.useEffect(() => {
    if (isStartTimeOpen && startTimeListRef.current) {
      setTimeout(() => {
        const activeItem = startTimeListRef.current?.querySelector('[data-selected="true"]');
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      }, 0);
    }
  }, [isStartTimeOpen]);

  React.useEffect(() => {
    if (isEndTimeOpen && endTimeListRef.current) {
      setTimeout(() => {
        const activeItem = endTimeListRef.current?.querySelector('[data-selected="true"]');
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      }, 0);
    }
  }, [isEndTimeOpen]);

  React.useEffect(() => {
    if (initialBooking) {
      setTitle(initialBooking.title || '');
      setRoomId(initialBooking.roomId || (rooms.length > 0 ? rooms[0].id : ''));
      setOrganizer(initialBooking.organizer || '');
      setDescription(initialBooking.description || '');
      setStartTime(format(initialBooking.startTime || setHours(setMinutes(selectedDate, 0), START_HOUR), 'HH:mm'));
      setEndTime(format(initialBooking.endTime || setHours(setMinutes(selectedDate, 0), START_HOUR + 1), 'HH:mm'));
      setIsEditing(!initialBooking.id);
      setIsConfirmingDelete(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [initialBooking, selectedDate, isOpen, rooms]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startTimeRef.current && !startTimeRef.current.contains(event.target as Node)) {
        setIsStartTimeOpen(false);
      }
      if (endTimeRef.current && !endTimeRef.current.contains(event.target as Node)) {
        setIsEndTimeOpen(false);
      }
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target as Node)) {
        setIsRoomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDeleteClick = () => {
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    if (initialBooking?.id) {
      onDelete?.(initialBooking.id);
      setIsConfirmingDelete(false);
      onClose();
    }
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      // Submit logic if toggling OFF from edit mode
      const form = document.getElementById('booking-form') as HTMLFormElement;
      if (form) form.requestSubmit();
    } else {
      setIsEditing(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const baseDate = initialBooking?.startTime ? startOfDay(initialBooking.startTime) : startOfDay(selectedDate);
      const start = setHours(setMinutes(baseDate, startM), startH);
      const end = setHours(setMinutes(baseDate, endM), endH);

      if (isBefore(end, start) || isEqual(end, start)) {
        setError("종료 시간은 시작 시간보다 늦어야 합니다.");
        setIsSubmitting(false);
        return;
      }

      const selectedRoom = rooms.find(r => r.id === roomId);
      let bookingColor = initialBooking?.color;
      
      if (!bookingColor) {
        if (selectedRoom?.color) {
          const baseColor = selectedRoom.color.split('-')[1];
          bookingColor = `bg-${baseColor}-50 text-${baseColor}-800 border-l-2 border-${baseColor}-500 rounded-sm shadow-sm`;
        } else {
          bookingColor = BOOKING_COLORS[Math.floor(Math.random() * BOOKING_COLORS.length)];
        }
      }

      const result = await onSubmit({
        id: initialBooking?.id,
        title,
        roomId,
        startTime: start,
        endTime: end,
        organizer,
        description,
        color: bookingColor
      });

      if (result && !result.success) {
        setError(result.message || "저장 중 오류가 발생했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeOptions = [];
  for (let h = START_HOUR; h <= END_HOUR + 2; h++) {
    timeOptions.push(`${String(h).padStart(2, '0')}:00`);
    timeOptions.push(`${String(h).padStart(2, '0')}:30`);
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative bg-white rounded-2xl w-full max-w-sm border border-[#E5E5E5] shadow-2xl shadow-black/10"
        >
          {isConfirmingDelete && (
            <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h4 className="text-[15px] font-bold text-gray-900 mb-1">예약 삭제</h4>
              <p className="text-sm font-medium text-gray-500 mb-6">정말 이 예약을 삭제하시겠습니까?</p>
              <div className="flex items-center gap-3 w-full">
                <button 
                  type="button"
                  onClick={handleCancelDelete}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all"
                >
                  취소
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 px-4 bg-[#ff6b6b] hover:bg-[#ff5252] text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-rose-500/20"
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] bg-gray-50/50 rounded-t-2xl">
            <h3 className="text-base font-bold text-[#1A1A1A] tracking-tight">
              {initialBooking?.id ? (isEditing ? '예약 수정' : '예약 상세') : '새 예약'}
            </h3>
            <div className="flex items-center gap-1">
              {initialBooking?.id ? (
                <>
                  {!isEditing && (
                    <button 
                      onClick={handleDeleteClick}
                      type="button"
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button 
                    onClick={handleToggleEdit}
                    type="button"
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      isEditing ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-black hover:bg-gray-100"
                    )}
                    title={isEditing ? "Complete" : "Edit"}
                  >
                    {isEditing ? <Check size={16} /> : <Pencil size={16} />}
                  </button>
                </>
              ) : (
                <button 
                  onClick={onClose}
                  type="button"
                  className="p-2 text-slate-400 hover:text-black transition-all ml-1"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          <form id="booking-form" onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center text-[#ff6b6b]"
              >
                <div className="text-[12px] font-bold leading-tight whitespace-pre-wrap text-center">{error}</div>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-widest pl-1">
                회의 제목
              </label>
              <input
                disabled={!isEditing}
                autoFocus
                required
                type="text"
                placeholder="회의 제목을 입력하세요"
                className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-black transition-all text-sm font-bold text-[#1A1A1A] placeholder:text-gray-300 disabled:text-slate-700 disabled:opacity-80"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-widest pl-1">
                  장소
                </label>
                <div className="relative" ref={roomDropdownRef}>
                  <button
                    type="button"
                    disabled={!isEditing}
                    onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                    className={cn(
                      "w-full px-4 py-3 bg-[#F9F9F9] border rounded-lg focus:outline-none transition-all text-sm font-bold text-[#1A1A1A] flex items-center justify-between",
                      isRoomDropdownOpen ? "border-black bg-white" : "border-[#E5E5E5]",
                      !isEditing && "opacity-100 cursor-not-allowed text-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]",
                        rooms.find(r => r.id === roomId)?.color || 'bg-slate-300'
                      )} />
                      <span className="truncate">
                        {rooms.find(r => r.id === roomId)?.name || '삭제된 회의실'}
                      </span>
                    </div>
                    {isEditing && (
                      <ChevronDown size={16} className={cn(
                        "text-gray-400 transition-transform",
                        isRoomDropdownOpen && "rotate-180"
                      )} />
                    )}
                  </button>

                  <AnimatePresence>
                    {isRoomDropdownOpen && isEditing && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-2 bg-white border border-[#E5E5E5] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden py-1 max-h-60 overflow-y-auto"
                      >
                        {rooms.map(room => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => {
                              setRoomId(room.id);
                              setIsRoomDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 text-left text-[13px] font-bold hover:bg-gray-50 flex items-center gap-3 transition-colors",
                              roomId === room.id ? "bg-gray-50 text-black" : "text-gray-600"
                            )}
                          >
                            <div className={cn("w-3 h-3 rounded-full shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]", room.color)} />
                            <span>{room.name}</span>
                            {roomId === room.id && <Check size={14} className="ml-auto text-black" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-widest pl-1">
                  예약자
                </label>
                <input
                  disabled={!isEditing}
                  required
                  type="text"
                  placeholder="예약자 성함"
                  className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-black transition-all text-xs font-bold text-[#1A1A1A] placeholder:text-gray-300 disabled:text-slate-700 disabled:opacity-80"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-widest pl-1">
                예약 시간
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1" ref={startTimeRef}>
                  <button
                    type="button"
                    disabled={!isEditing}
                    onClick={() => setIsStartTimeOpen(!isStartTimeOpen)}
                    className={cn(
                      "w-full px-4 py-3 bg-[#F9F9F9] border rounded-xl transition-all text-sm font-bold text-center text-[#1A1A1A] disabled:opacity-80 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                      isStartTimeOpen ? "border-black ring-2 ring-black/5" : "border-[#E5E5E5] hover:border-black/20"
                    )}
                  >
                    {startTime}
                  </button>
                  
                  <AnimatePresence>
                    {isStartTimeOpen && isEditing && (
                      <motion.div
                        ref={startTimeListRef}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute left-0 bottom-full mb-2 w-full max-h-[220px] overflow-y-auto bg-white border border-[#E5E5E5] rounded-xl shadow-xl shadow-black/5 z-50 py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full"
                      >
                        {timeOptions.map(time => (
                          <button
                            key={`start-${time}`}
                            type="button"
                            data-selected={startTime === time}
                            onClick={() => {
                              setStartTime(time);
                              setIsStartTimeOpen(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 text-[13px] text-center transition-colors hover:bg-gray-50",
                              startTime === time ? "font-bold text-black bg-gray-50/50" : "font-medium text-gray-500"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="text-gray-300 font-bold shrink-0 flex items-center justify-center w-4 text-[12px]">→</div>
                <div className="relative flex-1" ref={endTimeRef}>
                  <button
                    type="button"
                    disabled={!isEditing}
                    onClick={() => setIsEndTimeOpen(!isEndTimeOpen)}
                    className={cn(
                      "w-full px-4 py-3 bg-[#F9F9F9] border rounded-xl transition-all text-sm font-bold text-center text-[#1A1A1A] disabled:opacity-80 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                      isEndTimeOpen ? "border-black ring-2 ring-black/5" : "border-[#E5E5E5] hover:border-black/20"
                    )}
                  >
                    {endTime}
                  </button>
                  
                  <AnimatePresence>
                    {isEndTimeOpen && isEditing && (
                      <motion.div
                        ref={endTimeListRef}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute left-0 bottom-full mb-2 w-full max-h-[220px] overflow-y-auto bg-white border border-[#E5E5E5] rounded-xl shadow-xl shadow-black/5 z-50 py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full"
                      >
                        {timeOptions.map(time => (
                          <button
                            key={`end-${time}`}
                            type="button"
                            data-selected={endTime === time}
                            onClick={() => {
                              setEndTime(time);
                              setIsEndTimeOpen(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 text-[13px] text-center transition-colors hover:bg-gray-50",
                              endTime === time ? "font-bold text-black bg-gray-50/50" : "font-medium text-gray-500"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#F0F0F0]">
              {!initialBooking?.id ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-black text-white rounded-xl py-3.5 px-6 text-[13px] font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isSubmitting ? '저장 중...' : '예약 완료'}</span>
                </button>
              ) : (
                <button
                  type={isEditing ? "submit" : "button"}
                  disabled={isSubmitting}
                  onClick={isEditing ? undefined : onClose}
                  className={cn(
                    "w-full rounded-xl py-3.5 px-6 text-[13px] font-bold transition-all active:scale-[0.98] border flex items-center justify-center gap-2",
                    isSubmitting && "opacity-50 cursor-not-allowed",
                    isEditing 
                      ? "bg-black text-white border-black hover:bg-zinc-800" 
                      : "bg-white border-[#E5E5E5] text-slate-600 hover:bg-gray-50 hover:text-black"
                  )}
                >
                  {isSubmitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{isEditing ? (isSubmitting ? '저장 중...' : '적용 및 닫기') : '닫기'}</span>
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
