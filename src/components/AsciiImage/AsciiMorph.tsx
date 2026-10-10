import { createEffect, createSignal, For, onCleanup, type JSX } from 'solid-js';
import styles from './AsciiImage.module.css';
import { AsciiMorphContext, type AsciiSlideProps } from './context';
import { createAsciiEngine, DEFAULT_OPTIONS, type AsciiEngineOptions, type AsciiSlideConfig } from './asciiEngine';
import { resolveChars, type CharsInput } from '../../utils/charsets';

export type AsciiMorphProps = Partial<AsciiEngineOptions> & {
    /** The AsciiImage components to transform between, in order */
    children?: JSX.Element;
    /** Defaults for every image, each AsciiImage can override them */
    chars?: CharsInput;
    charColor?: string;
    imageWidth?: string;
    threshold?: number;
    useBrightness?: boolean;
    /** Height of the component, any CSS height. Defaults to 100svh in scroll mode, otherwise fills its parent */
    height?: string;
    class?: string;
    style?: JSX.CSSProperties;
    /** @internal used by a standalone AsciiImage */
    slides?: AsciiSlideProps[];
};

const ENGINE_OPTION_KEYS = Object.keys(DEFAULT_OPTIONS) as (keyof AsciiEngineOptions)[];

function AsciiMorph(props: AsciiMorphProps) {
    const [registered, setRegistered] = createSignal<AsciiSlideProps[]>([]);
    const register = (slide: AsciiSlideProps) => {
        setRegistered((slides) => [...slides, slide]);
        return () => setRegistered((slides) => slides.filter((item) => item !== slide));
    };
    const slides = () => props.slides ?? registered();

    let rootRef!: HTMLDivElement;
    let canvasRef!: HTMLCanvasElement;
    const imgRefs: HTMLImageElement[] = [];

    // Restarts the effect whenever a prop or one of the images changes
    createEffect(() => {
        const list = slides();
        if (!list.length) return;

        const options = { ...DEFAULT_OPTIONS };
        for (const key of ENGINE_OPTION_KEYS) {
            if (props[key] !== undefined) (options as Record<string, unknown>)[key] = props[key];
        }

        const slideConfigs: AsciiSlideConfig[] = list.map((slide, i) => {
            slide.src;
            slide.imageWidth;
            return {
                img: imgRefs[i],
                chars: resolveChars(slide.chars ?? props.chars),
                charColor: slide.charColor ?? props.charColor ?? 'var(--color-ascii-char, #dadada)',
                threshold: slide.threshold ?? props.threshold ?? 0.5,
                useBrightness: slide.useBrightness ?? props.useBrightness ?? false,
            };
        });

        onCleanup(createAsciiEngine(rootRef, canvasRef, slideConfigs, options));
    });

    const label = () => slides().map((slide) => slide.alt).filter(Boolean).join(', ');

    return (
        <AsciiMorphContext.Provider value={{ register }}>
            <div
                ref={rootRef}
                class={`${styles.container} ${props.class ?? ''}`}
                style={{ height: props.height ?? (props.mode === 'scroll' ? '100svh' : '100%'), ...props.style }}
            >
                <canvas ref={canvasRef} class={styles.canvas} role="img" aria-label={label()}></canvas>
                <For each={slides()}>
                    {(slide, i) => (
                        <div class={styles.image} style={{ width: slide.imageWidth ?? props.imageWidth ?? '75%' }}>
                            <img ref={(el) => (imgRefs[i()] = el)} src={slide.src} alt="" />
                        </div>
                    )}
                </For>
                {props.children}
            </div>
        </AsciiMorphContext.Provider>
    );
}

export { AsciiMorph };
