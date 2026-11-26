import React from 'react';

const MARK = '\u0001';
const SLOT_PATTERN = new RegExp(`${MARK}(\\d+)${MARK}`);

export const slot = (index: number): string => `${MARK}${index}${MARK}`;

export function renderSlots(translated: string, nodes: React.ReactNode[]): React.ReactNode[] {
    return translated
        .split(SLOT_PATTERN)
        .map((part, i) => (i % 2 === 0 ? part : <React.Fragment key={i}>{nodes[Number(part)]}</React.Fragment>))
        .filter((part) => part !== '');
}
