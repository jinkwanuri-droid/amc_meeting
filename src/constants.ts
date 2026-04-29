import { Room } from "./types";

export const START_HOUR = 7;
export const END_HOUR = 18;

export const ROOMS: Room[] = [
  { id: "room-1", name: "대회의실 (Large)", capacity: 20 },
  { id: "room-2", name: "중회의실 A (Medium A)", capacity: 10 },
  { id: "room-3", name: "중회의실 B (Medium B)", capacity: 10 },
  { id: "room-4", name: "소회의실 (Small)", capacity: 4 },
];

export const ROOM_THEME_COLORS = [
  'bg-[#4A5568]', // Slate Cloud
  'bg-[#2D3748]', // Deep Navy
  'bg-[#718096]', // Cool Grey
  'bg-[#4299E1]', // Soft Blue
  'bg-[#48BB78]', // Sage Green
  'bg-[#ECC94B]', // Muted Gold
  'bg-[#ED8936]', // Soft Orange
  'bg-[#F56565]', // Dusty Rose
  'bg-[#9F7AEA]', // Muted Lavender
  'bg-[#667EEA]'  // Denim Blue
];

export const BOOKING_COLORS = [
  "bg-blue-50 text-blue-800 border-l-2 border-blue-500 rounded-sm shadow-sm",
  "bg-orange-50 text-orange-800 border-l-2 border-orange-400 rounded-sm shadow-sm",
  "bg-emerald-50 text-emerald-800 border-l-2 border-emerald-500 rounded-sm shadow-sm",
  "bg-purple-50 text-purple-800 border-l-2 border-purple-500 rounded-sm shadow-sm",
  "bg-rose-50 text-rose-800 border-l-2 border-rose-500 rounded-sm shadow-sm",
  "bg-indigo-50 text-indigo-800 border-l-2 border-indigo-500 rounded-sm shadow-sm",
];
