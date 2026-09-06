"""Executable transaction probe, not an HTTP service or PostgreSQL lock test.

The database deliberately contains only the fields needed to disprove split commits.
SQLite provides real persistence/rollback; production schema and rules remain in spec.
"""
import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

BODY = dict(book_id='B-000001', user_no='U-000123', loan_period_type='標準')
KEY = '00000000-0000-4000-8000-000000000001'


def canonical(body):
    return json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def register(path, actor='staff-a', key=KEY, body=None, fault=None):
    body = BODY if body is None else body
    fingerprint = hashlib.sha256(('POST\n/api/v1/loans\n' + canonical(body)).encode()).hexdigest()
    db = sqlite3.connect(path)
    try:
        db.execute('BEGIN IMMEDIATE')  # Stronger/coarser than the specified PostgreSQL keyed lock.
        saved = db.execute('SELECT fingerprint, body FROM results WHERE actor=? AND key=?', (actor, key)).fetchone()
        if saved:
            return ('201-replay', json.loads(saved[1])) if saved[0] == fingerprint else ('409-key-conflict', None)
        book = db.execute('SELECT status FROM books WHERE id=?', (body['book_id'],)).fetchone()
        if not book:
            return '404', None
        if book[0] != 'available':
            return '409-unavailable', None
        result = dict(loan_id='00000000-0000-4000-8000-000000000010', due_date='2026-09-16')
        db.execute('INSERT INTO loans VALUES (?, ?, ?)', (result['loan_id'], body['book_id'], 'active'))
        db.execute("UPDATE books SET status='loaned' WHERE id=?", (body['book_id'],))
        if fault == 'before-receipt':
            raise ConnectionError('fault after business writes')
        db.execute('INSERT INTO results VALUES (?, ?, ?, ?)', (actor, key, fingerprint, canonical(result)))
        if fault == 'before-commit':
            raise ConnectionError('fault after receipt write')
        db.commit()
        if fault == 'after-commit':
            raise ConnectionError('lost response')
        return '201', result
    finally:
        db.close()  # Uncommitted work rolls back, as it would on connection loss.


class RecoveryProbe(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'loan.db'
        with sqlite3.connect(self.path) as db:
            db.executescript('''
                CREATE TABLE books(id TEXT PRIMARY KEY, status TEXT NOT NULL);
                INSERT INTO books VALUES ('B-000001', 'available');
                CREATE TABLE loans(id TEXT PRIMARY KEY, book TEXT NOT NULL, status TEXT NOT NULL);
                CREATE UNIQUE INDEX active_book ON loans(book) WHERE status='active';
                CREATE TABLE results(actor TEXT, key TEXT, fingerprint TEXT NOT NULL, body TEXT NOT NULL,
                                     PRIMARY KEY(actor, key));
            ''')

    def counts(self):
        with sqlite3.connect(self.path) as db:
            return tuple(db.execute('SELECT count(*) FROM ' + table).fetchone()[0] for table in ('loans', 'results'))

    def test_stop_before_receipt_rolls_back_business(self):
        with self.assertRaises(ConnectionError):
            register(self.path, fault='before-receipt')
        self.assertEqual(self.counts(), (0, 0))
        self.assertEqual(register(self.path)[0], '201')
        self.assertEqual(self.counts(), (1, 1))

    def test_stop_before_commit_rolls_back_both(self):
        with self.assertRaises(ConnectionError):
            register(self.path, fault='before-commit')
        self.assertEqual(self.counts(), (0, 0))
        self.assertEqual(register(self.path)[0], '201')

    def test_lost_response_replays_committed_result(self):
        with self.assertRaises(ConnectionError):
            register(self.path, fault='after-commit')
        status, result = register(self.path)
        self.assertEqual(status, '201-replay')
        self.assertEqual(result['due_date'], '2026-09-16')
        self.assertEqual(self.counts(), (1, 1))

    def test_different_body_does_not_overwrite_receipt(self):
        result = register(self.path)[1]
        self.assertEqual(register(self.path, body={**BODY, 'loan_period_type': '短期'})[0], '409-key-conflict')
        self.assertEqual(register(self.path)[1], result)
        self.assertEqual(self.counts(), (1, 1))

    def test_replay_after_return_does_not_create_new_loan(self):
        result = register(self.path)[1]
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE books SET status='available'")
            db.execute("UPDATE loans SET status='returned'")
        self.assertEqual(register(self.path), ('201-replay', result))
        self.assertEqual(self.counts(), (1, 1))

    def test_actor_does_not_receive_another_actors_receipt(self):
        register(self.path)
        self.assertEqual(register(self.path, actor='staff-b')[0], '409-unavailable')
        self.assertEqual(self.counts(), (1, 1))

    def test_json_member_order_is_not_a_different_request(self):
        result = register(self.path)[1]
        self.assertEqual(register(self.path, body=dict(reversed(list(BODY.items())))), ('201-replay', result))


if __name__ == '__main__':
    unittest.main(verbosity=2)
