const MONTHS = 12;

export const stripMunicipalityPrefix = (value) => String(value || "")
  .trim()
  .replace(/^(comune\s+di|comune|municipality\s+of|municipality)\s+/i, "")
  .trim();

export function parsePvgisMonthly(payload = {}) {
  const raw = payload?.outputs?.monthly;
  const rows = Array.isArray(raw) ? raw : [];
  const grouped = Array.from({ length: MONTHS }, () => []);
  rows.forEach((row) => {
    const month = Number(row?.month);
    const value = Number(row?.["H(h)_m"]);
    if (month >= 1 && month <= 12 && Number.isFinite(value) && value >= 0) grouped[month - 1].push(value);
  });
  const monthlyYieldKwhPerKwp = grouped.map((values) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0);
  if (!monthlyYieldKwhPerKwp.some((value) => value > 0)) throw new Error("PVGIS returned no monthly irradiation data.");
  return monthlyYieldKwhPerKwp;
}

export function parsePvgisPvcalcMonthly(payload = {}) {
  const rows = Array.isArray(payload?.outputs?.monthly?.fixed) ? payload.outputs.monthly.fixed : [];
  const monthly = Array.from({ length: MONTHS }, () => 0);
  rows.forEach((row) => {
    const month = Number(row?.month);
    const value = Number(row?.E_m);
    if (month >= 1 && month <= 12 && Number.isFinite(value) && value >= 0) monthly[month - 1] = value;
  });
  if (!monthly.some((value) => value > 0)) throw new Error("PVGIS returned no monthly PV production data.");
  return monthly;
}

async function resolveViaServer(cleanName, { fetchImpl, countryCode, language }) {
  const params = new URLSearchParams({ municipality: cleanName });
  if (countryCode) params.set("countryCode", countryCode);
  if (language) params.set("language", language);
  const response = await fetchImpl(`/api/hybrid-solar?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Hybrid solar service failed (${response.status}).`);
  if (!Number(payload?.annualYieldKwhPerKwp) || !Array.isArray(payload?.monthlyYieldKwhPerKwp)) {
    throw new Error("Hybrid solar service returned incomplete PVGIS data.");
  }
  return payload;
}

async function resolveDirect(cleanName, { fetchImpl, countryCode, language, originalQuery }) {
  const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geoUrl.searchParams.set("name", cleanName);
  geoUrl.searchParams.set("count", "5");
  geoUrl.searchParams.set("language", language || "it");
  geoUrl.searchParams.set("format", "json");
  if (countryCode) geoUrl.searchParams.set("countryCode", countryCode);

  const geoResponse = await fetchImpl(geoUrl.toString());
  if (!geoResponse.ok) throw new Error(`Geocoding failed (${geoResponse.status}).`);
  const geo = await geoResponse.json();
  const result = Array.isArray(geo?.results) ? geo.results[0] : null;
  if (!result || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) {
    throw new Error(`Municipality not found: ${cleanName}`);
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

  const solarResponse = await fetchImpl(pvgisUrl.toString());
  if (!solarResponse.ok) throw new Error(`PVGIS failed (${solarResponse.status}).`);
  const solarPayload = await solarResponse.json();
  const monthlyYieldKwhPerKwp = parsePvgisPvcalcMonthly(solarPayload);
  const annualYieldKwhPerKwp = monthlyYieldKwhPerKwp.reduce((sum, value) => sum + value, 0);

  return {
    query: originalQuery || cleanName,
    resolvedName: result.name || cleanName,
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
  };
}

export async function resolveMunicipalitySolar(municipality, {
  fetchImpl = fetch,
  countryCode = "IT",
  language = "it",
  preferServer = typeof window !== "undefined",
} = {}) {
  const cleanName = stripMunicipalityPrefix(municipality);
  if (!cleanName) throw new Error("Municipality name is required.");

  if (preferServer) {
    return resolveViaServer(cleanName, { fetchImpl, countryCode, language });
  }
  return resolveDirect(cleanName, { fetchImpl, countryCode, language, originalQuery: municipality });
}
