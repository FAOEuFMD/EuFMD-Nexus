"""
BEACON (beaconbio.org) public API client for Fast Report news previews.

Based on NSA/empresi-data-integraton/notebooks/beacon.ipynb.
Uses browser-like headers (API returns 402 without them).
"""
from __future__ import annotations

import asyncio
import re
import time
from typing import Any, Dict, List, Optional, Set

import httpx

BEACON_API = "https://api.beaconbio.org/public"
BEACON_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://beaconbio.org/en/search",
    "Origin": "https://beaconbio.org",
}
REQUEST_DELAY_S = 0.25
FILTER_CACHE_TTL_S = 3600

EUROPE_REGION_ID = "2b34ac84-5467-4180-8f5e-0bac1de12f5a"

EU_COUNTRY_NAMES = {
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
}

# FAST_Report region → country names (EuFMD neighbourhood + Europe)
REGION_COUNTRIES: Dict[str, Set[str]] = {
    "Europe": set(EU_COUNTRY_NAMES),
    "South East European Neighbourhood (SEEN)": {
        "Armenia",
        "Azerbaijan",
        "Georgia",
        "Iran (Islamic Republic of)",
        "Iraq",
        "Pakistan",
        "Türkiye",
    },
    "Near East": {
        "Afghanistan",
        "Egypt",
        "Israel",
        "Jordan",
        "Lebanon",
        "Palestine",
        "Syrian Arab Republic",
    },
    "North Africa": {
        "Algeria",
        "Libya",
        "Mauritania",
        "Morocco",
        "Sudan",
        "Tunisia",
    },
}

ALL_SCOPE_COUNTRIES: Set[str] = set()
for _countries in REGION_COUNTRIES.values():
    ALL_SCOPE_COUNTRIES |= _countries

BEACON_LOCATION_ALIASES = {
    "Czech Republic": "Czechia",
    "Iran (Islamic Republic of)": "Iran, Islamic Republic of",
    "Palestine": "Palestine",
    "Palestine, State of": "Palestine",
    "Syrian Arab Republic": "Syrian Arab Republic",
    "Egypt": "Egypt, Arab Republic",
    "Sudan": "Sudan, Republic of the",
    "Türkiye": "Türkiye",
    "Turkey": "Türkiye",
}

TARGET_DISEASES = {
    "FMD": ["foot-and-mouth"],
    "PPR": ["peste des petits", "ppr"],
    "LSD": ["lumpy skin"],
    "RVF": ["rift valley fever"],
    "SPGP": ["sheep pox", "goat pox"],
}

_filter_cache: Dict[str, Any] = {"ts": 0.0, "data": None}
_resolve_cache: Dict[str, Any] = {"ts": 0.0, "diseases": {}, "locations": {}}


def _strip_html(html: Optional[str], max_len: int = 280) -> str:
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        return text[: max_len - 1].rstrip() + "…"
    return text


async def _beacon_get(path: str, params: Optional[List[tuple]] = None) -> dict:
    url = f"{BEACON_API}/{path.lstrip('/')}"
    await asyncio.sleep(REQUEST_DELAY_S)
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url, headers=BEACON_HEADERS, params=params or [])
        if response.status_code == 402:
            raise RuntimeError(
                "BEACON blocked automated access (402). Contact info@beaconbio.org."
            )
        response.raise_for_status()
        return response.json()


async def get_beacon_filters() -> dict:
    now = time.time()
    if _filter_cache["data"] and now - _filter_cache["ts"] < FILTER_CACHE_TTL_S:
        return _filter_cache["data"]
    data = await _beacon_get("filter")
    _filter_cache["data"] = data
    _filter_cache["ts"] = now
    return data


def _resolve_location_id(filters: dict, reference_name: str) -> Optional[str]:
    locations = filters.get("locations") or []
    by_name = {(item.get("name") or "").lower(): item for item in locations}
    beacon_name = BEACON_LOCATION_ALIASES.get(reference_name, reference_name)
    hit = by_name.get(beacon_name.lower())
    if hit:
        return hit.get("id")
    token = reference_name.split()[0].lower()
    for name, item in by_name.items():
        if name.startswith(token):
            return item.get("id")
    return None


