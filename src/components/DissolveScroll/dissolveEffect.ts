import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    acquireSmoothScroll,
    getScrollEventTarget,
    getScroller,
    getScrollTop,
    releaseSmoothScroll,
} from '../../utils/smoothScroll';

gsap.registerPlugin(ScrollTrigger);

export interface DissolveOptions {
    chars: string[];
    /** Direction the band travels, in degrees like CSS gradients: 180 = down, 0 = up, 90 = right, 270 = left */
    angle: number;
    cellSize: number;
    /** Font size relative to the cell size */
    fontScale: number;
    charColor: string;
    cellColor: string;
    /** How far the band reaches behind / ahead of its center (0–1 of the section) */
    spreadBehind: number;
    spreadAhead: number;
    scatter: number;
    solidCoreRadius: number;
    minScatterAtCenter: number;
    visibilityThreshold: number;
    /** Screens of scrolling per transition */
    scrollLength: number;
    /** Snap to the next panel when the user stops scrolling */
    snap: boolean;
    /** Seconds the snap animation takes */
    snapDuration: number;
    /** Milliseconds to wait after the user stops scrolling before snapping */
    snapDelay: number;
    /** 0–1, how much of a transition the user must scroll before it snaps to the next panel instead of going back */
    snapThreshold: number;
    /** Use Lenis smooth scrolling */
    smoothScroll: boolean;
}

export const DEFAULT_OPTIONS: Omit<DissolveOptions, 'chars'> = {
    angle: 180,
    cellSize: 16,
    fontScale: 0.7,
    charColor: '#000',
    cellColor: '#ff6426',
    spreadBehind: 0.25,
    spreadAhead: 0.25,
    scatter: 0.15,
    solidCoreRadius: 0.025,
    minScatterAtCenter: 0.1,
    visibilityThreshold: 0.65,
    scrollLength: 1,
    snap: false,
    snapDuration: 0.6,
    snapDelay: 150,
    snapThreshold: 0.3,
    smoothScroll: true,
};

function hashFromPosition(row: number, col: number, seed: number) {
    const raw = Math.sin(row * seed + col * (seed * 2.45)) * 43758.5453;
    return raw - Math.floor(raw);
}

/**
 * Pins `root` and dissolves each child of `panelsWrap` into the next one while scrolling.
 * Returns a cleanup function.
 */
