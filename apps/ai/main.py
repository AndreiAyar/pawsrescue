from fastapi import FastAPI


app = FastAPI(title="PawsRescue AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai"}


@app.post("/embed")
def embed() -> dict[str, list[float] | str]:
    # Slice 0 stub so the service can boot before real embedding logic lands.
    return {"model": "lightweight-stub", "embedding": [0.0, 0.0, 0.0]}
