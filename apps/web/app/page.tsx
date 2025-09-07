import Map from "./components/Map/Map";

async function getCats() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const res = await fetch(`${apiUrl}/lost-pets/2`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch cats");
  return res.json();
}

export default async function Home() {
  const cats = await getCats();
  return (
    <div>
      <div className="w-[300px] h-[300px] bg-red-500">SALU!T</div>
      <pre>{JSON.stringify(cats, null, 2)}</pre>

      <Map />
    </div>
  );
}
