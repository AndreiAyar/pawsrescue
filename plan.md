# PawsRescue Plan

## Summary
Romania-first app to report lost pets and help people match pets they see on the street.
Users can search manually on a map or upload photos to find AI-based matches.

## Core User Flows
1) Report lost pet (name, contact, description, photos, location).
2) Browse map of lost pets with filters (city, type, color, status).
3) Upload 1-4 photos to find similar pets via embeddings.
4) Contact owner and update or close a listing via a secure email link.

## MVP Scope
- Map with clustered lost pet pins and filters.
- Create lost pet listing with required fields from LostPetEntity.
- Image upload and AI similarity search endpoint.
- Owner edit/recovery via email link.
- Alerts (initially email) for potential matches.
- Verification basics (email link, optional phone later).

## UX Flow (Draft)
Report Lost Pet
1) Start report from home.
2) Fill pet info + contact + description + photos (1-4).
3) Pick location on map (or search by address).
4) Review and submit.
5) Email link to verify and manage the listing.

Find a Pet (Scan)
1) Upload 1-3 photos of the pet you saw.
2) Provide location (city or current area).
3) See ranked matches in the city, then expand if needed.
4) Open detail page and contact the owner.

Manual Browse
1) Explore map/list with filters (city, type, color, status).
2) Open listing detail.
3) Contact owner.

## Page Map (Draft)
- /[lang] (home + map preview, CTAs: report lost pet, scan found pet, browse map)
- /[lang]/report (lost pet form + location picker + photo upload)
- /[lang]/scan (upload photos + location + match results)
- /[lang]/search (map + list + filters)
- /[lang]/pets/[id] (lost pet detail + contact)
- /[lang]/owner/[token] (edit/close listing via email link)
- /[lang]/verify (email verification landing)

## Confirmed Decisions (2026-01-27)
- Routes: use /report and /pets/[id].
- Language: bilingual (RO/EN) from the start, via /ro and /en prefixes.
- Filters: city, type, color, status, radius.
- Scan flow: location required; if geolocation denied, require manual city input, otherwise allow global search fallback.
- Home map: static local image + CSS overlay "fake clusters"; interactive map only on /search.

## AI Matching (Draft)
- On create: generate embeddings per photo (1-4). Decide between:
  - Per-photo embeddings stored, or
  - Aggregate embedding (median/mean).
- Store embeddings in Postgres (pgvector).
- On query: embed uploaded photo(s), search within city or radius.
- Return ranked matches + distance + basic info.
- If local matches are weak, expand to nearby cities.

## Architecture (Draft)
- Web: Next.js app router, MapTiler map, filters, upload UI.
- API: NestJS + MikroORM + Postgres.
- Vector search: pgvector in Postgres.
- Async processing: RabbitMQ queue for embedding + search.
- Model service: external service for embeddings (candidate: Meta SAM 3).

## Data Model (LostPetEntity)
Required: name, type, email, latitude, longitude.
Optional: description, phone, images, raw and structured address fields, maptiler data.

## API Endpoints (Initial)
- POST /lost-pets
- GET /lost-pets/:id
- GET /lost-pets/clusters?bbox=&zoom=
- POST /lost-pets/match (photos, location, filters)
- POST /lost-pets/:id/close
- POST /lost-pets/:id/update (via secure token)

## Decisions To Make
- Embedding storage strategy (per-photo vs aggregate).
- Search radius rules (city-only vs km radius + expansion).
- Photo storage (local, S3-compatible, or DB references).
- Identity and edit flow (email token format and expiry).
- Model service choice and hosting (SAM 3 or alternative).

## Immediate Next Steps
- Define MVP UX flow and pages.
- Specify filters and search parameters.
- Design match response shape.
- Decide embedding strategy and queue workflow.
- Update API to accept real lost pet creation + photos.
