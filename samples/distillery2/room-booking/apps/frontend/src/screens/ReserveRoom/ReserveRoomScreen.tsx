// 予約の画面 (route /reservations/new)。構造の正は packages/ui/stories/ReserveRoom.stories.tsx
import {
  Alert,
  AppShell,
  BusinessErrorAlert,
  Button,
  Card,
  type ErrorCode,
  type ReservationFormValue,
  ReservationForm,
  ReservationSummary,
  type Room,
} from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import type { SessionTokenProvider } from '../../api/tokenProvider';
import { initialReservationValue, keepKnownRoom } from './initialReservationValue';
import { loadRooms } from './loadRooms';
import { type ReserveRoomState, submitReservation } from './submitReservation';

/** 空き状況の画面 (screens.yaml の RoomAvailability の route) */
export const AVAILABILITY_PATH = '/availability';
/** 自分の予約一覧の画面 (screens.yaml の MyReservations の route) */
export const MY_RESERVATIONS_PATH = '/my-reservations';

export interface ReserveRoomScreenProps {
  tokens: Pick<SessionTokenProvider, 'getAccessToken' | 'signIn' | 'getDisplayName'>;
  /** 移ってきたときの URL のクエリ (roomId・date・startTime・endTime)。入力の初期値としてだけ使う (ADR 0021) */
  query?: Record<string, string>;
  /** 画面の移動 (App.tsx の navigate) */
  navigate: (path: string) => void;
  /** 生成クライアントの options.fetch の元 (省略時はグローバルの fetch) */
  fetch?: typeof fetch;
}

/** 入力の初期値に使うクエリの項目 (initialReservationValue が読むもの) */
const QUERY_FIELDS = ['roomId', 'date', 'startTime', 'endTime'] as const;

/** 初期値に効くクエリの項目だけを決まった順に並べた鍵。初期値に効かない項目の違いでは描き直さない */
export const reservationQueryKey = (query: Record<string, string>): string =>
  JSON.stringify(QUERY_FIELDS.map((f) => query[f] ?? ''));

/**
 * 同じ path のままクエリだけが変わったら (ブラウザの戻る・進むなど)、画面の状態を作り直して
 * 移った先のクエリを入力の初期値にする (ADR 0021)
 */
export function ReserveRoomScreen(props: ReserveRoomScreenProps) {
  return <ReserveRoomScreenBody key={reservationQueryKey(props.query ?? {})} {...props} />;
}

