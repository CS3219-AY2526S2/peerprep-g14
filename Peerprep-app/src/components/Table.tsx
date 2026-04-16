import React from 'react';
import { Loader2 } from 'lucide-react';
import './Table.css';

interface Column<T> {
    header: string;
    accessorKey: keyof T;
    cell?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    isLoading?: boolean;
    emptyMessage?: string;
    onRowClick?: (item: T) => void;
}

export function Table<T>({
    data,
    columns,
    isLoading = false,
    emptyMessage = 'No data available.',
    onRowClick,
}: TableProps<T>) {
    return (
        <div className="table-container">
            <table className="custom-table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx}>{col.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? (
                        <tr>
                            <td colSpan={columns.length} className="table-loading">
                                <Loader2 className="animate-spin h-6 w-6 text-accent-primary" />
                                <span>Loading data...</span>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="table-empty">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        <>
                            {data.map((item, rowIndex) => (
                                <tr
                                    key={rowIndex}
                                    onClick={() => onRowClick && onRowClick(item)}
                                    className={onRowClick ? 'clickable-row' : ''}
                                >
                                    {columns.map((col, colIndex) => (
                                        <td key={colIndex}>
                                            {col.cell ? col.cell(item) : (item[col.accessorKey] as React.ReactNode)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
}
