import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

// Mobile browsers resize the viewport when the address bar shows/hides;
// without this every scroll on a phone triggers a full ScrollTrigger refresh
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * The element that scrolls the page. null means the window.
 * The Menu sets it, because its page wrapper is its own scroll container.
 */
let scroller: HTMLElement | null = null;
/**
 * The element inside the scroller that holds the content. Lenis watches its size to
 * know how far it can scroll, so it must grow with the page (the scroller itself doesn't).
 */
let scrollContent: HTMLElement | null = null;

export function setScroller(element: HTMLElement | null, content: HTMLElement | null = null) {
    scroller = element;
    scrollContent = content;
}

/** Pass this as ScrollTrigger's `scroller` (undefined = window) */
export function getScroller(): HTMLElement | undefined {
    return scroller ?? undefined;
}

/** Where to listen for native `scroll` events */
export function getScrollEventTarget(): HTMLElement | Window {
    return scroller ?? window;
}

export function getScrollTop(): number {
    return scroller ? scroller.scrollTop : window.scrollY;
}

/** Scrolls the page, smoothly with Lenis when it's running */
export function scrollToY(y: number, { immediate = false, duration }: { immediate?: boolean; duration?: number } = {}) {
    if (lenis) {
        lenis.scrollTo(y, { immediate, duration, force: true });
        return;
    }
    (scroller ?? window).scrollTo({ top: y, behavior: immediate ? 'instant' : 'smooth' });
}

// One shared Lenis instance, no matter how many components ask for it
let lenis: Lenis | null = null;
let users = 0;

const tick = (time: number) => lenis?.raf(time * 1000);

/** The running Lenis instance, if any (e.g. to stop scrolling while a modal is open) */
export function getSmoothScroll(): Lenis | null {
    return lenis;
}

export function acquireSmoothScroll(): Lenis {
    if (!lenis) {
        lenis = new Lenis(scroller ? { wrapper: scroller, content: scrollContent ?? scroller } : undefined);
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
    }
    users++;
    return lenis;
}

export function releaseSmoothScroll() {
    users = Math.max(0, users - 1);
    if (users > 0 || !lenis) return;
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    lenis.destroy();
    lenis = null;
}
