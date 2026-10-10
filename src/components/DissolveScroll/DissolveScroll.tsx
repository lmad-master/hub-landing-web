import { children, createEffect, onCleanup, splitProps, type JSX } from 'solid-js';
import styles from './DissolveScroll.module.css';
import { createDissolveEffect, DEFAULT_OPTIONS, type DissolveOptions } from './dissolveEffect';
import { resolveChars, type CharsInput } from '../../utils/charsets';

export type DissolveDirection = 'down' | 'up' | 'left' | 'right' | number;

const DIRECTION_ANGLES = { up: 0, right: 90, down: 180, left: 270 };

export type DissolveScrollProps = Partial<Omit<DissolveOptions, 'chars' | 'angle'>> & {
    /** Each direct child is one panel, the first one is shown first */
    children: JSX.Element;
    /** A charset name, several names, or your own characters. See utils/charsets.ts */
    chars?: CharsInput;
    /** 'down' | 'up' | 'left' | 'right', or degrees like CSS gradients (135 = towards bottom-right) */
    direction?: DissolveDirection;
    /** Height of the pinned area, any CSS height */
    height?: string;
    class?: string;
    style?: JSX.CSSProperties;
};

function DissolveScroll(props: DissolveScrollProps) {
    const [local, effectProps] = splitProps(props, ['children', 'chars', 'direction', 'height', 'class', 'style']);
    const panels = children(() => local.children);

    let rootRef!: HTMLDivElement;
    let panelsRef!: HTMLDivElement;
    let gridRef!: HTMLDivElement;

    // Restarts the effect whenever a prop or the panels change
    createEffect(() => {
        panels();
        const direction = local.direction ?? 'down';
        const options: DissolveOptions = {
            ...DEFAULT_OPTIONS,
            ...Object.fromEntries(Object.entries(effectProps).filter(([, value]) => value !== undefined)),
            chars: resolveChars(local.chars),
            angle: typeof direction === 'number' ? direction : DIRECTION_ANGLES[direction],
        };
        onCleanup(createDissolveEffect(rootRef, panelsRef, gridRef, styles.cell, options));
    });

    return (
        <div
            ref={rootRef}
            class={`${styles.root} ${local.class ?? ''}`}
            style={{ height: local.height ?? '100svh', ...local.style }}
        >
            <div ref={panelsRef} class={styles.panels}>
                {panels()}
            </div>
            <div ref={gridRef} class={styles.grid}></div>
        </div>
    );
}

export { DissolveScroll };
