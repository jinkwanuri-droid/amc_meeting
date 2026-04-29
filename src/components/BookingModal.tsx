import React from 'react';
import { 
  format, 
  setHours, 
  setMinutes, 
  addMinutes,
  isBefore,
  isAfter,
  isEqual
} from 'date-fns';
import { X, Calendar, Clock, User, MessageSquare, Trash2, MapPin, Pencil, Check } from 'lucide-react';
import { Booking, Room } from '../types';
import { ROOMS, BOOKING_COLORS, START_HOUR, END_HOUR } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (booking: Omit<Booking, 'id'> & { id?: string }) => void;
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

  React.useEffect(() => {
    if (initialBooking) {
      setTitle(initialBooking.title || '');
      setRoomId(initialBooking.roomId || (rooms.length > 0 ? rooms[0].id : ''));
      setOrganizer(initialBooking.organizer || '');
      setDescription(initialBooking.description || '');
      setStartTime(format(initialBooking.startTime || setHours(setMinutes(selectedDate, 0), START_HOUR), 'HH:mm'));
      setEndTime(format(initialBooking.endTime || setHours(setMinutes(selectedDate, 0), START_HOUR + 1), 'HH:mm'));
      setIsEditing(!initialBooking.id);
    }
  }, [initialBooking, selectedDate, isOpen, rooms]);

  if (!isOpen) return null;

  const handleDelete = () => {
    if (initialBooking?.id && confirm("삭제 하시겠습니까?")) {
      onDelete?.(initialBooking.id);
    }
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      // Submit logic if toggling OFF from edit mode
      document.getElementById('booking-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    } else {
      setIsEditing(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    const start = setHours(setMinutes(new Date(selectedDate), startM), startH);
    const end = setHours(setMinutes(new Date(selectedDate), endM), endH);

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

    onSubmit({
      id: initialBooking?.id,
      title,
      roomId,
      startTime: start,
      endTime: end,
      organizer,
      description,
      color: bookingColor
    });
  };

  const timeOptions = [];
  for (let h = START_HOUR; h <= END_HOUR + 2; h++) {
    timeOptions.push(`${String(h).padStart(2, '0')}:00`);
    timeOptions.push(`${String(h).padStart(2, '0')}:30`);
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="bg-white rounded-2xl w-full max-w-sm overflow-hidden border border-[#E5E5E5] shadow-2xl shadow-black/10"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] bg-gray-50/50">
            <h3 className="text-sm font-bold text-[#1A1A1A] tracking-tight">
              {initialBooking?.id ? (isEditing ? '예약 수정' : '예약 상세') : '새 예약'}
            </h3>
            <div className="flex items-center gap-1">
              {initialBooking?.id ? (
                <>
                  {!isEditing && (
                    <button 
                      onClick={handleDelete}
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
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
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
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                  장소
                </label>
                <div className="relative">
                  <select
                    disabled={!isEditing}
                    className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-black transition-all text-xs font-bold text-[#1A1A1A] appearance-none disabled:opacity-100"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                  >
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                  <div className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none transition-all",
                    rooms.find(r => r.id === roomId)?.color || 'bg-slate-300'
                  )} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                  시작 시간
                </label>
                <select
                  disabled={!isEditing}
                  className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-black transition-all text-xs font-bold text-[#1A1A1A] disabled:opacity-100 appearance-none"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                >
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                  종료 시간
                </label>
                <select
                  disabled={!isEditing}
                  className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-black transition-all text-xs font-bold text-[#1A1A1A] disabled:opacity-100 appearance-none"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                >
                  {timeOptions.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-[#F0F0F0]">
              {!initialBooking?.id ? (
                <button
                  type="submit"
                  className="w-full bg-black text-white rounded-xl py-3.5 px-6 text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-[0.98]"
                >
                  예약 완료
                </button>
              ) : (
                <button
                  type="button"
                  onClick={isEditing ? handleToggleEdit : onClose}
                  className={cn(
                    "w-full rounded-xl py-3.5 px-6 text-xs font-bold transition-all active:scale-[0.98] border",
                    isEditing 
                      ? "bg-black text-white border-black hover:bg-zinc-800" 
                      : "bg-white border-[#E5E5E5] text-slate-600 hover:bg-gray-50 hover:text-black"
                  )}
                >
                  {isEditing ? '적용 및 닫기' : '닫기'}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
