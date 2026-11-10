/** 00:00 から 23:30 までの 30 分刻みの時刻 (営業時間の制限なし) */
export function halfHourTimes(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    out.push(`${hh}:00`, `${hh}:30`);
  }
  return out;
}

/** 翌日 0:00 を表す終了時刻。時間帯は指定した日付の中に収め、終了はここまで選べる */
export const END_OF_DAY = '24:00';

/** 開始時刻の選択肢: 00:00 から 23:30 まで (30 分刻み) */
export function startTimes(): string[] {
  return halfHourTimes();
}

/** 終了時刻の選択肢: 00:30 から 24:00 (翌日 0:00) まで (30 分刻み) */
export function endTimes(): string[] {
  return [...halfHourTimes().slice(1), END_OF_DAY];
}