def _resolve_disease_id(filters: dict, code: str) -> Optional[str]:
    terms = TARGET_DISEASES.get(code) or []
    for item in filters.get("diseases") or []:
        name = (item.get("name") or "").lower()
        if any(term in name for term in terms):
            return item.get("id")
    return None


async def resolve_lookups() -> Dict[str, Any]:
    now = time.time()
    if _resolve_cache["diseases"] and now - _resolve_cache["ts"] < FILTER_CACHE_TTL_S:
        return _resolve_cache

    filters = await get_beacon_filters()
    diseases = {}
    for code in TARGET_DISEASES:
        did = _resolve_disease_id(filters, code)
        if did:
            diseases[code] = did

    locations = {}
    for country in sorted(ALL_SCOPE_COUNTRIES):
        lid = _resolve_location_id(filters, country)
        if lid:
            locations[country] = lid

    _resolve_cache["diseases"] = diseases
    _resolve_cache["locations"] = locations
    _resolve_cache["ts"] = now
    return _resolve_cache


def countries_for_region(region: Optional[str]) -> Set[str]:
    if not region or region.lower() == "all":
        return set(ALL_SCOPE_COUNTRIES)
    if region in REGION_COUNTRIES:
        return set(REGION_COUNTRIES[region])
    # Partial match (e.g. "SEEN")
    for key, countries in REGION_COUNTRIES.items():
        if region.lower() in key.lower() or key.lower() in region.lower():
            return set(countries)
    return set(ALL_SCOPE_COUNTRIES)


def _build_params(
    *,
    disease_ids: List[str],
    location_ids: Optional[List[str]] = None,
    region_ids: Optional[List[str]] = None,
    limit: int,
    page: int,
) -> List[tuple]:
    params: List[tuple] = []
    for did in disease_ids:
        params.append(("diseases[]", did))
    for rid in region_ids or []:
        params.append(("regions[]", rid))
    for lid in location_ids or []:
        params.append(("locations[]", lid))
    params.append(("limit", str(limit)))
    params.append(("page", str(page)))
    return params


def _report_url(report_id: str, disease_id: Optional[str], event_ids: List[str]) -> str:
    parts = [f"reportid={report_id}"]
    if disease_id:
        parts.append(f"diseases={disease_id}")
    if event_ids:
        parts.append(f"eventid={event_ids[0]}")
    return "https://beaconbio.org/en/report/?" + "&".join(parts)


def flatten_report(item: dict, disease_code: str, disease_id: Optional[str]) -> dict:
    version = item.get("latestVersion") or {}
    locs = version.get("location") or []
    disease_list = (version.get("diseaseList") or {}).get("processed") or []
    event_ids = item.get("eventIds") or []
    summary = version.get("summaryShort") or _strip_html(version.get("summaryLong"))
    report_id = item.get("id")
    return {
        "id": report_id,
        "diseaseCode": disease_code,
        "publishedAt": item.get("publishedAt"),
        "eventDate": version.get("eventDate"),
        "title": version.get("title"),
        "summary": summary,
        "locations": [loc.get("name") for loc in locs if loc.get("name")],
        "diseases": disease_list,
        "reliabilityScore": version.get("reliabilityScore"),
        "url": _report_url(report_id, disease_id, event_ids) if report_id else None,
        "source": "BEACON",
    }


def _match_disease_code(processed_names: List[str], codes: List[str]) -> str:
    for code in codes:
        terms = TARGET_DISEASES.get(code) or []
        if any(any(t in name for t in terms) for name in processed_names):
            return code
    return codes[0]


LOCATION_BATCH_SIZE = 10


def _chunked(items: List[str], size: int) -> List[List[str]]:
    if not items:
        return []
    return [items[i : i + size] for i in range(0, len(items), size)]


async def _fetch_report_page(
    *,
    disease_ids: List[str],
    location_ids: Optional[List[str]],
    region_ids: Optional[List[str]],
    limit: int,
) -> dict:
    params = _build_params(
        disease_ids=disease_ids,
        location_ids=location_ids,
        region_ids=region_ids,
        limit=limit,
        page=0,
    )
    return await _beacon_get("report", params)


