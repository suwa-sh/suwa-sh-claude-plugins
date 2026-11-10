// 画面部品の入口。packages/ui の main / module / types はこのファイルを指す。
// 部品の実体 (*.stories.tsx を除く) と、domain の型・値を再輸出する。
// 部品を足したら、ここにも 1 行足す。

// 共通部品
export * from './components/ui/Alert';
export * from './components/ui/Badge';
export * from './components/ui/Button';
export * from './components/ui/Card';
export * from './components/ui/Icon';
export * from './components/ui/Input';
export * from './components/ui/Select';
export * from './components/ui/Skeleton';

// レイアウト
export * from './components/layout/AppShell';

// ドメイン部品
export * from './components/domain/AvailabilityBadge';
export * from './components/domain/AvailabilitySearchForm';
export * from './components/domain/BusinessErrorAlert';
export * from './components/domain/CancelConfirmPanel';
export * from './components/domain/MyReservationList';
export * from './components/domain/ReservationForm';
export * from './components/domain/ReservationStatusBadge';
export * from './components/domain/ReservationSummary';
export * from './components/domain/RoomAvailabilityList';
export * from './components/domain/TimeSlotPicker';

// ドメインの型と値
export * from './components/domain/types';
export * from './components/domain/errorMessages';
export * from './components/domain/timeSlots';
export * from './components/domain/timeFieldErrors';
