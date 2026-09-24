/**
 * データアクセスログの出力先。usecase の AccessLog を構造的に満たす。
 */
export interface AccessLogRecord {
  action: string;
  actorSubject: string;
  actorRole: string;
  outcome: string;
  target: Record<string, string>;
  reason?: string;
  occurredAt: string;
}

/** 標準出力へ 1 行 1 JSON で出す (本番用)。 */
export class JsonLinesAccessLog {
  constructor(private readonly write: (line: string) => void = (line) => process.stdout.write(line)) {}

  record(entry: AccessLogRecord): void {
    this.write(`${JSON.stringify({ kind: 'data-access', ...entry })}\n`);
  }
}

/** テスト用。記録した内容を検証できる。 */
export class InMemoryAccessLog {
  readonly entries: AccessLogRecord[] = [];

  record(entry: AccessLogRecord): void {
    this.entries.push(entry);
  }
}
