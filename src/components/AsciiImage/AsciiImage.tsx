import { onCleanup, useContext } from 'solid-js';
import { AsciiMorph, type AsciiMorphProps } from './AsciiMorph';
import { AsciiMorphContext, type AsciiSlideProps } from './context';

export type AsciiImageProps = AsciiSlideProps & Omit<AsciiMorphProps, 'children' | 'slides'>;

/**
 * On its own it renders the ASCII effect for one image.
 * Inside an <AsciiMorph> it becomes one of the images it transforms between,
 * and only the per-image props (src, alt, chars, charColor, imageWidth, threshold, useBrightness) are used.
 */
function AsciiImage(props: AsciiImageProps) {
    const morph = useContext(AsciiMorphContext);
    if (morph) {
        onCleanup(morph.register(props));
        return null;
    }

    return <AsciiMorph {...props} slides={[props]} />;
}

export { AsciiImage };
