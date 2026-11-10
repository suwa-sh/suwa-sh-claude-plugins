import type {
  ReservationView,
  Room,
  RoomAvailabilityItem,
  TimeSlotValue,
} from '../components/domain/types';

/**
 * 見本のデータ (会議室 5 部屋)。
 * 会議室の ID・名前・並び順は要求と API 契約の初期データ (room-1〜room-5 = 会議室A〜会議室E、表示順 1〜5) に合わせる。
 * 契約に収容人数が無いので、名前に収容人数を含めない。
 */
export const sampleRooms: Room[] = [
  { roomId: 'room-1', name: '会議室A' },
  { roomId: 'room-2', name: '会議室B' },
  { roomId: 'room-3', name: '会議室C' },
  { roomId: 'room-4', name: '会議室D' },
  { roomId: 'room-5', name: '会議室E' },
];

export const sampleSlot: TimeSlotValue = {
  date: '2026-11-05',
  startTime: '10:00',
  endTime: '11:00',
};

export const sampleAvailability: RoomAvailabilityItem[] = [
  { roomId: 'room-1', roomName: '会議室A', availability: 'available' },
  { roomId: 'room-2', roomName: '会議室B', availability: 'reserved' },
  { roomId: 'room-3', roomName: '会議室C', availability: 'available' },
  { roomId: 'room-4', roomName: '会議室D', availability: 'reserved' },
  { roomId: 'room-5', roomName: '会議室E', availability: 'available' },
];

export const sampleMyReservations: ReservationView[] = [
  {
    reservationId: '3f2a9c1e-0000-4000-8000-000000000001',
    roomName: '会議室A',
    date: '2026-11-05',
    startTime: '10:00',
    endTime: '11:00',
    status: 'reserved',
  },
  {
    reservationId: '3f2a9c1e-0000-4000-8000-000000000002',
    roomName: '会議室C',
    date: '2026-11-06',
    startTime: '13:30',
    endTime: '15:00',
    status: 'reserved',
  },
  {
    reservationId: '3f2a9c1e-0000-4000-8000-000000000003',
    roomName: '会議室E',
    date: '2026-11-10',
    startTime: '09:00',
    endTime: '09:30',
    status: 'reserved',
  },
];

export const sampleUserName = '山田 花子';
