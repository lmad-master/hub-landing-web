/**
 * Everything the landing page shows about the degree and the other sites lives here,
 * so adding a career or enabling a site is a data change, not a code change.
 */

import logoLmad from '../../assets/imgs/Logo-LMAD.webp';
import logoFcfm from '../../assets/imgs/Logo-FCFM.webp';
import logoUanl from '../../assets/imgs/Logo-UANL.webp';

/**
 * Where the other sites live. Empty = same domain as this page, so links are
 * root-relative ("/examenes/") and keep working if the domain changes.
 * If the sites ever move to another domain, set VITE_SITES_ORIGIN in an .env file,
 * e.g. VITE_SITES_ORIGIN=https://multimedia.fcfm.uanl.mx
 */
const SITES_ORIGIN = (import.meta.env.VITE_SITES_ORIGIN ?? '').replace(/\/$/, '');

/** Builds the URL of another site on this host from its path */
export function siteUrl(path: string): string {
    return `${SITES_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface Career {
    id: string;
    shortName: string;
    name: string;
    logo: string;
}

/** Only one for now; the second one goes here when the degree splits */
export const CAREERS: Career[] = [
    {
        id: 'lmad',
        shortName: 'LMAD',
        name: 'Licenciatura en Multimedia y Animación Digital',
        logo: logoLmad,
    },
];

export interface Site {
    id: string;
    name: string;
    /** Path on this host, e.g. "/examenes/" */
    path: string;
    description: string;
    /** false = shown as "Próximamente" in the menu and hidden from the page */
    enabled: boolean;
}

// TODO: confirm the real paths of each site
export const SITES: Site[] = [
    {
        id: 'examenes',
        name: 'Exámenes',
        path: '/examenes/',
        description: 'Consulta y presenta los exámenes de la licenciatura.',
        enabled: true,
    },
    {
        id: 'projects-showcase',
        name: 'Projects Showcase',
        path: '/projects-showcase/',
        description: 'Explora los proyectos creados por los estudiantes.',
        enabled: true,
    },
    {
        id: 'expo-lmad',
        name: 'Expo LMAD',
        path: '/expo-lmad/',
        description: 'La exposición de proyectos de la licenciatura.',
        enabled: false,
    },
    {
        id: 'synergy',
        name: 'Synergy',
        path: '/synergy/',
        description: '',
        enabled: false,
    },
];

export const LOCATION = 'San Nicolás de los Garza, Nuevo León, México';

export const INSTITUTION = {
    faculty: { name: 'Facultad de Ciencias Físico Matemáticas', shortName: 'FCFM', logo: logoFcfm, url: 'https://www.fcfm.uanl.mx' },
    university: { name: 'Universidad Autónoma de Nuevo León', shortName: 'UANL', logo: logoUanl, url: 'https://www.uanl.mx' },
};
