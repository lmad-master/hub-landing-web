/* @refresh reload */
import { render } from 'solid-js/web';
import 'solid-devtools';

import App from './App';

//Router
import { Router, Route } from '@solidjs/router';

// Pages
import { Home, NotFound } from './pages';


const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

render(() => (
  // explicitLinks: only <A> links navigate inside this app. Plain <a> links (like /examenes/,
  // which are other apps on the same domain) do a normal page load to the other site.
  <Router root={App} base={import.meta.env.BASE_URL.replace(/\/$/, '')} explicitLinks>
    <Route path={"/"} component={Home} />
    <Route path={"*paramName"} component={NotFound} />
  </Router>
), root!);
