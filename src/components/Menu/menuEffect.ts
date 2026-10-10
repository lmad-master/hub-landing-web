import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import {
    acquireSmoothScroll,
    getScrollEventTarget,
    getScrollTop,
    releaseSmoothScroll,
} from '../../utils/smoothScroll';

gsap.registerPlugin(SplitText);

export type MenuAlign = 'left' | 'center' | 'right';

export interface MenuOptions {
    /** How much the page shrinks when the menu opens (1 = no change) */
    pageScale: number;
    mobilePageScale: number;
    /** 0–1, how much of the screen the page moves down, which is also the menu's height */
    pageOffset: number;
    mobilePageOffset: number;
    /** Page corner radius while open, any CSS length */
    pageRadius: string;
    /** Seconds the page takes to move */
    duration: number;
    ease: string;
    /** Seconds before the links start rising, and between each link */
    linkDelay: number;
    linkStagger: number;
    /** Seconds each link takes to rise */
    linkDuration: number;
    /** Screens narrower than this use the mobile values */
    mobileBreakpoint: number;
    /** Slide the bar out of the screen while scrolling down */
    hideBarOnScroll: boolean;
    smoothScroll: boolean;
}

export const DEFAULT_OPTIONS: MenuOptions = {
    pageScale: 0.95,
    mobilePageScale: 0.85,
    pageOffset: 0.5,
    mobilePageOffset: 0.65,
    pageRadius: '2rem',
    duration: 1,
    ease: 'power3.inOut',
    linkDelay: 0.65,
    linkStagger: 0.1,
    linkDuration: 1,
    mobileBreakpoint: 1000,
    hideBarOnScroll: true,
    smoothScroll: true,
};

export interface MenuGroup {
    element: HTMLElement;
    align: MenuAlign;
    hideOnScroll: boolean;
}

export interface MenuElements {
    page: HTMLElement;
    panel: HTMLElement;
    bar: HTMLElement;
    groups: () => MenuGroup[];
}

export interface MenuEffect {
    setOpen: (open: boolean) => void;
    destroy: () => void;
}

export function createMenuEffect(elements: MenuElements, options: MenuOptions): MenuEffect {
    const { page, panel, bar } = elements;
    const isMobile = window.matchMedia(`(max-width: ${options.mobileBreakpoint - 1}px)`);
    const lenis = options.smoothScroll ? acquireSmoothScroll() : null;

    // Split every link into words that rise from behind a mask
    const links: { words: Element[]; index: number }[] = [];
    const splits: SplitText[] = [];
    panel.querySelectorAll('[data-menu-column]').forEach((column) => {
        column.querySelectorAll('[data-menu-link]').forEach((link, index) => {
            const split = SplitText.create(link, {
                type: 'words',
                wordsClass: 'menu-word',
                mask: 'words',
            });
            gsap.set(split.words, { yPercent: 100 });
            splits.push(split);
            links.push({ words: split.words, index });
        });
    });

    let isOpen = false;
    let tl: gsap.core.Timeline | undefined;

    function setOpen(open: boolean) {
        if (open === isOpen) return;
        isOpen = open;
        open ? lenis?.stop() : lenis?.start();
        if (open) showBar();

        tl?.kill();
        tl = gsap.timeline();

        const mobile = isMobile.matches;
        tl.to(page, {
            // In pixels: GSAP doesn't reliably convert "svh" units in transforms
            y: open ? window.innerHeight * (mobile ? options.mobilePageOffset : options.pageOffset) : 0,
            scale: open ? (mobile ? options.mobilePageScale : options.pageScale) : 1,
            borderRadius: open ? options.pageRadius : 0,
            duration: options.duration,
            ease: options.ease,
            // A leftover transform would break position: fixed elements inside the page
            onComplete: () => {
                if (!isOpen) gsap.set(page, { clearProps: 'transform,borderRadius' });
            },
        });

        for (const { words, index } of links) {
            tl.to(
                words,
                {
                    yPercent: open ? 0 : 100,
                    duration: open ? options.linkDuration : options.linkDuration * 0.75,
                    ease: 'power3.out',
                },
                open ? options.linkDelay + index * options.linkStagger : 0.1,
            );
        }
    }

    // Hide the bar while scrolling down, show it again when scrolling up
    let isBarHidden = false;

    function barOffset(group: MenuGroup) {
        const { element, align } = group;
        if (align === 'left') return { x: -(element.offsetLeft + element.offsetWidth + 20), y: 0 };
        if (align === 'right') return { x: bar.clientWidth - element.offsetLeft + 20, y: 0 };
        return { x: 0, y: -(element.offsetTop + element.offsetHeight + 20) };
    }

    function setBarHidden(hide: boolean) {
        if (hide === isBarHidden) return;
        isBarHidden = hide;
        for (const group of elements.groups()) {
            if (!group.hideOnScroll) continue;
            const offset = barOffset(group);
            gsap.to(group.element, {
                x: hide ? offset.x : 0,
                y: hide ? offset.y : 0,
                duration: group.align === 'left' ? 1.5 : group.align === 'center' ? 1.2 : 1,
                ease: 'power3.out',
                overwrite: true,
            });
        }
    }

    const showBar = () => setBarHidden(false);

    function onScrollDirection(direction: number) {
        if (isOpen || !options.hideBarOnScroll || direction === 0) return;
        setBarHidden(direction === 1);
    }

    let lastScrollTop = getScrollTop();
    function onNativeScroll() {
        const scrollTop = getScrollTop();
        onScrollDirection(Math.sign(scrollTop - lastScrollTop));
        lastScrollTop = scrollTop;
    }

    const offLenisScroll = lenis?.on('scroll', ({ direction }) => onScrollDirection(direction));
    const scrollTarget = getScrollEventTarget();
    if (!lenis) scrollTarget.addEventListener('scroll', onNativeScroll, { passive: true });

    return {
        setOpen,
        destroy() {
            tl?.kill();
            offLenisScroll?.();
            scrollTarget.removeEventListener('scroll', onNativeScroll);
            gsap.killTweensOf(elements.groups().map((group) => group.element));
            gsap.set(page, { clearProps: 'transform,borderRadius' });
            splits.forEach((split) => split.revert());
            if (lenis) {
                lenis.start();
                releaseSmoothScroll();
            }
        },
    };
}
