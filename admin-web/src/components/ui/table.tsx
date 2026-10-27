import { forwardRef } from 'react';
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

interface TableProps extends HTMLAttributes<HTMLTableElement> {}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className = '', children, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={`w-full text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
);
Table.displayName = 'Table';

interface THeadProps extends HTMLAttributes<HTMLTableSectionElement> {}

export const THead = forwardRef<HTMLTableSectionElement, THeadProps>(
  ({ className = '', children, ...props }, ref) => (
    <thead ref={ref} className={className} {...props}>
      {children}
    </thead>
  )
);
THead.displayName = 'THead';

interface THeadRowProps extends HTMLAttributes<HTMLTableRowElement> {}

export const THeadRow = forwardRef<HTMLTableRowElement, THeadRowProps>(
  ({ className = '', children, ...props }, ref) => (
    <tr ref={ref} className={`border-b border-ink-100 bg-ink-50/50 ${className}`} {...props}>
      {children}
    </tr>
  )
);
THeadRow.displayName = 'THeadRow';

interface THeadCellProps extends ThHTMLAttributes<HTMLTableCellElement> {}

export const THeadCell = forwardRef<HTMLTableCellElement, THeadCellProps>(
  ({ className = '', children, ...props }, ref) => (
    <th
      ref={ref}
      className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 ${className}`}
      {...props}
    >
      {children}
    </th>
  )
);
THeadCell.displayName = 'THeadCell';

interface TBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export const TBody = forwardRef<HTMLTableSectionElement, TBodyProps>(
  ({ className = '', children, ...props }, ref) => (
    <tbody ref={ref} className={`divide-y divide-ink-100 ${className}`} {...props}>
      {children}
    </tbody>
  )
);
TBody.displayName = 'TBody';

interface TRowProps extends HTMLAttributes<HTMLTableRowElement> {
  clickable?: boolean;
  selected?: boolean;
}

export const TRow = forwardRef<HTMLTableRowElement, TRowProps>(
  ({ className = '', clickable, selected, children, ...props }, ref) => (
    <tr
      ref={ref}
      className={`${clickable ? 'cursor-pointer transition-colors hover:bg-ink-50/60' : ''} ${
        selected ? 'bg-brand-50/60' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  )
);
TRow.displayName = 'TRow';

interface TCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export const TCell = forwardRef<HTMLTableCellElement, TCellProps>(
  ({ className = '', children, ...props }, ref) => (
    <td ref={ref} className={`whitespace-nowrap px-4 py-3 text-neutral-700 ${className}`} {...props}>
      {children}
    </td>
  )
);
TCell.displayName = 'TCell';