function ReserveRoomScreenBody({ tokens, query = {}, navigate, fetch }: ReserveRoomScreenProps) {
  const [value, setValue] = useState<ReservationFormValue>(() => initialReservationValue(query));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsError, setRoomsError] = useState<ErrorCode | undefined>();
  // 会議室の一覧を読めたか (読み直しのボタンを出すかを決める)。送信の判定は描き直しを待たない knownRooms で行う
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [reloadingRooms, setReloadingRooms] = useState(false);
  const [state, setState] = useState<ReserveRoomState>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [userName, setUserName] = useState<string | undefined>();
  // 押した直後の 2 回目の送信を、描き直しを待たずに止める (ADR 0022: 送信中はボタンを押せなくし二重の送信を防ぐ)
  const inFlight = useRef(false);

  useEffect(() => {
    tokens
      .getDisplayName()
      .then(setUserName)
      .catch(() => setUserName(undefined));
  }, [tokens]);

  // 会議室の選択肢を読めた後だけ、引き継いだ会議室 ID を選択肢と照らした値で送る (ADR 0021)。読めるまでは undefined
  const knownRooms = useRef<Room[] | undefined>(undefined);

  /** 読めた会議室の一覧を選択肢にし、エラーを消す */
  const acceptRooms = (loadedRooms: Room[]) => {
    knownRooms.current = loadedRooms;
    setRooms(loadedRooms);
    setRoomsLoaded(true);
    setRoomsError(undefined);
  };

  useEffect(() => {
    let active = true;
    void loadRooms({ tokens, fetch }).then((loaded) => {
      if (!active) return;
      if (loaded.kind === 'loaded') {
        knownRooms.current = loaded.rooms;
        setRooms(loaded.rooms);
        setRoomsLoaded(true);
        setValue((v) => keepKnownRoom(v, loaded.rooms));
      } else {
        setRoomsError(loaded.code);
      }
    });
    return () => {
      active = false;
    };
  }, [tokens, fetch]);

  /** 会議室の一覧を読めなかった後の読み直し (読み直しのボタン)。読めたら引き継いだ会議室を選択肢と照らす */
  const reloadRooms = async () => {
    setReloadingRooms(true);
    try {
      const loaded = await loadRooms({ tokens, fetch });
      if (loaded.kind !== 'loaded') {
        setRoomsError(loaded.code);
        return;
      }
      acceptRooms(loaded.rooms);
      setValue((v) => keepKnownRoom(v, loaded.rooms));
    } finally {
      setReloadingRooms(false);
    }
  };

  /**
   * 送る値を決める。選択肢をまだ読めていなければ読み直し、読めなければ送らない (undefined)。
   * 引き継いだ会議室が選択肢に無ければ空にして送らず、社員に選ばせる
   */
  const confirmedValue = async (): Promise<ReservationFormValue | undefined> => {
    if (knownRooms.current) return value;
    const loaded = await loadRooms({ tokens, fetch });
    if (loaded.kind !== 'loaded') {
      setRoomsError(loaded.code);
      return undefined;
    }
    acceptRooms(loaded.rooms);
    const checked = keepKnownRoom(value, loaded.rooms);
    setValue(checked);
    return checked.roomId === value.roomId ? checked : undefined;
  };

  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const sending = await confirmedValue();
      if (sending) setState(await submitReservation(sending, { tokens, fetch }));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  /** 入力を変えたら、変える前の入力に対する予約の結果のエラーを消す (今の入力に同じ問題があるように見せない) */
  const changeValue = (next: ReservationFormValue) => {
    setValue(next);
    setState((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
  };

  // 予約の結果のエラーは入力の中に出す。会議室の一覧を読めなかったエラーは入力の上に出す (見本 RoomsUnavailable)
  const submitError = state.kind === 'error' ? state.code : undefined;
  const roomsUnavailableCode = roomsLoaded ? undefined : roomsError;
  return (
    <AppShell current="availability" userName={userName} title="会議室を予約する">
      <div className="grid grid-cols-12 gap-(--section-gap)">
        <div className="col-span-8 col-start-3 flex flex-col gap-(--section-gap)">
          {state.kind === 'completed' ? (
            <>
              <Alert variant="success" title="予約しました">
                自分の予約一覧から、開始時刻より前であれば取り消せます。
              </Alert>
              <Card title="予約の内容">
                <div className="flex flex-col gap-(--section-gap)">
                  <ReservationSummary
                    roomName={state.reservation.roomName}
                    date={state.reservation.date}
                    startTime={state.reservation.startTime}
                    endTime={state.reservation.endTime}
                    status={state.reservation.status}
                  />
                  <div className="flex flex-wrap justify-end gap-(--component-gap)">
                    <Button variant="outline" onClick={() => navigate(AVAILABILITY_PATH)}>
                      空き状況に戻る
                    </Button>
                    <Button onClick={() => navigate(MY_RESERVATIONS_PATH)}>
                      自分の予約一覧を見る
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              {roomsUnavailableCode && (
                // 見本 RoomsUnavailable: 入力の上に読めなかった理由と「会議室の一覧を読み直す」を置く
                <div className="flex flex-col gap-(--component-gap)">
                  <BusinessErrorAlert code={roomsUnavailableCode} />
                  <div className="flex flex-wrap justify-end gap-(--component-gap)">
                    <Button
                      variant="outline"
                      loading={reloadingRooms}
                      disabled={submitting}
                      onClick={() => void reloadRooms()}
                    >
                      会議室の一覧を読み直す
                    </Button>
                  </div>
                </div>
              )}
              <ReservationForm
                rooms={roomsUnavailableCode ? [] : rooms}
                value={value}
                onChange={changeValue}
                onSubmit={() => void submit()}
                onBack={() => navigate(AVAILABILITY_PATH)}
                submitting={submitting}
                errorCode={submitting ? undefined : submitError}
                showMissing={state.kind === 'missing'}
              />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
