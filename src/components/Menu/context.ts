import { createContext, useContext, type Accessor } from 'solid-js';
import type { MenuAlign, MenuGroup } from './menuEffect';

export interface MenuContextValue {
    isOpen: Accessor<boolean>;
    open: () => void;
    close: () => void;
    toggle: () => void;
    registerGroup: (group: MenuGroup) => () => void;
    setBar: (element: HTMLElement) => void;
    setPanel: (element: HTMLElement) => void;
    setPage: (element: HTMLElement) => void;
}

export const MenuContext = createContext<MenuContextValue>();

/** Use inside any part of the Menu (or any page) to open/close it */
export function useMenu(): MenuContextValue {
    const context = useContext(MenuContext);
    if (!context) throw new Error('useMenu() must be used inside <Menu>');
    return context;
}

export type { MenuAlign };
