import { For } from 'solid-js';
import styles from './Home.module.css';
import { AsciiImage, AsciiMorph, DissolveScroll, VideoReel } from '../../components';
import { CAREERS, INSTITUTION, SITES, siteUrl } from '../../config/site';

import programacion1 from '../../../assets/imgs/AsciiImages/Programacion-1.webp';
import programacion2 from '../../../assets/imgs/AsciiImages/Programacion-2.webp';
import videogames1 from '../../../assets/imgs/AsciiImages/Videogames-1.webp';
import videogames2 from '../../../assets/imgs/AsciiImages/Videogames-2.webp';
import reelVideo from '../../../assets/videos/LMAD-VideoPromocional.webm';
import reelPoster from '../../../assets/videos/LMAD-VideoPromocional-poster.jpg';

// Colors from the theme in index.css
const ACCENT = 'var(--color-accent)';
const ACCENT_2 = 'var(--color-accent-2)';
const ASCII_CHAR = 'var(--color-ascii-char)';
// The ASCII images are white on black, so they're read by brightness
// The icons only fill the middle of their images, so they're shown large
const SQUARE_IMAGE = 'min(95vw, 90svh)';

function Home() {
    const career = CAREERS[0];
    const enabledSites = SITES.filter((site) => site.enabled);

    return (
        <main class={styles.home}>
            {/* ---------- Hero ---------- */}
            <section class={styles.hero}>
                <AsciiMorph mode="loop" transition="morph" interval={2800} duration={1800} useBrightness threshold={0.5}>
                    <AsciiImage src={programacion1} chars="</>{}();=" charColor={ACCENT} imageWidth={SQUARE_IMAGE} />
                    <AsciiImage src={videogames1} chars="▲●■◆+" charColor={ACCENT_2} imageWidth={SQUARE_IMAGE} />
                    <AsciiImage src={programacion2} chars="$>_|#" charColor={ASCII_CHAR} imageWidth={SQUARE_IMAGE} />
                    <AsciiImage src={videogames2} chars="binary" charColor={ACCENT} imageWidth="min(95vw, 120svh)" />
                </AsciiMorph>

                <div class={styles.heroText}>
                    <p class={styles.eyebrow}>
                        {INSTITUTION.faculty.shortName} · {INSTITUTION.university.shortName}
                    </p>
                    <h1 class={styles.heroTitle}>{career.name}</h1>
                </div>
                <span class={styles.scrollHint} aria-hidden="true">Scroll ↓</span>
            </section>

            {/* ---------- Reel ---------- */}
            <VideoReel id="reel" src={reelVideo} poster={reelPoster}>
                <p class={styles.eyebrow}>Reel de proyectos</p>
                <h2 class={styles.sectionTitle}>Lo que crean nuestros estudiantes</h2>
                <p class={styles.body}>
                    Una muestra de los proyectos desarrollados por estudiantes de {career.shortName}.
                </p>
            </VideoReel>

            {/* ---------- Sites ---------- */}
            <section class={styles.sitesIntro} id="sitios">
                <p class={styles.eyebrow}>Sitios</p>
                <h2 class={styles.sectionTitle}>Todo {career.shortName} en un solo lugar</h2>
            </section>

            <DissolveScroll chars="default" cellColor={ACCENT} charColor="var(--color-text-dark)" direction="down" snap>
                <For each={enabledSites}>
                    {(site, i) => (
                        <article class={styles.sitePanel} data-variant={i() % 2 === 0 ? 'dark' : 'light'}>
                            <span class={styles.siteIndex}>
                                {String(i() + 1).padStart(2, '0')} / {String(enabledSites.length).padStart(2, '0')}
                            </span>
                            <h3 class={styles.siteName}>{site.name}</h3>
                            <p class={styles.siteDescription}>{site.description}</p>
                            <a class={styles.siteLink} href={siteUrl(site.path)}>
                                Visitar sitio <span aria-hidden="true">→</span>
                            </a>
                        </article>
                    )}
                </For>
            </DissolveScroll>

            {/* ---------- Career logo ---------- */}
            <section class={styles.outro}>
                <AsciiImage src={career.logo} alt={career.name} chars="default" charColor={ACCENT} imageWidth="min(70vw, 700px)" />
            </section>
        </main>
    );
}

export { Home };
