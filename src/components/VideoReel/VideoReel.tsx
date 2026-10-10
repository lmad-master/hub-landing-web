import { createSignal, onCleanup, onMount, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './VideoReel.module.css';
import { getScroller, getSmoothScroll } from '../../utils/smoothScroll';

gsap.registerPlugin(Flip, ScrollTrigger);

export interface VideoReelProps {
    src: string;
    poster?: string;
    /** The text shown next to the video */
    children?: JSX.Element;
    /** Label of the button that opens the big view */
    expandLabel?: string;
    /** Which side the video goes on (desktop) */
    videoSide?: 'left' | 'right';
    /** The video grows slightly while it scrolls into view */
    scrollZoom?: boolean;
    id?: string;
    class?: string;
}

function VideoReel(props: VideoReelProps) {
    const [isExpanded, setIsExpanded] = createSignal(false);
    let sectionRef!: HTMLElement;
    let frameRef!: HTMLDivElement;
    let slotRef!: HTMLDivElement;
    let videoRef!: HTMLVideoElement;
    let overlayRef!: HTMLDivElement;
    let stageRef!: HTMLDivElement;
    let closeRef!: HTMLButtonElement;
    let expandRef!: HTMLButtonElement;

    // Moves the video between its spot in the page and the big view, animating the change
    function setExpanded(expand: boolean) {
        if (expand === isExpanded()) return;
        const state = Flip.getState(videoRef);
        setIsExpanded(expand);

        if (expand) {
            overlayRef.hidden = false;
            stageRef.appendChild(videoRef);
            videoRef.muted = false;
            videoRef.controls = true;
            void videoRef.play().catch(() => {});
            getSmoothScroll()?.stop();
            gsap.fromTo(overlayRef, { opacity: 0 }, { opacity: 1, duration: 0.4 });
            Flip.from(state, { duration: 0.8, ease: 'power3.inOut', scale: false, onComplete: () => closeRef.focus() });
        } else {
            slotRef.appendChild(videoRef);
            videoRef.muted = true;
            videoRef.controls = false;
            getSmoothScroll()?.start();
            gsap.to(overlayRef, { opacity: 0, duration: 0.4, delay: 0.3 });
            Flip.from(state, {
                duration: 0.8,
                ease: 'power3.inOut',
                scale: false,
                onComplete: () => {
                    overlayRef.hidden = true;
                    expandRef.focus();
                },
            });
        }
    }

    onMount(() => {
        // Only play (and download) the preview while it's on screen
        const visibilityObserver = new IntersectionObserver(([entry]) => {
            if (isExpanded()) return;
            if (entry.isIntersecting) void videoRef.play().catch(() => {});
            else videoRef.pause();
        }, { threshold: 0.25 });
        visibilityObserver.observe(frameRef);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isExpanded()) setExpanded(false);
        };
        window.addEventListener('keydown', onKeyDown);

        const zoom = (props.scrollZoom ?? true)
            ? gsap.fromTo(frameRef, { scale: 0.85 }, {
                  scale: 1,
                  ease: 'none',
                  scrollTrigger: {
                      trigger: sectionRef,
                      scroller: getScroller(),
                      start: 'top bottom',
                      end: 'center center',
                      scrub: true,
                  },
              })
            : undefined;

        onCleanup(() => {
            visibilityObserver.disconnect();
            window.removeEventListener('keydown', onKeyDown);
            zoom?.scrollTrigger?.kill();
            zoom?.kill();
            if (isExpanded()) {
                getSmoothScroll()?.start();
                slotRef.appendChild(videoRef);
            }
        });
    });

    return (
        <section
            ref={sectionRef}
            id={props.id}
            class={`${styles.reel} ${props.class ?? ''}`}
            data-video-side={props.videoSide ?? 'right'}
        >
            <div class={styles.text}>
                {props.children}
                <button ref={expandRef} type="button" class={styles.expand} onClick={() => setExpanded(true)}>
                    <span class={styles.playIcon} aria-hidden="true"></span>
                    {props.expandLabel ?? 'Ver en grande'}
                </button>
            </div>

            <div ref={frameRef} class={styles.frame}>
                {/* Keeps the space while the video is in the big view */}
                <div ref={slotRef} class={styles.slot}>
                    <video
                        ref={videoRef}
                        class={styles.video}
                        src={props.src}
                        poster={props.poster}
                        muted
                        loop
                        playsinline
                        preload="metadata"
                    />
                </div>
                <button type="button" class={styles.frameButton} aria-label={props.expandLabel ?? 'Ver en grande'} onClick={() => setExpanded(true)} />
            </div>

            <Portal>
                <div
                    ref={overlayRef}
                    class={styles.overlay}
                    hidden
                    role="dialog"
                    aria-modal="true"
                    aria-label="Video"
                    onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
                >
                    <div ref={stageRef} class={styles.stage}></div>
                    <button ref={closeRef} type="button" class={styles.close} onClick={() => setExpanded(false)}>
                        Cerrar <span aria-hidden="true">✕</span>
                    </button>
                </div>
            </Portal>
        </section>
    );
}

export { VideoReel };
