const range = (from: string, to: string) =>
    Array.from({ length: to.charCodeAt(0) - from.charCodeAt(0) + 1 }, (_, i) =>
        String.fromCharCode(from.charCodeAt(0) + i),
    );

const uppercase = range('A', 'Z');
const lowercase = range('a', 'z');
const numbers = range('0', '9');
const symbols = [...'!@#$%^&*()-_=+[]{};:\'",.<>/?\\|`~'];

// Ordered from "lightest" to "heaviest" so brightness maps nicely onto them
export const CHARSETS = {
    default: [...'.:+*@%0369#'],
    numbers,
    symbols,
    letters: [...uppercase, ...lowercase],
    uppercase,
    lowercase,
    alphanumeric: [...uppercase, ...lowercase, ...numbers],
    full: [...uppercase, ...lowercase, ...numbers, ...symbols],
    classic: [...' .:-=+*#%@'],
    blocks: [...'░▒▓█'],
    binary: ['0', '1'],
    hex: [...numbers, ...range('A', 'F')],
} satisfies Record<string, string[]>;

export type CharsetName = keyof typeof CHARSETS;

/**
 * What `chars` accepts:
 * - a charset name: `'numbers'`
 * - several charset names mixed together: `['numbers', 'symbols']`
 * - your own characters: `'abc123'` or `['a', 'b', 'c']`
 */
export type CharsInput = CharsetName | CharsetName[] | string | string[];

export function resolveChars(input: CharsInput = 'default'): string[] {
    const isName = (value: string): value is CharsetName => value in CHARSETS;

    let chars: string[];
    if (typeof input === 'string') {
        chars = isName(input) ? CHARSETS[input] : [...input];
    } else {
        chars = input.flatMap((item) => (isName(item) ? CHARSETS[item] : [item]));
    }

    // Spaces would be invisible, so drop them; fall back to the default set if nothing is left
    chars = [...new Set(chars)].filter((char) => char.trim() !== '');
    return chars.length ? chars : CHARSETS.default;
}
