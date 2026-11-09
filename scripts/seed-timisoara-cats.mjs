import { readFile } from "node:fs/promises";

const apiBase = (process.env.API_URL || "http://localhost:3015").replace(
  /\/$/,
  "",
);
const fixture = JSON.parse(
  await readFile(new URL("./timisoara-cats.json", import.meta.url), "utf8"),
);

async function requestJson(path, init) {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function waitForEmbedding(pet) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (
    pet.embeddingStatus === "pending" ||
    pet.embeddingStatus === "processing"
  ) {
    if (Date.now() > deadline)
      throw new Error(`Timed out processing listing ${pet.id}.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    pet = await requestJson(`/lost-pets/${pet.id}`);
  }
  if (!pet.embeddingInfo || pet.embeddingInfo.fallbackUsed) {
    throw new Error(
      `Listing ${pet.id} was saved, but its image matching needs attention.`,
    );
  }
  return pet;
}

async function main() {
  const existing = await requestJson("/lost-pets");
  if (!Array.isArray(existing))
    throw new Error("Could not read current listings.");

  // Check every source file before creating any listings.
  const photos = await Promise.all(
    fixture.cats.map((cat) =>
      readFile(new URL(`../apps/api/uploads/${cat.photo}`, import.meta.url)),
    ),
  );

  for (const [index, cat] of fixture.cats.entries()) {
    const previous = existing.find((pet) => pet.email === cat.email);
    if (previous) {
      await waitForEmbedding(previous);
      console.log(`Already exists: ${previous.name} #${previous.id}`);
      continue;
    }

    const payload = new FormData();
    const { photo, ...fields } = cat;
    for (const [key, value] of Object.entries(fields)) {
      payload.set(key, String(value));
    }
    payload.set("type", "cat");
    payload.set("city", "Timișoara");
    payload.append(
      "photos",
      new Blob([photos[index]], { type: "image/jpeg" }),
      photo,
    );

    const created = await requestJson("/lost-pets", {
      method: "POST",
      body: payload,
    });
    existing.push(created);
    console.log(`Created: ${created.name} #${created.id} · ${created.city}`);
    await waitForEmbedding(created);
  }

  const current = await requestJson("/lost-pets");
  const cats = fixture.cats.map((cat) => {
    const saved = current.find((pet) => pet.email === cat.email);
    if (
      !saved ||
      saved.type !== "cat" ||
      saved.city !== "Timișoara" ||
      saved.description !== cat.description ||
      !saved.imageUrls?.length ||
      !saved.embeddingInfo ||
      saved.embeddingInfo.fallbackUsed
    ) {
      throw new Error(`Could not verify ${cat.name}.`);
    }
    return { id: saved.id, name: saved.name, location: saved.rawLocation };
  });
  console.log(JSON.stringify({ verified: cats.length, cats }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