export function createDissolveEffect(
    root: HTMLElement,
    panelsWrap: HTMLElement,
    grid: HTMLElement,
    cellClass: string,
    options: DissolveOptions,
): () => void {
    const panels = Array.from(panelsWrap.children) as HTMLElement[];
    const totalPanels = panels.length;
    const totalTransitions = totalPanels - 1;
    if (totalTransitions < 1) return () => {};

    const { chars, cellSize, spreadBehind, spreadAhead } = options;
    const lenis = options.smoothScroll ? acquireSmoothScroll() : null;

    grid.style.setProperty('--dissolve-cell-color', options.cellColor);
    grid.style.setProperty('--dissolve-char-color', options.charColor);

    panels.forEach((panel, index) => {
        panel.style.zIndex = String(totalPanels - index);
    });

    // Unit vector of the travel direction (screen coordinates, y grows downwards)
    const radians = (options.angle * Math.PI) / 180;
    const dirX = Math.sin(radians);
    const dirY = -Math.cos(radians);

    const totalTravelRange = 1 + spreadBehind + spreadAhead;

    let width = 0;
    let height = 0;
    let projectionLength = 1;
    let cols = 0;
    let rows = 0;
    let cellElements: HTMLDivElement[] = [];
    let cellPosition = new Float32Array(0);
    let cellScatterOffset = new Float32Array(0);
    let cellVisibilityRandom = new Float32Array(0);
    let cellVisible = new Uint8Array(0);
    let activeTransitionIndex = -1;
    let lastProgress = 0;

    const getRandomCharacter = () => chars[Math.floor(Math.random() * chars.length)];

    /** 0 at the side where the band starts, 1 at the side where it ends */
    const project = (x: number, y: number) =>
        ((x - width / 2) * dirX + (y - height / 2) * dirY) / projectionLength + 0.5;

    function buildGrid() {
        width = root.clientWidth;
        height = root.clientHeight;
        projectionLength = Math.abs(width * dirX) + Math.abs(height * dirY) || 1;

        const newCols = Math.ceil(width / cellSize);
        const newRows = Math.ceil(height / cellSize);

        // Only recreate the cells when the grid really changes size
        if (newCols !== cols || newRows !== rows) {
            cols = newCols;
            rows = newRows;
            const fontSize = Math.round(cellSize * options.fontScale);
            const fragment = document.createDocumentFragment();
            cellElements = [];

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const cell = document.createElement('div');
                    cell.className = cellClass;
                    cell.style.left = `${col * cellSize}px`;
                    cell.style.top = `${row * cellSize}px`;
                    cell.style.width = `${cellSize}px`;
                    cell.style.height = `${cellSize}px`;
                    cell.style.fontSize = `${fontSize}px`;
                    cell.textContent = getRandomCharacter();
                    fragment.appendChild(cell);
                    cellElements.push(cell);
                }
            }
            grid.replaceChildren(fragment);

            const count = cols * rows;
            cellScatterOffset = new Float32Array(count);
            cellVisible = new Uint8Array(count);
            for (let i = 0; i < count; i++) {
                cellScatterOffset[i] =
                    (hashFromPosition(Math.floor(i / cols), i % cols, 269.3) - 0.5) * options.scatter;
            }
            activeTransitionIndex = -1;
        }

        cellPosition = new Float32Array(cols * rows);
        for (let i = 0; i < cellPosition.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            cellPosition[i] = project((col + 0.5) * cellSize, (row + 0.5) * cellSize);
        }
    }

    // Each transition gets a different pattern and fresh characters
    function onTransitionChange(newIndex: number) {
        activeTransitionIndex = newIndex;
        cellVisibilityRandom = new Float32Array(cellElements.length);
        for (let i = 0; i < cellElements.length; i++) {
            cellVisibilityRandom[i] = hashFromPosition(
                Math.floor(i / cols),
                i % cols,
                12.9898 + newIndex * 78.233,
            );
            cellElements[i].textContent = getRandomCharacter();
        }
    }

    // Only touch the DOM when a cell actually changes
    function setCellVisible(i: number, visible: boolean) {
        const value = visible ? 1 : 0;
        if (cellVisible[i] === value) return;
        cellVisible[i] = value;
        cellElements[i].style.visibility = visible ? 'visible' : 'hidden';
    }

    /** Keeps the part of the panel that the band hasn't reached yet */
    function clipPolygon(clipPosition: number) {
        const corners: [number, number][] = [[0, 0], [width, 0], [width, height], [0, height]];
        const signed = ([x, y]: [number, number]) => project(x, y) - clipPosition;
        const points: [number, number][] = [];

        for (let i = 0; i < 4; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            const sa = signed(a);
            const sb = signed(b);
            if (sa >= 0) points.push(a);
            if (sa >= 0 !== sb >= 0) {
                const t = sa / (sa - sb);
                points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
        }

        if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)';
        return `polygon(${points.map(([x, y]) => `${x}px ${y}px`).join(', ')})`;
    }

    function updatePanelClipPaths(scrollProgress: number) {
        for (let i = 0; i < totalTransitions; i++) {
            const segmentProgress = gsap.utils.clamp(0, 1, scrollProgress * totalTransitions - i);
            const clipPosition = -spreadBehind + segmentProgress * totalTravelRange;
            panels[i].style.clipPath = clipPosition <= 0 ? '' : clipPolygon(clipPosition);
        }
    }

    function updateDissolveBand(bandCenter: number) {
        for (let i = 0; i < cellElements.length; i++) {
            const rawDistance = Math.abs(cellPosition[i] - bandCenter);

            const scatterStrength = gsap.utils.clamp(
                options.minScatterAtCenter,
                1,
                rawDistance / options.solidCoreRadius,
            );

            const scatteredDistance =
                cellPosition[i] - bandCenter + cellScatterOffset[i] * scatterStrength;

            const normalizedDistance =
                scatteredDistance >= 0
                    ? scatteredDistance / spreadAhead
                    : Math.abs(scatteredDistance) / spreadBehind;

            if (normalizedDistance >= 1) {
                setCellVisible(i, false);
                continue;
            }

            const density = (1 - normalizedDistance) * (1 - normalizedDistance);
            setCellVisible(i, density > cellVisibilityRandom[i] * options.visibilityThreshold);
        }
    }

    function hideAllDissolveCells() {
        for (let i = 0; i < cellElements.length; i++) setCellVisible(i, false);
    }

    function update(scrollProgress: number) {
        lastProgress = scrollProgress;

        const rawPosition = scrollProgress * totalTransitions;
        const currentTransition = Math.min(Math.floor(rawPosition), totalTransitions - 1);
        const transitionProgress = rawPosition - currentTransition;

        if (currentTransition !== activeTransitionIndex) {
            onTransitionChange(currentTransition);
        }

        updatePanelClipPaths(scrollProgress);

        if (transitionProgress <= 0 || transitionProgress >= 1) {
            hideAllDissolveCells();
            return;
        }

        updateDissolveBand(-spreadBehind + transitionProgress * totalTravelRange);
    }

    buildGrid();

    const trigger = ScrollTrigger.create({
        trigger: root,
        scroller: getScroller(),
        start: 'top top',
        // A function so it's recalculated on resize / orientation change
        end: () => `+=${totalTransitions * root.clientHeight * options.scrollLength}`,
        pin: true,
        pinSpacing: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => update(self.progress),
    });
    update(trigger.progress);

    // Rebuild the grid when the section changes size (resize, phone rotation, etc.)
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
            buildGrid();
            update(lastProgress);
        });
    });
    resizeObserver.observe(root);

    // Snap shortly after the user stops giving input, instead of waiting for the
    // smooth scroll to fully settle (ScrollTrigger's scrollEnd), which takes seconds
    const snapStep = 1 / totalTransitions;
    let snapTimer: ReturnType<typeof setTimeout> | undefined;
    let isTouching = false;
    let lastInputWasTouch = false;

    function snap() {
        // Where the scroll is heading, not where it currently is
        const destination = lenis ? lenis.targetScroll : getScrollTop();
        const progress = (destination - trigger.start) / (trigger.end - trigger.start);
        if (progress <= 0 || progress >= 1) return;

        const position = progress / snapStep;
        const previousPanel = Math.floor(position);
        // How far into the current transition we are, 0–1
        const transitionProgress = position - previousPanel;
        if (transitionProgress < 0.001 || transitionProgress > 0.999) return;

        // Only move on once the user has scrolled past the threshold in their
        // direction, otherwise go back to the panel they came from
        const goForward = trigger.direction > 0
            ? transitionProgress >= options.snapThreshold
            : transitionProgress > 1 - options.snapThreshold;
        const target = (goForward ? previousPanel + 1 : previousPanel) * snapStep;
        const y = trigger.start + (trigger.end - trigger.start) * target;

        if (lenis) lenis.scrollTo(y, { duration: options.snapDuration });
        else getScrollEventTarget().scrollTo({ top: y, behavior: 'smooth' });
    }

    function scheduleSnap() {
        if (isTouching) return;
        clearTimeout(snapTimer);
        snapTimer = setTimeout(snap, options.snapDelay);
    }

    function onWheelOrKey() {
        lastInputWasTouch = false;
        scheduleSnap();
    }

    function onTouchStart() {
        isTouching = true;
        lastInputWasTouch = true;
        clearTimeout(snapTimer);
    }

    function onTouchEnd() {
        isTouching = false;
        scheduleSnap();
    }

    // After lifting the finger the phone keeps scrolling with momentum (Lenis doesn't
    // smooth touch), so keep waiting while those scroll events arrive. Without Lenis
    // there's no easing to wait for, so scroll events are always a good signal.
    function onScroll() {
        if (!lenis || lastInputWasTouch) scheduleSnap();
    }

    // Input events bubble up to the window; scroll events only fire on the element that scrolls
    const scrollTarget = getScrollEventTarget();
    const snapEvents: [string, EventListener][] = [
        ['wheel', onWheelOrKey],
        ['keydown', onWheelOrKey],
        ['touchstart', onTouchStart],
        ['touchend', onTouchEnd],
    ];
    if (options.snap) {
        for (const [type, listener] of snapEvents) {
            window.addEventListener(type, listener, { passive: true });
        }
        scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
        cancelAnimationFrame(resizeFrame);
        resizeObserver.disconnect();
        clearTimeout(snapTimer);
        for (const [type, listener] of snapEvents) window.removeEventListener(type, listener);
        scrollTarget.removeEventListener('scroll', onScroll);
        trigger.kill();
        grid.replaceChildren();
        panels.forEach((panel) => {
            panel.style.clipPath = '';
            panel.style.zIndex = '';
        });
        if (lenis) releaseSmoothScroll();
    };
}