async def _fetch_by_locations(
    *,
    disease_ids: List[str],
    location_ids: List[str],
    limit: int,
) -> List[dict]:
    """BEACON 400s when too many locations[] are sent at once — batch them."""
    payloads: List[dict] = []
    for batch in _chunked(location_ids, LOCATION_BATCH_SIZE):
        payloads.append(
            await _fetch_report_page(
                disease_ids=disease_ids,
                location_ids=batch,
                region_ids=None,
                limit=limit,
            )
        )
    return payloads


async def fetch_beacon_news(
    *,
    region: str = "all",
    disease_codes: Optional[List[str]] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    lookups = await resolve_lookups()
    disease_map: Dict[str, str] = lookups["diseases"]
    location_map: Dict[str, str] = lookups["locations"]

    codes = [c.upper() for c in (disease_codes or []) if c]
    codes = [c for c in codes if c in disease_map]
    if not codes:
        codes = ["FMD"] if "FMD" in disease_map else list(disease_map.keys())[:1]

    disease_ids = [disease_map[c] for c in codes]
    page_limit = min(max(limit, 1), 50)

    payloads: List[dict] = []
    location_count = 0
    region_norm = (region or "all").strip()

    if region_norm.lower() == "all":
        payloads.append(
            await _fetch_report_page(
                disease_ids=disease_ids,
                location_ids=None,
                region_ids=[EUROPE_REGION_ID],
                limit=page_limit,
            )
        )
        neighbour_countries = ALL_SCOPE_COUNTRIES - EU_COUNTRY_NAMES
        neighbour_ids = [
            location_map[c] for c in sorted(neighbour_countries) if c in location_map
        ]
        location_count = len(neighbour_ids)
        if neighbour_ids:
            payloads.extend(
                await _fetch_by_locations(
                    disease_ids=disease_ids,
                    location_ids=neighbour_ids,
                    limit=page_limit,
                )
            )
    elif region_norm.lower() == "europe":
        payloads.append(
            await _fetch_report_page(
                disease_ids=disease_ids,
                location_ids=None,
                region_ids=[EUROPE_REGION_ID],
                limit=page_limit,
            )
        )
    else:
        countries = countries_for_region(region_norm)
        # Never dump the full EU list as locations[] — use continent region instead
        if countries and countries <= EU_COUNTRY_NAMES:
            payloads.append(
                await _fetch_report_page(
                    disease_ids=disease_ids,
                    location_ids=None,
                    region_ids=[EUROPE_REGION_ID],
                    limit=page_limit,
                )
            )
        else:
            location_ids = [location_map[c] for c in sorted(countries) if c in location_map]
            location_count = len(location_ids)
            if not location_ids:
                return {
                    "region": region_norm,
                    "diseases": codes,
                    "count": 0,
                    "data": [],
                    "warning": "No BEACON location IDs resolved for this region",
                }
            payloads.extend(
                await _fetch_by_locations(
                    disease_ids=disease_ids,
                    location_ids=location_ids,
                    limit=page_limit,
                )
            )

    rows = []
    seen = set()
    total_items = 0
    for payload in payloads:
        total_items += int(payload.get("totalItems") or 0)
        for item in payload.get("data") or []:
            version = item.get("latestVersion") or {}
            processed = [
                (d or "").lower()
                for d in ((version.get("diseaseList") or {}).get("processed") or [])
            ]
            matched_code = _match_disease_code(processed, codes)
            matched_id = disease_map.get(matched_code)
            flat = flatten_report(item, matched_code, matched_id)
            if flat["id"] and flat["id"] not in seen:
                seen.add(flat["id"])
                rows.append(flat)

    rows.sort(key=lambda r: r.get("publishedAt") or r.get("eventDate") or "", reverse=True)
    rows = rows[:page_limit]

    return {
        "region": region_norm,
        "diseases": codes,
        "locationCount": location_count,
        "totalItems": total_items,
        "count": len(rows),
        "data": rows,
        "attribution": "BEACON (Biothreats Emergence, Analysis and Communications Network). Not official WAHIS data.",
    }
