import type { SVGProps } from 'react';

/**
 * 線のアイコン (24x24)。src/assets/icons/*.svg と同じ形をインラインで描く。
 * 色は currentColor (文字色) に従う。
 */
export type IconName =
  | 'search'
  | 'calendar'
  | 'clock'
  | 'user'
  | 'door'
  | 'check-circle'
  | 'x-circle'
  | 'alert-circle';

const paths: Record<IconName, string[]> = {
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M20 20l-4-4'],
  calendar: [
    'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
    'M4 10h16',
    'M8 2v4',
    'M16 2v4',
  ],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4 21a8 8 0 0 1 16 0'],
  door: ['M5 21h14', 'M7 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17', 'M14 12h.01'],
  'check-circle': ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M8 12l3 3l5-6'],
  'x-circle': ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M9 9l6 6', 'M15 9l-6 6'],
  'alert-circle': ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 8v5', 'M12 16h.01'],
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** 読み上げ用の名前。無ければ装飾として読み上げない */
  label?: string;
}

export function Icon({ name, size = 20, label, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
