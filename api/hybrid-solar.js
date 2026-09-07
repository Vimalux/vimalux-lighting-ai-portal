const timeoutFetch = async (url, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

function normalizeMunicipality(value) {
  return String(value || "")
    .trim()
    .replace(/^(comune\s+di|comune|municipality\s+of|municipality)\s+/i, "")
    .trim();
}

function parseMonthlyPvcalc(payload = {}) {
  const fixed = payload?.outputs?.monthly?.fixed;
  const rows = Array.isArray(fixed) ? fixed : [];
  const monthly = Array.from({ length: 12 }, () => 0);
  for (const row of rows) {
    const month = Number(row?.month);
    const value = Number(row?.E_m);
    if (month >= 1 && month <= 12 && Number.isFinite(value) && value >= 0) monthly[month - 1] = value;
  }
  if (!monthly.some((value) => value > 0)) throw new Error("PVGIS returned no monthly PV production data.");
  return monthly;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const municipality = normalizeMunicipality(req.query?.municipality);
  const countryCode = String(req.query?.countryCode || "IT").trim().toUpperCase();
  const language = String(req.query?.language || "it").trim().toLowerCase();
  if (!municipality) return res.status(400).json({ error: "Municipality name is required." });

  try {
    const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geoUrl.searchParams.set("name", municipality);
    geoUrl.searchParams.set("count", "5");
    geoUrl.searchParams.set("language", language || "it");
    geoUrl.searchParams.set("format", "json");
    if (countryCode) geoUrl.searchParams.set("countryCode", countryCode);

    const geoResponse = await timeoutFetch(geoUrl.toString());
    if (!geoResponse.ok) throw new Error(`Geocoding failed (${geoResponse.status}).`);
    const geo = await geoResponse.json();
    const result = Array.isArray(geo?.results) ? geo.results[0] : null;
    if (!result || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) {
      throw new Error(`Municipality not found: ${municipality}`);
    }

    const latitude = Number(result.latitude);
    const longitude = Number(result.longitude);
    const pvgisUrl = new URL("https://re.jrc.ec.europa.eu/api/v5_3/PVcalc");
    pvgisUrl.searchParams.set("lat", String(latitude));
    pvgisUrl.searchParams.set("lon", String(longitude));
    pvgisUrl.searchParams.set("peakpower", "1");
    pvgisUrl.searchParams.set("loss", "14");
    pvgisUrl.searchParams.set("pvtechchoice", "crystSi2025");
    pvgisUrl.searchParams.set("mountingplace", "free");
    pvgisUrl.searchParams.set("fixed", "1");
    pvgisUrl.searchParams.set("angle", "0");
    pvgisUrl.searchParams.set("aspect", "0");
    pvgisUrl.searchParams.set("outputformat", "json");

    const solarResponse = await timeoutFetch(pvgisUrl.toString(), 15000);
    if (!solarResponse.ok) throw new Error(`PVGIS failed (${solarResponse.status}).`);
    const solarPayload = await solarResponse.json();
    const monthlyYieldKwhPerKwp = parseMonthlyPvcalc(solarPayload);
    const annualYieldKwhPerKwp = monthlyYieldKwhPerKwp.reduce((sum, value) => sum + value, 0);

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({
      query: municipality,
      resolvedName: result.name || municipality,
      admin1: result.admin1 || "",
      admin2: result.admin2 || "",
      country: result.country || "",
      countryCode: result.country_code || countryCode,
      latitude,
      longitude,
      monthlyYieldKwhPerKwp,
      annualYieldKwhPerKwp,
      solarPlane: "horizontal",
      pvSystemLossPercent: 14,
      pvTechnology: "crystSi2025",
      geocodingSource: "Open-Meteo Geocoding",
      solarSource: "European Commission JRC PVGIS 5.3 PVcalc",
      dataLevel: "municipality",
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error?.name === "AbortError" ? "Solar data request timed out." : (error?.message || String(error));
    return res.status(502).json({ error: message });
  }
}
