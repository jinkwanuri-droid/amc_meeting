export interface Booking {
  id: string;
  title: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  organizer: string;
  description?: string;
  color: string;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  color?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: Date;
  isCustom?: boolean;
}
