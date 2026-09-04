import { useCallback, useState } from 'react'

export type CounterFlowPhase = 'input' | 'lookup' | 'confirm' | 'done'

/**
 * 窓口受付（貸出受付 / 返却受付）の phase 遷移と「続けて受付」リセットを管理する。
 * LoanRegisterPanel / ReturnRegisterPanel の親画面が使う。
 */
export function useCounterFlow(initial: CounterFlowPhase = 'input') {
  const [phase, setPhase] = useState<CounterFlowPhase>(initial)

  const toLookup = useCallback(() => setPhase('lookup'), [])
  const toConfirm = useCallback(() => setPhase('confirm'), [])
  const toDone = useCallback(() => setPhase('done'), [])
  /** 続けて受付: input へ戻す（入力値のクリアは呼び出し側の責務） */
  const reset = useCallback(() => setPhase('input'), [])

  return { phase, setPhase, toLookup, toConfirm, toDone, reset }
}
