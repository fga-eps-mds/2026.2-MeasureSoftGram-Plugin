import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderSlots, slot} from '../../utils/l10nSlots';

describe('renderSlots', () => {
    it('troca cada placeholder pelo elemento, na ordem da tradução', () => {
        const translated = `${slot(1)} antes de ${slot(0)}.`;
        const {container} = render(<p>{renderSlots(translated, [<em key="a">A</em>, <strong key="b">B</strong>])}</p>);
        expect(container.innerHTML).toBe('<p><strong>B</strong> antes de <em>A</em>.</p>');
    });

    it('texto sem placeholder volta inteiro', () => {
        expect(renderSlots('sem nada', [])).toEqual(['sem nada']);
    });
});
