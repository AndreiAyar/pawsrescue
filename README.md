<p align="center">
  <img src="docs/media/hero.svg" alt="PawsRescue — Lost pets deserve a way home. AI with a soft spot for furry lives." width="100%" />
</p>

<p align="center">
  <a href="#how-ai-photo-matching-works">AI matching</a> ·
  <a href="#demos">Demos</a> ·
  <a href="#help-finish-it">Contribute</a> ·
  <a href="docs/DEVELOPMENT.md">Run locally</a>
</p>

Photo matching for missing pets in Romania, built with **Faster R-CNN, DINOv2,
and pgvector**. Upload a photo of an animal you’ve found to look for similar
lost-pet reports, then check where each was last seen.

Reports live on a **MapTiler** map with place search, GPS positioning, and
clusters that open into individual pins as you zoom in. The app works in
Romanian and English.

I started it because lost-pet posts get buried across Facebook groups. I wanted
one place where the person looking for an animal and the person who found it
could find each other.

### How AI photo matching works

![A scan line passes over Pufi’s photo, the detected cat is cropped, DINOv2 extracts visual features, and the matching report is found.](docs/media/04-ai-scan.gif)

**Detect → crop → extract features → compare reports.** Faster R-CNN returns
a bounding box around the cat; the service crops that region. DINOv2 extracts
features from the crop and the full photo, which the service combines. PostgreSQL’s
pgvector extension ranks reports by cosine similarity. If no cat is detected,
the full photo is used.

<sub>The scan line is an explanatory animation, using a real detection and match.
It is not an extra screen in the app.</sub>

### Demos

#### Report a missing pet

![Add Nori’s location, details, and photo, then save the report.](docs/media/01-report.gif)

#### Explore the map

![Zoom into Timișoara, open Pufi’s pin, and find his report in the list.](docs/media/02-map.gif)

#### From clusters to individual pets

![Open a cluster of nearby reports and zoom in until individual pet pins appear.](docs/media/05-map-clusters.gif)

**MapTiler SDK** handles the map and geocoding. Reports are returned as
**GeoJSON**, grouped by **Supercluster**. The client requests report data for
the visible map tiles and caches it as you pan.

#### Search using a photo

![Upload Pufi’s photo, check the suggested match and its location, and open the report.](docs/media/03-photo-match.gif)

<sub>Local recordings with fictional reports, stock photos, and simulated GPS.
The photo search uses Pufi’s listing photo. [Demo notes and photo sources](docs/media/README.md).</sub>

Photo search suggests similar-looking animals; it does not confirm identity.
If no close results are found, try another photo or explore the map. See
[search behavior and setup](docs/DEVELOPMENT.md#photo-search-behavior).

### Help finish it

I don’t have much time to work on this anymore. The main flows work, but it’s
still a prototype. I’d like to find people who can help keep it going.

There’s plenty left: search filters, editing reports, email verification, and
marking animals as found. Help with design, translations, and testing would
be useful too.

[Read the contribution guide](CONTRIBUTING.md) to get started, or
[open an issue](https://github.com/AndreiAyar/pawsrescue/issues) with a bug or idea.

### Development

Next.js and React on the frontend, NestJS for the API, PostgreSQL with pgvector,
Redis/BullMQ for background upload processing, and a Python service for photo
matching. The local demo uses DINOv2 Small.

NestJS saves the report and adds a `{ petId }` job to **BullMQ / Redis**.
The **Python worker** computes and saves the embedding directly in Postgres,
then completes the job. Queued uploads keep processing if the API restarts;
retries skip reports whose embedding is already saved.

#### Start locally

First clone? Run `npm ci` and `npm run setup:env`, then follow the
[first-time setup](docs/DEVELOPMENT.md#local-development). Start Redis
with Docker Compose and run the applications on your machine:

```sh
npm run dev:local
```

With Docker Desktop running, this starts Redis, waits for its health check,
then starts the applications through Turbo. The equivalent separate commands are:

```sh
npm run redis:up
npm run dev
```

Check Redis at any time with `npm run redis:check` (expected: `PONG`).

Docker must be installed and running. `npm run dev` starts Next.js, NestJS and
Python; it connects to Redis but does not start it. The BullMQ worker starts
inside the Python service. Keep your configured Postgres connection, or start the
included local database with `docker compose up -d --wait db`.

Open [localhost:3060/en](http://localhost:3060/en). Uploads save the report and
queue its embedding; Python consumes the job and stores the vector in Postgres.
Scan requests still return their results synchronously.

```sh
npm run redis:stop             # stop Redis; preserve queue data
docker compose logs -f redis   # inspect Redis logs
```

Redis uses a persistent `redis-data` volume, append-only storage, a health check,
and `noeviction` so queue keys are not evicted. Its development port is bound to
localhost. For [development without Docker](docs/DEVELOPMENT.md#redis-without-docker-on-macos),
run Redis natively. To run the whole stack in containers instead, configure the
root `.env` from `.env.example` and run `npm run docker:up`.

[Local setup and commands](docs/DEVELOPMENT.md) ·
[Deployment](DEPLOY_DIGITALOCEAN.md) · [Security](SECURITY.md) ·
[Third-party notices](THIRD_PARTY_NOTICES.md)

<sub>MIT licensed. Use it, improve it, or build your own version. See [LICENSE](LICENSE).</sub>
