import * as React from "react";
import "./ui.css";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

/** 関連する情報や操作をひとまとまりにするコンテナ。 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`ls-card${hoverable ? " ls-card--hoverable" : ""} ${className}`.trim()}
      {...props}
    />
  ),
);

Card.displayName = "Card";

export const CardHeader = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`ls-card__header ${className}`.trim()} {...props} />
);

export const CardTitle = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`ls-card__title ${className}`.trim()} {...props} />
);

export const CardDescription = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`ls-card__description ${className}`.trim()} {...props} />
);

export const CardContent = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`ls-card__content ${className}`.trim()} {...props} />
);

export const CardFooter = ({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`ls-card__footer ${className}`.trim()} {...props} />
);
