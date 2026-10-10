import { createEffect, createSignal, on, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import styles from './Menu.module.css';
import { MenuContext, useMenu, type MenuContextValue } from './context';
import { createMenuEffect, DEFAULT_OPTIONS, type MenuAlign, type MenuEffect, type MenuGroup, type MenuOptions } from './menuEffect';
import { scrollToY, setScroller } from '../../utils/smoothScroll';

const OPTION_KEYS = Object.keys(DEFAULT_OPTIONS) as (keyof MenuOptions)[];

const FLEX_ALIGN = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

/* ------------------------------------------------------------------ */
/* <Menu> — holds the state and the settings, wraps all the parts      */
/* ------------------------------------------------------------------ */

export type MenuProps = Partial<MenuOptions> & {
    children: JSX.Element;
    /** Background of the menu (what you see behind the page) */
    background?: string;
    /** Background of the page wrapper */
    pageBackground?: string;
    linkColor?: string;
    /** Font size of the links, any CSS size */
    linkSize?: string;
    mobileLinkSize?: string;
    /** Close with the Escape key */
    closeOnEscape?: boolean;
    /** Close when clicking the page while the menu is open */
    closeOnPageClick?: boolean;
    onOpenChange?: (open: boolean) => void;
    class?: string;
    style?: JSX.CSSProperties;
};

function MenuRoot(props: MenuProps) {
    const [isOpen, setIsOpen] = createSignal(false);
    const [groups, setGroups] = createSignal<MenuGroup[]>([]);
    let bar: HTMLElement | undefined;
    let panel: HTMLElement | undefined;
    let page: HTMLElement | undefined;
    let effect: MenuEffect | undefined;

    const breakpoint = () => props.mobileBreakpoint ?? DEFAULT_OPTIONS.mobileBreakpoint;
    const [isMobile, setIsMobile] = createSignal(window.innerWidth < breakpoint());

    const context: MenuContextValue = {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((open) => !open),
        registerGroup: (group) => {
            setGroups((list) => [...list, group]);
            return () => setGroups((list) => list.filter((item) => item !== group));
        },
        setBar: (element) => (bar = element),
        setPanel: (element) => (panel = element),
        setPage: (element) => (page = element),
    };

    onMount(() => {
        if (!page || !panel || !bar) {
            throw new Error('<Menu> needs a <Menu.Bar>, a <Menu.Panel> and a <Menu.Page> inside it');
        }

        const options = { ...DEFAULT_OPTIONS };
        for (const key of OPTION_KEYS) {
            if (props[key] !== undefined) (options as Record<string, unknown>)[key] = props[key];
        }
        effect = createMenuEffect({ page, panel, bar, groups }, options);

        const media = window.matchMedia(`(max-width: ${breakpoint() - 1}px)`);
        const onMediaChange = () => setIsMobile(media.matches);
        onMediaChange();
        media.addEventListener('change', onMediaChange);

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen() && (props.closeOnEscape ?? true)) setIsOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);

        // While open, a click on the page closes the menu instead of clicking what's under it
        const onPageClick = (e: MouseEvent) => {
            if (!isOpen() || !(props.closeOnPageClick ?? true)) return;
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
        };
        page.addEventListener('click', onPageClick, true);

        onCleanup(() => {
            media.removeEventListener('change', onMediaChange);
            window.removeEventListener('keydown', onKeyDown);
            page?.removeEventListener('click', onPageClick, true);
            effect?.destroy();
        });
    });

    createEffect(
        on(isOpen, (open) => {
            effect?.setOpen(open);
            props.onOpenChange?.(open);
        }, { defer: true }),
    );

    return (
        <MenuContext.Provider value={context}>
            <div
                class={`${styles.root} ${props.class ?? ''}`}
                data-mobile={isMobile() ? '' : undefined}
                style={{
                    '--menu-bg': props.background,
                    '--menu-page-bg': props.pageBackground,
                    '--menu-link-color': props.linkColor,
                    '--menu-link-size': props.linkSize,
                    '--menu-link-mobile-size': props.mobileLinkSize,
                    '--menu-offset': String(props.pageOffset ?? DEFAULT_OPTIONS.pageOffset),
                    '--menu-mobile-offset': String(props.mobilePageOffset ?? DEFAULT_OPTIONS.mobilePageOffset),
                    ...props.style,
                }}
            >
                {props.children}
            </div>
        </MenuContext.Provider>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Bar> — the fixed top bar                                       */
/* ------------------------------------------------------------------ */

export interface MenuBarProps {
    children: JSX.Element;
    /** CSS mix-blend-mode, 'difference' makes it readable on any background */
    blend?: JSX.CSSProperties['mix-blend-mode'];
    padding?: string;
    class?: string;
    style?: JSX.CSSProperties;
}

function MenuBar(props: MenuBarProps) {
    const menu = useMenu();
    return (
        <header
            ref={(element) => menu.setBar(element)}
            class={`${styles.bar} ${props.class ?? ''}`}
            style={{ 'mix-blend-mode': props.blend ?? 'difference', padding: props.padding, ...props.style }}
        >
            {props.children}
        </header>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Group> — a left / center / right slot of the bar               */
/* ------------------------------------------------------------------ */

export interface MenuGroupProps {
    children: JSX.Element;
    align?: MenuAlign;
    gap?: string;
    /** Slide this group away while scrolling down */
    hideOnScroll?: boolean;
    class?: string;
    style?: JSX.CSSProperties;
}

function MenuGroupSlot(props: MenuGroupProps) {
    const menu = useMenu();
    let element!: HTMLDivElement;

    onMount(() => {
        onCleanup(menu.registerGroup({
            element,
            align: props.align ?? 'left',
            hideOnScroll: props.hideOnScroll ?? true,
        }));
    });

    return (
        <div
            ref={element}
            class={`${styles.group} ${props.class ?? ''}`}
            data-align={props.align ?? 'left'}
            style={{ gap: props.gap, ...props.style }}
        >
            {props.children}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Logo> — an image (or anything you put inside), optional link   */
/* ------------------------------------------------------------------ */

export interface MenuLogoProps {
    src?: string;
    alt?: string;
    href?: string;
    /** Any CSS width */
    width?: string;
    /** Any CSS height, the width follows the image's proportions */
    height?: string;
    /** Show the image in plain white, useful for colored logos on a dark bar */
    monochrome?: boolean;
    /** Use instead of src for text or SVG logos */
    children?: JSX.Element;
    class?: string;
}

function MenuLogo(props: MenuLogoProps) {
    const className = () => `${styles.logo} ${props.monochrome ? styles.monochrome : ''} ${props.class ?? ''}`;
    const isExternal = () => /^https?:\/\//.test(props.href ?? '');
    const content = () =>
        props.src ? (
            <img
                src={props.src}
                alt={props.href ? '' : props.alt ?? ''}
                style={{ width: props.width ?? (props.height ? 'auto' : undefined), height: props.height }}
            />
        ) : (
            props.children
        );

    return (
        <Show when={props.href} fallback={<div class={className()}>{content()}</div>}>
            <Show
                when={!isExternal()}
                fallback={
                    <a href={props.href} class={className()} aria-label={props.alt} target="_blank" rel="noopener noreferrer">
                        {content()}
                    </a>
                }
            >
                <A href={props.href!} class={className()} aria-label={props.alt}>
                    {content()}
                </A>
            </Show>
        </Show>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Toggle> — the burger button                                    */
/* ------------------------------------------------------------------ */

export interface MenuToggleProps {
    label?: string;
    color?: string;
    /** Width of the lines, any CSS length */
    width?: string;
    thickness?: string;
    gap?: string;
    class?: string;
}

function MenuToggle(props: MenuToggleProps) {
    const menu = useMenu();
    return (
        <button
            type="button"
            class={`${styles.toggle} ${props.class ?? ''}`}
            aria-label={props.label ?? 'Toggle menu'}
            aria-expanded={menu.isOpen()}
            onClick={() => menu.toggle()}
            style={{
                '--toggle-color': props.color,
                '--toggle-width': props.width,
                '--toggle-thickness': props.thickness,
                '--toggle-gap': props.gap,
            }}
        >
            <span></span>
            <span></span>
            <span></span>
        </button>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Panel> — the area revealed behind the page                     */
/* ------------------------------------------------------------------ */

export interface MenuPanelProps {
    children: JSX.Element;
    label?: string;
    gap?: string;
    padding?: string;
    class?: string;
    style?: JSX.CSSProperties;
}

function MenuPanel(props: MenuPanelProps) {
    const menu = useMenu();
    let element!: HTMLDivElement;

    // Links can't be focused or clicked while the menu is closed
    createEffect(() => {
        element.inert = !menu.isOpen();
    });

    return (
        <div
            ref={(el) => {
                element = el;
                menu.setPanel(el);
            }}
            class={styles.panel}
        >
            <nav
                aria-label={props.label ?? 'Main'}
                class={`${styles.panelInner} ${props.class ?? ''}`}
                style={{ gap: props.gap, padding: props.padding, ...props.style }}
            >
                {props.children}
            </nav>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Column> — a column of links                                    */
/* ------------------------------------------------------------------ */

export interface MenuColumnProps {
    children: JSX.Element;
    /** Small label above the links */
    title?: string;
    align?: MenuAlign;
    class?: string;
    style?: JSX.CSSProperties;
}

function MenuColumn(props: MenuColumnProps) {
    const align = () => props.align ?? 'left';
    return (
        <div
            data-menu-column
            class={`${styles.column} ${props.class ?? ''}`}
            style={{ 'align-items': FLEX_ALIGN[align()], 'text-align': align(), ...props.style }}
        >
            <Show when={props.title}>
                <span class={styles.columnTitle}>{props.title}</span>
            </Show>
            {props.children}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Link> — closes the menu when clicked                           */
/* ------------------------------------------------------------------ */

export interface MenuLinkProps {
    href: string;
    children: JSX.Element;
    /** Opens in a new tab; detected automatically for http(s) links */
    external?: boolean;
    /** Full page load in the same tab, for other sites on this domain that aren't part of this app */
    reload?: boolean;
    /** Shown but not clickable, e.g. a site that isn't ready yet */
    disabled?: boolean;
    /** Small label next to the link, e.g. "Próximamente" */
    badge?: string;
    /** Only mark as active on an exact match (default for "/") */
    end?: boolean;
    class?: string;
}

function MenuLink(props: MenuLinkProps) {
    const menu = useMenu();
    const isExternal = () => props.external ?? /^https?:\/\//.test(props.href);
    const className = () => `${styles.link} ${props.class ?? ''}`;
    const badge = () => props.badge && <small class={styles.badge}>{props.badge}</small>;

    if (props.disabled) {
        return (
            <span data-menu-link class={`${className()} ${styles.disabled}`} aria-disabled="true">
                {props.children}
                {badge()}
            </span>
        );
    }

    if (props.reload && !isExternal()) {
        return (
            <a data-menu-link class={className()} href={props.href}>
                {props.children}
                {badge()}
            </a>
        );
    }

    return (
        <Show
            when={!isExternal()}
            fallback={
                <a data-menu-link class={className()} href={props.href} target="_blank" rel="noopener noreferrer">
                    {props.children}
                    {badge()}
                </a>
            }
        >
            <A
                data-menu-link
                href={props.href}
                class={`${styles.link} ${props.class ?? ''}`}
                activeClass={styles.active}
                end={props.end ?? props.href === '/'}
                onClick={() => menu.close()}
            >
                {props.children}
                {badge()}
            </A>
        </Show>
    );
}

/* ------------------------------------------------------------------ */
/* <Menu.Page> — wraps your pages; this is what slides down and scrolls */
/* ------------------------------------------------------------------ */

export interface MenuPageProps {
    children: JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
}

function MenuPage(props: MenuPageProps) {
    const menu = useMenu();

    // When the route changes: close the menu and start the new page at the top
    let location: ReturnType<typeof useLocation> | undefined;
    try {
        location = useLocation();
    } catch {
        location = undefined;
    }
    if (location) {
        const current = location;
        createEffect(on(() => current.pathname, () => {
            menu.close();
            scrollToY(0, { immediate: true });
        }, { defer: true }));
    }

    onCleanup(() => setScroller(null));

    return (
        <div
            ref={(element) => menu.setPage(element)}
            class={`${styles.page} ${props.class ?? ''}`}
            data-open={menu.isOpen() ? '' : undefined}
            style={props.style}
        >
            {/* Grows with the content, so Lenis notices when the page gets taller (e.g. after changing route) */}
            <div
                ref={(content) => {
                    // Set right away, so components inside the page use it as their scroller
                    setScroller(content.parentElement as HTMLElement, content);
                }}
                class={styles.pageContent}
            >
                {props.children}
            </div>
        </div>
    );
}

export const Menu = Object.assign(MenuRoot, {
    Bar: MenuBar,
    Group: MenuGroupSlot,
    Logo: MenuLogo,
    Toggle: MenuToggle,
    Panel: MenuPanel,
    Column: MenuColumn,
    Link: MenuLink,
    Page: MenuPage,
});
