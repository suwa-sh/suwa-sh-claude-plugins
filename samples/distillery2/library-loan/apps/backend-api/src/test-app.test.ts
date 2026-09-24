import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from './test-app';
import { CONTRACT_FIXTURE_IDS as IDS } from './testing/contract-fixture';

describe('テスト用 composition root', () => {
  it('createTestApp_在庫ありの書籍を貸し出す場合_契約の201例と同じ返却期限で応答すること', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await request(app).post('/loans').send({ patronNumber: IDS.activePatron, bookId: IDS.availableBookId });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      bookId: IDS.availableBookId,
      patronNumber: 'P000123',
      loanedOn: '2026-10-01',
      loanPeriodDays: 14,
      dueOn: '2026-10-15',
      status: 'on_loan',
      pickedUpReservationId: null,
    });
  });

  it('createTestApp_利用者ロールのトークンの場合_403 を返し貸出を記録しないこと', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await request(app)
      .post('/loans')
      .set('authorization', 'Bearer test-patron:P000123')
      .send({ patronNumber: IDS.activePatron, bookId: IDS.availableBookId });

    // Assert
    expect(res.status).toBe(403);
    const loans = await app.db.query(`SELECT 1 FROM loans WHERE patron_number = 'P000123'`);
    expect(loans.rows).toHaveLength(0);
  });

  it('createTestApp_取置の書籍を他の利用者に貸し出そうとした場合_取置の理由で409を返すこと', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await request(app).post('/loans').send({ patronNumber: 'P000456', bookId: IDS.heldBookId });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('book-on-hold-for-another-patron');
  });

  it('createTestApp_ヘッダなしを未認証に切り替えた場合_401 を返すこと', async () => {
    // Arrange
    const app = createTestApp();
    app.auth.setDefaultPrincipal(null);

    // Act
    const res = await request(app).post('/loans').send({ patronNumber: IDS.activePatron, bookId: IDS.availableBookId });

    // Assert
    expect(res.status).toBe(401);
  });
});
