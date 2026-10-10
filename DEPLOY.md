# Deploying hub-landing-web

The site runs in its own container (`compose.yaml` in this repo) and the server's main Caddy
proxies `multimedia.fcfm.uanl.mx/` to it. HTTPS is handled by the main Caddy.

```
internet ──► caddy-proxy (80/443, HTTPS)
               ├── /examenes/*           ──► 10.0.10.43:8081
               ├── /projects-showcase/*  ──► 10.0.10.43:8082
               └── everything else       ──► 10.0.10.43:8080  (this repo)
```

## First deploy

1. Clone the repo on the server, next to the other projects:

   ```bash
   git clone git@github.com:lmad-master/hub-landing-web.git
   cd hub-landing-web
   ```

   If the repo is private, the server needs access: add the server's SSH public key as a
   **deploy key** (repo → Settings → Deploy keys, read-only).

2. Build and start the container:

   ```bash
   podman compose up -d --build
   ```

3. Check it answers locally (should print `200`):

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
   ```

4. In the main Caddy's `Caddyfile`, replace the `handle { respond ... }` block with:

   ```caddy
   handle {
       reverse_proxy 10.0.10.43:8080
   }
   ```

5. Reload the main Caddy:

   ```bash
   podman exec caddy-proxy caddy reload --config /etc/caddy/Caddyfile
   ```

   If the change doesn't show up, restart it instead (`podman restart caddy-proxy`). A file
   mounted on its own can keep showing the old version after some editors save it.

6. Open https://multimedia.fcfm.uanl.mx/

## Updating the site

```bash
cd hub-landing-web
git pull
podman compose up -d --build
podman image prune -f   # removes the old image
```

## Keeping containers running after a reboot

`restart: always` needs Podman's restart service enabled once:

```bash
# Containers run as root (sudo podman ...)
sudo systemctl enable --now podman-restart.service

# Containers run as a normal user
systemctl --user enable --now podman-restart.service
sudo loginctl enable-linger $USER
```

## Notes

- Port 8080 is published on every interface. If the server is reachable from the internet
  directly (not only through 80/443), limit it to the internal IP in `compose.yaml`:
  `"10.0.10.43:8080:80"`, or block 8080 in the firewall.
- Links to the other sites are root-relative (`/examenes/`), so they follow the domain. Paths
  are set in `src/config/site.ts`.
