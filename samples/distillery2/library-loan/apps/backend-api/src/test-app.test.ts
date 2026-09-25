/**
 * createLoan (POST /loans) を composition root 経由で通す (presentation の入力検証・エラー変換と、
 * 要求どおりの状態変化を確かめる)。DB は createTestApp が起動する pglite。
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FixedClock } from './gateway/clock';
import { fixtureIds, fixturePatronNumbers } from './testing/contractFixtures';
import { createTestApp } from './test-app';

describe('POST /loans', () => {
  it('在庫ありの蔵書を貸し出す場合、201 で返却期限 2026-09-15 の貸出を返すこと', async () => {
    // Arrange
    const app = createTestApp({ clock: FixedClock.onDate('2026-09-01') });

    // Act
    const res = await request(app)
      .post('/loans')
      .send({ patron_number: fixturePatronNumbers.m1, copy_id: fixtureIds.copyAvailable });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      patron_number: 'P-2026-00001',
      copy_id: fixtureIds.copyAvailable,
      book_title: '吾輩は猫である',
      loaned_on: '2026-09-01',
      due_on: '2026-09-15',
      returned_on: null,
      status: 'on_loan',
      copy_status: 'on_loan',
      fulfilled_reservation_id: null,
    });
  });

  it('本人向けに取り置き中の蔵書を貸し出す場合、受取済みにした予約 ID を返すこと', async () => {
    // Arrange
    const app = createTestApp({ clock: FixedClock.onDate('2026-09-20') });

    // Act
    const res = await request(app)
      .post('/loans')
      .send({ patron_number: fixturePatronNumbers.m1, copy_id: fixtureIds.copyOnHold });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      due_on: '2026-10-04',
      fulfilled_reservation_id: fixtureIds.heldReservation,
    });
  });

  it('同じ蔵書を続けて貸し出す場合、2 回目は貸出中として 409 を返すこと', async () => {
    // Arrange
    const app = createTestApp();
    const body = { patron_number: fixturePatronNumbers.m1, copy_id: fixtureIds.copyAvailable };
    await request(app).post('/loans').send(body);

    // Act
    const res = await request(app)
      .post('/loans')
      .send({ ...body, patron_number: fixturePatronNumbers.m2 });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'loan_not_allowed', detail: 'この蔵書は貸出中です。' });
  });

  it('他の利用者向けに取り置き中の蔵書の場合、409 で取り置き中の旨を返すこと', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await request(app)
      .post('/loans')
      .send({ patron_number: fixturePatronNumbers.m2, copy_id: fixtureIds.copyOnHold });

    // Assert
    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      code: 'loan_not_allowed',
      title: '貸し出せません',
      detail: 'この蔵書は他の利用者向けに取り置き中です。',
    });
  });

  it('利用者番号が空の場合、400 で項目ごとの検証エラーを返すこと', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await request(app)
      .post('/loans')
      .send({ patron_number: '', copy_id: fixtureIds.copyAvailable });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      type: 'https://library.example/problems/validation-error',
      title: '入力内容に誤りがあります',
      status: 400,
      errors: [{ field: 'patron_number', code: 'required', message: '利用者番号は必須です' }],
    });
  });

  it('蔵書 ID が UUID でなく未知の項目もある場合、400 で両方を返すこと', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await request(app)
      .post('/loans')
      .send({ patron_number: 'P-2026-00001', copy_id: 'abc', due_on: '2026-12-31' });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([
      { field: 'copy_id', code: 'format', message: '蔵書 ID の形式が正しくありません' },
      { field: 'due_on', code: 'unknown_field', message: '受け付けない項目です: due_on' },
    ]);
  });

  it('存在しない利用者・蔵書の場合、それぞれの code で 404 を返すこと', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const patron = await request(app)
      .post('/loans')
      .send({ patron_number: 'P-2026-99999', copy_id: fixtureIds.copyAvailable });
    const copy = await request(app)
      .post('/loans')
      .send({ patron_number: 'P-2026-00001', copy_id: '99999999-9999-4999-8999-999999999999' });

    // Assert
    expect([patron.status, patron.body.code]).toEqual([404, 'patron_not_found']);
    expect([copy.status, copy.body.code]).toEqual([404, 'copy_not_found']);
  });

  it('認証されていない場合、401 を返すこと', async () => {
    // Arrange
    const app = createTestApp({ defaultPrincipal: null });

    // Act
    const res = await request(app)
      .post('/loans')
      .send({ patron_number: fixturePatronNumbers.m1, copy_id: fixtureIds.copyAvailable });

    // Assert
    expect(res.status).toBe(401);
  });

  it('利用者区分が利用者の場合、403 を返し貸出を記録しないこと', async () => {
    // Arrange
    const app = createTestApp({
      tokens: { 'patron-token': { role: 'patron', patronNumber: fixturePatronNumbers.m1 } },
    });

    // Act
    const res = await request(app)
      .post('/loans')
      .set('authorization', 'Bearer patron-token')
      .send({ patron_number: fixturePatronNumbers.m1, copy_id: fixtureIds.copyAvailable });

    // Assert
    expect(res.status).toBe(403);
    const retry = await request(app)
      .post('/loans')
      .send({ patron_number: fixturePatronNumbers.m1, copy_id: fixtureIds.copyAvailable });
    expect(retry.status).toBe(201);
  });

  it('JSON として読めない本文の場合、400 を返すこと', async () => {
    // Arrange
    const app = createTestApp();

    // Act
    const res = await request(app)
      .post('/loans')
      .set('content-type', 'application/json')
      .send('{"patron_number":');

    // Assert
    expect(res.status).toBe(400);
  });
});
