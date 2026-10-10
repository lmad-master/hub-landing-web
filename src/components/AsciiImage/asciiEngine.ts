import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { acquireSmoothScroll, getScroller, releaseSmoothScroll } from '../../utils/smoothScroll';

gsap.registerPlugin(ScrollTrigger);

/** What makes the images change: a timer that loops forever, or the scroll position */
export type MorphMode = 'loop' | 'scroll';

/**
 * - morph: every character travels to the matching part of the next image
 * - scatter: characters fly to random places of the next image
 * - scramble: characters stay in place and decode into the next image
 */
export type MorphTransition = 'morph' | 'scatter' | 'scramble';

export interface AsciiEngineOptions {
    cellSize: number;
    cellGap: number;
    mobileCellSize: number;
    mobileCellGap: number;
    mobileBreakpoint: number;
    gridColor: string;
    pushRadius: number;
    pushForce: number;
    spring: number;
    damping: number;
    /** Milliseconds between character shuffles, 0 disables shuffling */
    shuffleInterval: number;
    interactive: boolean;

    mode: MorphMode;
    transition: MorphTransition;
    /** loop mode: milliseconds each image stays before transforming */
    interval: number;
    /** loop mode: milliseconds a transformation takes */
    duration: number;
    /** 0–1, how spread out in time the characters start moving */
    stagger: number;
    /** How far (in cells) characters swing off their straight path */
    turbulence: number;
    /** loop mode: pause while the pointer is over the image */
    pauseOnHover: boolean;
    /** scroll mode: screens of scrolling per transformation */
    scrollLength: number;
    /** scroll mode: use Lenis smooth scrolling */
    smoothScroll: boolean;
}

export const DEFAULT_OPTIONS: AsciiEngineOptions = {
    cellSize: 8,
    cellGap: 2,
    mobileCellSize: 3,
    mobileCellGap: 1,
    mobileBreakpoint: 768,
    gridColor: 'var(--color-ascii-grid, #171717)',
    pushRadius: 5,
    pushForce: 30,
    spring: 0.025,
    damping: 0.5,
    shuffleInterval: 50,
    interactive: true,

    mode: 'loop',
    transition: 'morph',
    interval: 3000,
    duration: 1500,
    stagger: 0.4,
    turbulence: 4,
    pauseOnHover: false,
    scrollLength: 1,
    smoothScroll: true,
};

export interface AsciiSlideConfig {
    /** Hidden <img> laid out where the image should appear */
    img: HTMLImageElement;
    chars: string[];
    charColor: string;
    /** 0–1, how opaque (or bright) a pixel must be to become a character */
    threshold: number;
    /** Use brightness instead of transparency to decide which cells are part of the image */
    useBrightness: boolean;
}

/** The lit cells of one image */
interface SampledSlide {
    col: Int16Array;
    row: Int16Array;
    count: number;
    chars: string[];
    liveChars: string[];
    color: [number, number, number];
}

