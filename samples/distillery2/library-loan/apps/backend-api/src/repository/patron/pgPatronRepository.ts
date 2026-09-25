import type { Patron, PatronRepository } from '../../domain/patron/patron';
import type { SqlClient } from '../../gateway/database';

interface PatronRow {
  patron_id: string;
  patron_number: string;
}

export function createPgPatronRepository(db: SqlClient): PatronRepository {
  return {
    async findActiveByPatronNumber(patronNumber: string): Promise<Patron | null> {
      const { rows } = await db.query<PatronRow>(
        `SELECT patron_id, patron_number FROM patrons
          WHERE patron_number = $1 AND deleted_at IS NULL`,
        [patronNumber],
      );
      const row = rows[0];
      return row ? { patronId: row.patron_id, patronNumber: row.patron_number } : null;
    },
  };
}
