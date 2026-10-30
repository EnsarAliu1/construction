const paths: Record<string, string> = {
 app: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 projects: 'M3 17h18v4H3zM5 17v-6a7 7 0 0 1 14 0v6M10 4v7M14 4v7',
 clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
 payments: 'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6M20 13h-5v4h5',
 expenses: 'M5 3h14v18l-3-2-4 2-4-2-3 2zM15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 6v12',
 receipts: 'M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h8',
 reports: 'M3 3v18h18M7 16v-5M12 16V6M17 16V9',
 categories: 'M20 13 11 22 2 13V3h10l8 8zM7 7h.01',
 persons: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3M18 8h4M20 6v4M18 16h4',
 vehicles: 'M3 16V9h12v7H3zM15 11h4l3 3v2h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
 history: 'M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2',
 security: 'm12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5zM8 11l3 3 5-6',
 accounts: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10M3 22v-3a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v3',
 search: 'M21 21l-5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16',
 moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10',
 sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
 menu: 'M3 6h18M3 12h18M3 18h18', close: 'M6 6l12 12M18 6 6 18',
 fold: 'm13 6-6 6 6 6M20 6l-6 6 6 6', unfold: 'm4 6 6 6-6 6M11 6l6 6-6 6',
 external: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7', chevron: 'm8 10 4 4 4-4',
};
export function WorkspaceIcon({name}:{name:string}) {
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.app}/></svg>;
}
