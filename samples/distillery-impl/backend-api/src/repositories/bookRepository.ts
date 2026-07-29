import type { Book, BookStatus } from "../domain/book";

// 出典: _cross-cutting/datastore/rdb-schema.yaml books テーブル
export interface BookRepository {
  findById(id: string): Book | undefined;
  updateStatus(id: string, status: BookStatus): void;
}

export class InMemoryBookRepository implements BookRepository {
  private readonly books = new Map<string, Book>();

  seed(book: Book): void {
    this.books.set(book.id, book);
  }

  findById(id: string): Book | undefined {
    return this.books.get(id);
  }

  updateStatus(id: string, status: BookStatus): void {
    const book = this.books.get(id);
    if (!book) {
      return;
    }
    this.books.set(id, { ...book, status });
  }
}
