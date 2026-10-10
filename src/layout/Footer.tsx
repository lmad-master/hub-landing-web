import { For } from 'solid-js';
import styles from './Footer.module.css';
import { CAREERS, INSTITUTION, LOCATION } from '../config/site';

function Footer() {
    return (
        <footer class={styles.footer}>
            <div class={styles.logos}>
                <a href={INSTITUTION.university.url} target="_blank" rel="noopener noreferrer">
                    <img src={INSTITUTION.university.logo} alt={INSTITUTION.university.name} />
                </a>
                <a href={INSTITUTION.faculty.url} target="_blank" rel="noopener noreferrer">
                    <img src={INSTITUTION.faculty.logo} alt={INSTITUTION.faculty.name} />
                </a>
            </div>
            <div class={styles.info}>
                <For each={CAREERS}>{(career) => <p class={styles.career}>{career.name}</p>}</For>
                <p>{INSTITUTION.faculty.name}</p>
                <p>{INSTITUTION.university.name}</p>
                <p class={styles.location}>{LOCATION}</p>
            </div>
        </footer>
    );
}

export { Footer };
