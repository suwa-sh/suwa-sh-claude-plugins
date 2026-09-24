/**
 * データアクセスログのポート (ADR 0006: 貸出と予約の更新をデータアクセスログとして記録する)。
 * 氏名・連絡先などの個人情報は載せない。操作者は IdP の subject、対象は ID で表す。
 */
export interface AccessLogEntry {
  action: string;
  actorSubject: string;
  actorRole: 'staff' | 'patron';
  outcome: 'succeeded' | 'denied' | 'rejected';
  target: Record<string, string>;
  reason?: string;
  occurredAt: string;
}

export interface AccessLog {
  record(entry: AccessLogEntry): void;
}
