import { Alert } from '../ui/Alert';
import { errorMessages } from './errorMessages';
import type { ErrorCode } from './types';

export interface BusinessErrorAlertProps {
  /** 契約の Problem.code */
  code: ErrorCode;
  className?: string;
}

/** 契約のエラーのコードに応じた理由の文を表示する (ADR 0008) */
export function BusinessErrorAlert({ code, className }: BusinessErrorAlertProps) {
  const m = errorMessages[code];
  return (
    <Alert variant="destructive" title={m.title} className={className} data-error-code={code}>
      {m.detail}
    </Alert>
  );
}