/** How every character moves from one image to the next */
interface Plan {
    from: number;
    to: number;
    count: number;
    fromX: Float32Array;
    fromY: Float32Array;
    toX: Float32Array;
    toY: Float32Array;
    /** Index of the character in the "from" / "to" image, -1 when it doesn't exist there */
    fromChar: Int32Array;
    toChar: Int32Array;
    delay: Float32Array;
    swingX: Float32Array;
    swingY: Float32Array;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Position along a Hilbert curve, keeps nearby cells close together when sorting */
function hilbertIndex(n: number, x: number, y: number) {
    let d = 0;
    for (let s = n >> 1; s > 0; s >>= 1) {
        const rx = (x & s) > 0 ? 1 : 0;
        const ry = (y & s) > 0 ? 1 : 0;
        d += s * s * ((3 * rx) ^ ry);
        if (ry === 0) {
            if (rx === 1) {
                x = n - 1 - x;
                y = n - 1 - y;
            }
            const temp = x;
            x = y;
            y = temp;
        }
    }
    return d;
}

/** Orders the cells so the left/top of one image maps onto the left/top of the other */
function spatialOrder(slide: SampledSlide): Uint32Array {
    let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
    for (let i = 0; i < slide.count; i++) {
        minCol = Math.min(minCol, slide.col[i]);
        maxCol = Math.max(maxCol, slide.col[i]);
        minRow = Math.min(minRow, slide.row[i]);
        maxRow = Math.max(maxRow, slide.row[i]);
    }
    const N = 64;
    const keys = new Float64Array(slide.count);
    for (let i = 0; i < slide.count; i++) {
        const x = Math.round(((slide.col[i] - minCol) / (maxCol - minCol || 1)) * (N - 1));
        const y = Math.round(((slide.row[i] - minRow) / (maxRow - minRow || 1)) * (N - 1));
        keys[i] = hilbertIndex(N, x, y);
    }
    return new Uint32Array(slide.count).map((_, i) => i).sort((a, b) => keys[a] - keys[b]);
}

function shuffledOrder(count: number): Uint32Array {
    const order = new Uint32Array(count).map((_, i) => i);
    for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function createPlan(from: number, to: number, count: number): Plan {
    return {
        from, to, count,
        fromX: new Float32Array(count), fromY: new Float32Array(count),
        toX: new Float32Array(count), toY: new Float32Array(count),
        fromChar: new Int32Array(count), toChar: new Int32Array(count),
        delay: new Float32Array(count),
        swingX: new Float32Array(count), swingY: new Float32Array(count),
    };
}

/** Starts the effect and returns a function that stops it. */
export function createAsciiEngine(
    root: HTMLElement,
    canvas: HTMLCanvasElement,
    slides: AsciiSlideConfig[],
    options: AsciiEngineOptions,
): () => void {
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const slideCount = slides.length;
    const isScrollMode = options.mode === 'scroll' && slideCount > 1;

    let cellSize = options.cellSize;
    let cellStep = options.cellSize + options.cellGap;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let sampled: SampledSlide[] = [];
    let plans: Plan[] = [];
    let offsetX = new Float32Array(0);
    let offsetY = new Float32Array(0);
    let velX = new Float32Array(0);
    let velY = new Float32Array(0);
    let ready = false;
    let disposed = false;

    function setupCanvas() {
        const isMobile = window.innerWidth < options.mobileBreakpoint;
        cellSize = isMobile ? options.mobileCellSize : options.cellSize;
        cellStep = cellSize + (isMobile ? options.mobileCellGap : options.cellGap);

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        width = rect.width;
        height = rect.height;
        cols = Math.floor(width / cellStep);
        rows = Math.floor(height / cellStep);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** The canvas doesn't understand CSS variables, so let the browser resolve them first */
    function resolveCssColor(color: string): string {
        if (!color.includes('var(')) return color;
        const probe = document.createElement('span');
        probe.style.color = color;
        root.appendChild(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
    }

    let gridColor = options.gridColor;

    function parseColor(color: string): [number, number, number] {
        ctx.fillStyle = '#000';
        ctx.fillStyle = resolveCssColor(color);
        const value = ctx.fillStyle;
        if (value.startsWith('#')) {
            return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
        }
        const [r, g, b] = value.match(/[\d.]+/g)!.map(Number);
        return [r, g, b];
    }

    function sampleSlide(slide: AsciiSlideConfig): SampledSlide {
        const canvasRect = canvas.getBoundingClientRect();
        const rect = slide.img.getBoundingClientRect();
        const logoCols = Math.ceil(rect.width / cellStep);
        const logoRows = Math.ceil(rect.height / cellStep);
        const startCol = Math.floor((rect.left - canvasRect.left) / cellStep);
        const startRow = Math.floor((rect.top - canvasRect.top) / cellStep);
        const { chars } = slide;

        const litCols: number[] = [];
        const litRows: number[] = [];
        const litChars: string[] = [];

        if (logoCols > 0 && logoRows > 0) {
            const sampleCanvas = document.createElement('canvas');
            sampleCanvas.width = logoCols;
            sampleCanvas.height = logoRows;
            const sampleCtx = sampleCanvas.getContext('2d')!;
            sampleCtx.drawImage(slide.img, 0, 0, logoCols, logoRows);
            const { data } = sampleCtx.getImageData(0, 0, logoCols, logoRows);

            for (let y = 0; y < logoRows; y++) {
                for (let x = 0; x < logoCols; x++) {
                    const col = startCol + x;
                    const row = startRow + y;
                    if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

                    const idx = (y * logoCols + x) * 4;
                    const alpha = data[idx + 3] / 255;
                    const brightness =
                        (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
                    const isLit = (slide.useBrightness ? brightness * alpha : alpha) > slide.threshold;
                    if (!isLit) continue;

                    litCols.push(col);
                    litRows.push(row);
                    litChars.push(chars[Math.min(chars.length - 1, Math.floor(brightness * chars.length))]);
                }
            }
        }

        return {
            col: Int16Array.from(litCols),
            row: Int16Array.from(litRows),
            count: litCols.length,
            chars,
            liveChars: litChars,
            color: parseColor(slide.charColor),
        };
    }

    /** Characters stay in their cell and decode into the next image */
    function buildScramblePlan(from: number, to: number): Plan {
        const a = sampled[from];
        const b = sampled[to];
        const cells = new Map<number, [number, number]>();
        for (let i = 0; i < a.count; i++) cells.set(a.row[i] * cols + a.col[i], [i, -1]);
        for (let i = 0; i < b.count; i++) {
            const key = b.row[i] * cols + b.col[i];
            const existing = cells.get(key);
            if (existing) existing[1] = i;
            else cells.set(key, [-1, i]);
        }

        const plan = createPlan(from, to, cells.size);
        let k = 0;
        for (const [key, [fromIndex, toIndex]] of cells) {
            const col = key % cols;
            const row = Math.floor(key / cols);
            plan.fromX[k] = plan.toX[k] = col;
            plan.fromY[k] = plan.toY[k] = row;
            plan.fromChar[k] = fromIndex;
            plan.toChar[k] = toIndex;
            plan.delay[k] = Math.random() * options.stagger;
            k++;
        }
        return plan;
    }

    function buildPlan(from: number, to: number): Plan {
        const a = sampled[from];
        const b = sampled[to];
        if (options.transition === 'scramble' || from === to || a.count === 0 || b.count === 0) {
            return buildScramblePlan(from, to);
        }

        const isScatter = options.transition === 'scatter';
        // When one image has more characters, some characters split/merge so both
        // images look exactly right at the start and end of the transformation
        const count = Math.max(a.count, b.count);
        const orderA = spatialOrder(a);
        const orderB = isScatter ? shuffledOrder(b.count) : spatialOrder(b);
        const plan = createPlan(from, to, count);

        for (let k = 0; k < count; k++) {
            const fromIndex = orderA[Math.floor((k * a.count) / count)];
            const toIndex = orderB[Math.floor((k * b.count) / count)];
            plan.fromX[k] = a.col[fromIndex];
            plan.fromY[k] = a.row[fromIndex];
            plan.toX[k] = b.col[toIndex];
            plan.toY[k] = b.row[toIndex];
            plan.fromChar[k] = fromIndex;
            plan.toChar[k] = toIndex;

            // morph sweeps from left to right, scatter starts randomly
            plan.delay[k] = isScatter
                ? Math.random() * options.stagger
                : ((plan.fromX[k] + plan.toX[k]) / 2 / Math.max(1, cols)) * options.stagger;

            const angle = Math.random() * Math.PI * 2;
            const swing = options.turbulence * (0.5 + Math.random() * 0.5) * (isScatter ? 2 : 1);
            plan.swingX[k] = Math.cos(angle) * swing;
            plan.swingY[k] = Math.sin(angle) * swing;
        }
        return plan;
    }

    function layout() {
        gridColor = resolveCssColor(options.gridColor);
        setupCanvas();
        sampled = slides.map(sampleSlide);
        plans = slideCount > 1
            ? slides.map((_, i) => buildPlan(i, (i + 1) % slideCount))
            : [buildPlan(0, 0)];

        const maxCount = Math.max(...plans.map((plan) => plan.count), 0);
        if (maxCount > offsetX.length) {
            offsetX = new Float32Array(maxCount);
            offsetY = new Float32Array(maxCount);
            velX = new Float32Array(maxCount);
            velY = new Float32Array(maxCount);
        }
    }

    const mouse = { col: -999, row: -999, isMoving: false };
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    function onPointerMove(e: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        mouse.col = (e.clientX - rect.left) / cellStep;
        mouse.row = (e.clientY - rect.top) / cellStep;
        mouse.isMoving = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => (mouse.isMoving = false), 100);
    }

    let isHovering = false;
    function onPointerEnter() {
        isHovering = true;
    }
    function onPointerLeave() {
        isHovering = false;
        mouse.isMoving = false;
        mouse.col = mouse.row = -999;
    }

    function updatePhysics(k: number, x: number, y: number) {
        const { pushRadius, pushForce, spring, damping } = options;
        if (mouse.isMoving) {
            const dx = x + offsetX[k] - mouse.col;
            const dy = y + offsetY[k] - mouse.row;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < pushRadius && dist > 0) {
                const force = (1 - dist / pushRadius) ** 2 * pushForce;
                velX[k] += (dx / dist) * force;
                velY[k] += (dy / dist) * force;
            }
        }
        velX[k] += -offsetX[k] * spring;
        velY[k] += -offsetY[k] * spring;
        velX[k] *= damping;
        velY[k] *= damping;
        offsetX[k] += velX[k];
        offsetY[k] += velY[k];
        if (Math.abs(offsetX[k]) < 0.01 && Math.abs(velX[k]) < 0.01) offsetX[k] = 0;
        if (Math.abs(offsetY[k]) < 0.01 && Math.abs(velY[k]) < 0.01) offsetY[k] = 0;
    }

    /** Draws a plan at transition progress t (0 = "from" image, 1 = "to" image) */
    function renderPlan(plan: Plan, t: number) {
        ctx.font = `${cellSize + 2}px monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = gridColor;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                ctx.fillRect(col * cellStep, row * cellStep, cellSize, cellSize);
            }
        }

        const a = sampled[plan.from];
        const b = sampled[plan.to];
        const span = Math.max(0.001, 1 - options.stagger);

        // Pre-computed colors between both images, so we don't build strings per character
        const sameColor = a.color.every((value, i) => value === b.color[i]);
        const colorSteps = sameColor ? 1 : 32;
        const colors = Array.from({ length: colorSteps + 1 }, (_, step) => {
            const mix = step / colorSteps;
            const [r, g, bl] = a.color.map((value, i) => Math.round(value + (b.color[i] - value) * mix));
            return `rgb(${r}, ${g}, ${bl})`;
        });
        let currentColor = '';

        for (let k = 0; k < plan.count; k++) {
            const local = clamp01((t - plan.delay[k]) / span);
            const eased = easeInOutCubic(local);
            const swing = Math.sin(Math.PI * eased);
            const x = plan.fromX[k] + (plan.toX[k] - plan.fromX[k]) * eased + plan.swingX[k] * swing;
            const y = plan.fromY[k] + (plan.toY[k] - plan.fromY[k]) * eased + plan.swingY[k] * swing;

            if (options.interactive) updatePhysics(k, x, y);

            let char: string;
            if (local <= 0) {
                if (plan.fromChar[k] < 0) continue;
                char = a.liveChars[plan.fromChar[k]];
            } else if (local >= 1) {
                if (plan.toChar[k] < 0) continue;
                char = b.liveChars[plan.toChar[k]];
            } else {
                // Mid-flight characters keep changing
                char = b.chars[Math.floor(Math.random() * b.chars.length)];
            }

            const color = colors[sameColor ? 0 : Math.round(eased * colorSteps)];
            if (color !== currentColor) {
                ctx.fillStyle = color;
                currentColor = color;
            }

            const drawX = Math.round(x + offsetX[k]) * cellStep;
            const drawY = Math.round(y + offsetY[k]) * cellStep;
            ctx.fillText(char, drawX + cellSize / 2, drawY + cellSize / 2);
        }
    }

    // Shuffle the characters of every image; the animation loop takes care of drawing
    const shuffleTimer =
        options.shuffleInterval > 0
            ? setInterval(() => {
                  for (const slide of sampled) {
                      for (let i = 0; i < slide.count; i++) {
                          slide.liveChars[i] = slide.chars[Math.floor(Math.random() * slide.chars.length)];
                      }
                  }
              }, options.shuffleInterval)
            : undefined;

    // Loop mode timeline
    let currentSlide = 0;
    let phase: 'hold' | 'morph' = 'hold';
    let phaseStart = performance.now();
    let lastFrame = phaseStart;
    let scrollProgress = 0;
    let isVisible = true;

    let frameId: number;
    function animationLoop(now: number) {
        frameId = requestAnimationFrame(animationLoop);
        const delta = now - lastFrame;
        lastFrame = now;

        // Freeze the timeline while hidden, paused, or after the tab was in the background
        const paused = !ready || !isVisible || (options.pauseOnHover && isHovering);
        if (paused || delta > 250) phaseStart += delta;
        if (!ready || !isVisible) return;

        if (isScrollMode) {
            const raw = scrollProgress * (slideCount - 1);
            const index = Math.min(Math.floor(raw), slideCount - 2);
            renderPlan(plans[index], raw - index);
            return;
        }

        if (slideCount < 2) {
            renderPlan(plans[0], 0);
            return;
        }

        let elapsed = now - phaseStart;
        if (phase === 'hold' && elapsed >= options.interval) {
            phase = 'morph';
            phaseStart = now;
            elapsed = 0;
        }
        if (phase === 'morph' && elapsed >= options.duration) {
            currentSlide = (currentSlide + 1) % slideCount;
            phase = 'hold';
            phaseStart = now;
            elapsed = 0;
        }
        renderPlan(plans[currentSlide], phase === 'morph' ? elapsed / options.duration : 0);
    }

    // Re-sample whenever the canvas changes size (window resize, layout changes, etc.)
    const resizeObserver = new ResizeObserver(() => {
        if (ready) layout();
    });
    resizeObserver.observe(canvas);

    // Don't spend time drawing while the effect is off screen
    const visibilityObserver = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
    });
    visibilityObserver.observe(root);

    if (options.interactive) {
        window.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerleave', onPointerLeave);
    }
    canvas.addEventListener('pointerenter', onPointerEnter);

    let lenis: ReturnType<typeof acquireSmoothScroll> | null = null;
    let trigger: ScrollTrigger | null = null;
    if (isScrollMode) {
        if (options.smoothScroll) lenis = acquireSmoothScroll();
        trigger = ScrollTrigger.create({
            trigger: root,
            scroller: getScroller(),
            start: 'top top',
            end: () => `+=${(slideCount - 1) * root.clientHeight * options.scrollLength}`,
            pin: true,
            pinSpacing: true,
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => (scrollProgress = self.progress),
        });
        scrollProgress = trigger.progress;
    }

    const waitForImage = (img: HTMLImageElement) =>
        img.complete && img.naturalWidth
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), { once: true });
              });

    Promise.all(slides.map((slide) => waitForImage(slide.img))).then(() => {
        if (disposed) return;
        layout();
        ready = true;
    });

    frameId = requestAnimationFrame(animationLoop);

    return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearInterval(shuffleTimer);
        clearTimeout(idleTimer);
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        canvas.removeEventListener('pointerenter', onPointerEnter);
        trigger?.kill();
        if (lenis) releaseSmoothScroll();
    };
}
