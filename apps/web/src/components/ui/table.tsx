'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';
import { Skeleton } from './skeleton';

// ────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Enable sorting on this column */
  sortable?: boolean;
  /** Custom sort comparator — return negative/zero/positive */
  sortFn?: (a: T, b: T) => number;
  /** Minimum width, e.g. '120px' */
  minWidth?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];

  // Identity
  rowKey?: (row: T) => string;

  // Appearance
  compact?: boolean;
  stickyHeader?: boolean;

  // Empty state
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;

  // Loading
  loading?: boolean;
  loadingRows?: number;

  // Row interaction
  onRowClick?: (row: T) => void;

  // Sorting (controlled)
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;

  // Selection
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;

  // Bulk actions bar (shows when items are selected)
  bulkActions?: React.ReactNode;

  // Toolbar: search, filters, actions — rendered above the table
  toolbar?: React.ReactNode;

  // Pagination (rendered inside the table card below the rows)
  pagination?: React.ReactNode;
}

// ────────────────────────────────────────────────────────
//  DataTable
// ────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  compact = false,
  stickyHeader = false,
  emptyMessage = 'No data found',
  emptyIcon,
  emptyAction,
  loading = false,
  loadingRows = 5,
  onRowClick,
  sort,
  onSortChange,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  bulkActions,
  toolbar,
  pagination,
}: DataTableProps<T>) {
  const cellPadding = compact ? 'px-4 py-2' : 'px-4 py-3';
  const headerPadding = compact ? 'px-4 py-2' : 'px-4 py-3';

  // Keep the first (identity) column visible while the table scrolls
  // horizontally. Skipped when checkboxes shift the column offsets.
  const stickyFirstCol = !selectable;

  // ── Row keys helper ──
  const getRowKey = useCallback(
    (row: T, index: number) => (rowKey ? rowKey(row) : String(index)),
    [rowKey],
  );

  // ── Selection helpers ──
  const allKeys = useMemo(
    () => new Set(data.map((row, i) => getRowKey(row, i))),
    [data, getRowKey],
  );

  const allSelected = selectable && selectedKeys && allKeys.size > 0 && allKeys.size === selectedKeys.size && [...allKeys].every((k) => selectedKeys.has(k));
  const someSelected = selectable && selectedKeys && selectedKeys.size > 0 && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allKeys));
    }
  };

  const toggleRow = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  };

  // ── Sort handler ──
  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (sort?.key === col.key) {
      if (sort.direction === 'asc') {
        onSortChange({ key: col.key, direction: 'desc' });
      } else if (sort.direction === 'desc') {
        onSortChange({ key: col.key, direction: null });
      } else {
        onSortChange({ key: col.key, direction: 'asc' });
      }
    } else {
      onSortChange({ key: col.key, direction: 'asc' });
    }
  };

  const renderSortIcon = (col: Column<T>) => {
    if (!col.sortable) return null;
    if (sort?.key === col.key && sort.direction === 'asc') {
      return <ChevronUp size={14} className="text-brand-600" />;
    }
    if (sort?.key === col.key && sort.direction === 'desc') {
      return <ChevronDown size={14} className="text-brand-600" />;
    }
    return <ChevronsUpDown size={12} className="text-content-tertiary opacity-0 group-hover/sort:opacity-100 transition-opacity" />;
  };

  // ── Bulk action bar ──
  const showBulkBar = selectable && selectedKeys && selectedKeys.size > 0 && bulkActions;

  // ── Columns with optional checkbox ──
  const showCheckbox = selectable;
  const totalCols = columns.length + (showCheckbox ? 1 : 0);

  return (
    <div className="bg-white rounded-xl border border-surface-200 shadow-xs overflow-hidden">
      {/* Toolbar */}
      {toolbar && (
        <div className="px-4 py-3 border-b border-surface-200 bg-white">
          {toolbar}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {showBulkBar && (
        <div className="px-4 py-2.5 bg-brand-50 border-b border-brand-200 flex items-center gap-3">
          <span className="text-sm font-medium text-brand-700">
            {selectedKeys!.size} selected
          </span>
          <div className="flex items-center gap-2">{bulkActions}</div>
          <button
            type="button"
            onClick={() => onSelectionChange?.(new Set())}
            className="ml-auto text-xs text-brand-600 hover:text-brand-800 font-medium"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b border-surface-200 bg-surface-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
              {showCheckbox && (
                <th className={`${headerPadding} w-10`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !!someSelected;
                    }}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col, colIdx) => (
                <th
                  key={col.key}
                  className={`${headerPadding} text-left text-xs font-medium text-content-tertiary uppercase tracking-wider ${col.sortable ? 'cursor-pointer select-none group/sort' : ''} ${stickyFirstCol && colIdx === 0 ? 'sticky left-0 z-[2] bg-surface-50 border-r border-surface-200' : ''} ${col.headerClassName || ''}`}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  onClick={() => handleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {renderSortIcon(col)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {/* Loading skeleton rows */}
            {loading &&
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {showCheckbox && (
                    <td className={cellPadding}>
                      <Skeleton className="h-3.5 w-3.5 rounded" />
                    </td>
                  )}
                  {columns.map((col, j) => (
                    <td key={col.key} className={`${cellPadding} ${stickyFirstCol && j === 0 ? 'sticky left-0 z-[1] bg-white border-r border-surface-100' : ''} ${col.className || ''}`}>
                      <Skeleton className={`h-4 ${j === 0 ? 'w-36' : 'w-20'}`} />
                      {j === 0 && <Skeleton className="h-3 w-24 mt-1.5" />}
                    </td>
                  ))}
                </tr>
              ))}

            {/* Data rows */}
            {!loading &&
              data.map((row, i) => {
                const key = getRowKey(row, i);
                const isSelected = selectedKeys?.has(key);

                // The sticky identity cell needs an opaque background so
                // horizontally-scrolled content doesn't bleed through it.
                const stickyCellBg = isSelected
                  ? 'bg-brand-50'
                  : onRowClick
                    ? 'bg-white group-hover:bg-brand-50'
                    : 'bg-white group-hover:bg-surface-50';

                return (
                  <tr
                    key={key}
                    className={`group transition-colors ${
                      isSelected
                        ? 'bg-brand-50/60'
                        : onRowClick
                          ? 'cursor-pointer hover:bg-brand-50/50'
                          : 'hover:bg-surface-50'
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {showCheckbox && (
                      <td className={`${cellPadding} w-10`} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={() => toggleRow(key)}
                          className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`${cellPadding} text-content-primary ${stickyFirstCol && colIdx === 0 ? `sticky left-0 z-[1] border-r border-surface-100 transition-colors ${stickyCellBg}` : ''} ${col.className || ''}`}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {!loading && data.length === 0 && (
        <div className="py-16 text-center">
          {emptyIcon && (
            <div className="mx-auto mb-3 text-content-tertiary [&>svg]:h-10 [&>svg]:w-10 [&>svg]:mx-auto">
              {emptyIcon}
            </div>
          )}
          <p className="text-sm text-content-tertiary">{emptyMessage}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      )}

      {/* Pagination */}
      {pagination && !loading && data.length > 0 && (
        <div className="border-t border-surface-200 px-4 py-3">
          {pagination}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  TableToolbar — convenience wrapper for search + filters
// ────────────────────────────────────────────────────────

interface TableToolbarProps {
  /** Search value (controlled) */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra filter/action elements rendered to the right of search */
  children?: React.ReactNode;
}

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  children,
}: TableToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {onSearchChange !== undefined && (
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
          />
          <input
            type="text"
            value={search ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-8 text-sm border border-surface-200 rounded-lg bg-white text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {children && (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      )}
    </div>
  );
}
