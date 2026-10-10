import { createContext } from 'solid-js';
import type { CharsInput } from '../../utils/charsets';

/** Settings that can be different for every image inside an AsciiMorph */
export interface AsciiSlideProps {
    src: string;
    alt?: string;
    /** A charset name, several names, or your own characters. See utils/charsets.ts */
    chars?: CharsInput;
    charColor?: string;
    /** How wide the image is inside the component, any CSS width */
    imageWidth?: string;
    /** 0–1, how opaque (or bright) a pixel must be to become a character */
    threshold?: number;
    /** Use brightness instead of transparency (for photos without a transparent background) */
    useBrightness?: boolean;
}

/** Lets an AsciiImage inside an AsciiMorph register itself as one of its images */
export const AsciiMorphContext = createContext<{
    register: (slide: AsciiSlideProps) => () => void;
}>();
