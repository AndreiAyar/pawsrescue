const [, , imagePathArg] = process.argv;

const aiBaseUrl = (process.env.AI_BASE_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${JSON.stringify(data)}`,
    );
  }

  return data;
}

async function main() {
  const health = await requestJson(`${aiBaseUrl}/health`);

  console.log("AI health");
  console.log(JSON.stringify(health, null, 2));

  if (!imagePathArg) {
    console.log("");
    console.log(
      "Tip: run `node scripts/check-ai-runtime.mjs /absolute/path/to/image.jpg` to verify /embed too.",
    );
    return;
  }

  const embed = await requestJson(`${aiBaseUrl}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imagePaths: [imagePathArg],
    }),
  });

  console.log("");
  console.log("AI embed");
  console.log(
    JSON.stringify(
      {
        model: embed.model,
        fallbackUsed: embed.fallbackUsed,
        warning: embed.warning,
        embeddingDimensions: embed.embeddingDimensions,
        embeddingPreview: Array.isArray(embed.embedding)
          ? embed.embedding.slice(0, 8)
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("AI runtime check failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
