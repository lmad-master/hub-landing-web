import { For, type Component, type JSX } from 'solid-js';
import { Menu } from './components';
import { Footer } from './layout/Footer';
import { CAREERS, INSTITUTION, SITES, siteUrl } from './config/site';

const LOGO_HEIGHT = 'clamp(22px, 3.2vw, 40px)';

const App: Component<{children?: JSX.Element}> = (props) => {
  return (
    <Menu pageScale={0.95} pageRadius="2rem">
      {/* blend="normal" keeps the logos in their original colors */}
      <Menu.Bar blend="normal">
        <Menu.Group align="left" gap="0.25rem">
          <For each={CAREERS}>
            {(career) => <Menu.Logo src={career.logo} alt={career.shortName} href="/" height={LOGO_HEIGHT} />}
          </For>
          <Menu.Logo src={INSTITUTION.faculty.logo} alt={INSTITUTION.faculty.name} href={INSTITUTION.faculty.url} height={LOGO_HEIGHT} />
          <Menu.Logo src={INSTITUTION.university.logo} alt={INSTITUTION.university.name} href={INSTITUTION.university.url} height={LOGO_HEIGHT} />
        </Menu.Group>
        <Menu.Group align="right">
          <Menu.Toggle />
        </Menu.Group>
      </Menu.Bar>

      <Menu.Panel>
        <Menu.Column title="Sitios">
          <For each={SITES}>
            {(site) => (
              <Menu.Link href={siteUrl(site.path)} reload disabled={!site.enabled} badge={site.enabled ? undefined : 'Próximamente'}>
                {site.name}
              </Menu.Link>
            )}
          </For>
        </Menu.Column>
        <Menu.Column title="Institución">
          <Menu.Link href={INSTITUTION.faculty.url}>{INSTITUTION.faculty.shortName}</Menu.Link>
          <Menu.Link href={INSTITUTION.university.url}>{INSTITUTION.university.shortName}</Menu.Link>
        </Menu.Column>
      </Menu.Panel>

      {/* Layout of the entire app */}
      <Menu.Page>
        {props.children}
        <Footer />
      </Menu.Page>
    </Menu>
  );
};

export default App;
