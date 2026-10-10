import { A } from '@solidjs/router';
import styles from './NotFound.module.css';

function NotFound() {
    return (
        <main class={styles.notFound}>
            <p class={styles.code}>404</p>
            <h1 class={styles.title}>Esta página no existe</h1>
            <A href="/" class={styles.link}>
                Volver al inicio <span aria-hidden="true">→</span>
            </A>
        </main>
    );
}

export { NotFound };
