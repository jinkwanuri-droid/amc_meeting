import React from 'react';
import { X, Plus, Trash2, MapPin, Calendar, GripVertical, Check, Pencil, ChevronDown } from 'lucide-react';
import { Room, Holiday } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ROOM_THEME_COLORS } from '../constants';
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
      {isEditMode && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors pl-1 shrink-0">
          <GripVertical size={14} />
        </div>
      )}
      
      <div className="flex-1 flex items-center gap-3 pl-1 min-w-0">
        <input 
          disabled={!isEditMode}
          type="text" 
          placeholder="Room Name"
          className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[13px] font-bold placeholder:text-slate-200 disabled:text-slate-700 truncate"
          value={room.name}
          onChange={(e) => onUpdate(room.id, { name: e.target.value })}
        />
        
        <div className="flex items-center gap-2 shrink-0">
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
            className={`w-5 h-5 rounded-full ${room.color || 'bg-slate-200'} transition-all flex items-center justify-center hover:scale-105 disabled:hover:scale-100`}
          >
            {isEditMode && <ChevronDown size={10} className="text-white drop-shadow-sm" />}
          </button>

          <AnimatePresence>
            {isColorPickerOpen && isEditMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 p-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 grid grid-cols-5 gap-1.5 w-[140px]"
              >
                {ROOM_THEME_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onUpdate(room.id, { color });
                      setIsColorPickerOpen(false);
                    }}
                    className={`w-5 h-5 rounded-full ${color} transition-all relative hover:scale-110 flex items-center justify-center`}
                  >
                    {room.color === color && <Check size={8} className="text-white" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isEditMode && (
        <button 
          onClick={() => onRemove(room.id)}
          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  holidays: Holiday[];
  onUpdateRooms: (rooms: Room[]) => void;
  onUpdateHolidays: (holidays: Holiday[]) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  rooms,
  holidays,
  onUpdateRooms,
  onUpdateHolidays
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = React.useState<'rooms' | 'holidays'>('rooms');
  const [isEditMode, setIsEditMode] = React.useState(false);

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
      const oldIndex = rooms.findIndex((r) => r.id === active.id);
      const newIndex = rooms.findIndex((r) => r.id === over.id);
      onUpdateRooms(arrayMove(rooms, oldIndex, newIndex));
    }
  };

  const addRoom = () => {
    const newRoom: Room = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      capacity: 4,
      color: ROOM_THEME_COLORS[0]
    };
    onUpdateRooms([newRoom, ...rooms]); // Prepend new items
  };

  const removeRoom = (id: string) => {
    onUpdateRooms(rooms.filter(r => r.id !== id));
  };

  const updateRoom = (id: string, updates: Partial<Room>) => {
    onUpdateRooms(rooms.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const updateHoliday = (id: string, updates: Partial<Holiday>) => {
    onUpdateHolidays(holidays.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const addHoliday = () => {
    const newHoliday: Holiday = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      date: new Date(),
      isCustom: true
    };
    onUpdateHolidays([newHoliday, ...holidays]); // Prepend new items
  };

  const removeHoliday = (id: string) => {
    onUpdateHolidays(holidays.filter(h => h.id !== id));
  };

  const customHolidays = holidays.filter(h => h.isCustom);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="bg-white rounded-3xl w-full max-w-xl h-[500px] flex overflow-hidden border border-[#E5E5E5] shadow-2xl"
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
            <div className="mt-auto">
                <button 
                onClick={onClose}
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
                {activeTab === 'rooms' ? '회의실 관리' : '공휴일 관리'}
              </h2>
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <button 
                      onClick={activeTab === 'rooms' ? addRoom : addHoliday}
                      className="p-1.5 bg-black text-white rounded-full hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                      title="Add New"
                    >
                      <Plus size={15} strokeWidth={3} />
                    </button>
                    <button 
                      onClick={() => setIsEditMode(false)}
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
                    items={rooms.map(r => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {rooms.map(room => (
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
              ) : (
                customHolidays.map(holiday => (
                  <div key={holiday.id} className="flex items-center gap-3 px-3 bg-white rounded-xl border border-slate-100 shadow-sm h-11 group">
                    <input 
                      disabled={!isEditMode}
                      type="text" 
                      placeholder="Holiday Name"
                      className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[13px] font-bold placeholder:text-slate-200 disabled:text-slate-700"
                      value={holiday.name}
                      onChange={(e) => updateHoliday(holiday.id, { name: e.target.value })}
                    />
                    <input 
                      disabled={!isEditMode}
                      type="date" 
                      className="bg-transparent border-none focus:ring-0 p-0 text-[11px] font-bold text-slate-400 disabled:opacity-50"
                      value={format(holiday.date, 'yyyy-MM-dd')}
                      onChange={(e) => updateHoliday(holiday.id, { date: new Date(e.target.value) })}
                    />
                    {isEditMode && (
                      <button 
                        onClick={() => removeHoliday(holiday.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))
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
      </div>
    </AnimatePresence>
  );
}
