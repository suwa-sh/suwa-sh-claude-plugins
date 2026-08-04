import * as React from "react";
import "./ui.css";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
}

/** ラベル、補足、エラー表示を一体化したフォーム入力。 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      id,
      className = "",
      required,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const helpId = `${inputId}-help`;
    const describedBy = error || hint ? helpId : ariaDescribedBy;

    return (
      <div className="ls-input-field">
        {label ? (
          <label className="ls-input-field__label" htmlFor={inputId}>
            {label}
            {required ? <span className="ls-input-field__required">必須</span> : null}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`ls-input${error ? " ls-input--error" : ""} ${className}`.trim()}
          {...props}
        />
        {error ? (
          <p id={helpId} className="ls-input-field__message ls-input-field__message--error">
            {error}
          </p>
        ) : hint ? (
          <p id={helpId} className="ls-input-field__message">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
