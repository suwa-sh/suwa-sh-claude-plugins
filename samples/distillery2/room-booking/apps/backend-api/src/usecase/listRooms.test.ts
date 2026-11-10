import { describe, expect, it } from 'vitest';
import { createListRooms } from './listRooms';

describe('会議室を一覧する', () => {
  it('会議室がある場合_記録先の表示順のまま全会議室を返すこと', async () => {
    // Arrange
    const rooms = [
      { roomId: 'room-2', name: '会議室B' },
      { roomId: 'room-1', name: '会議室A' },
    ];
    const uc = createListRooms({ repository: { listRooms: async () => rooms } });

    // Act
    const result = await uc.execute();

    // Assert
    expect(result).toEqual({ rooms });
  });
});
