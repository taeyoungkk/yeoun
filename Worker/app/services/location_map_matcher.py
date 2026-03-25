from __future__ import annotations

import logging
from decimal import Decimal

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


class LocationMapMatcher:
    def __init__(self, settings: Settings):
        self.enabled = settings.gps_map_matching_enabled
        self.provider = settings.gps_map_matching_provider.lower()
        self.profile = settings.gps_map_matching_profile
        self.timeout_seconds = settings.gps_map_matching_timeout_seconds
        self.max_coordinates = max(2, settings.gps_map_matching_max_coordinates)
        self.mapbox_access_token = settings.mapbox_access_token
        self.mapbox_api_base_url = settings.mapbox_api_base_url.rstrip("/")

    async def match_coordinates(
        self,
        coordinates: list[tuple[Decimal, Decimal]],
    ) -> list[tuple[Decimal, Decimal]] | None:
        if not self.enabled:
            return None
        if len(coordinates) < 2:
            return None

        if self.provider != "mapbox":
            logger.warning("Unsupported GPS map matching provider=%s; using fallback route geometry.", self.provider)
            return None

        if not self.mapbox_access_token:
            logger.warning("MAPBOX_ACCESS_TOKEN is not configured; using fallback route geometry.")
            return None

        matched_coordinates: list[tuple[Decimal, Decimal]] = []
        for chunk in self._chunk_coordinates(coordinates):
            chunk_result = await self._match_mapbox_chunk(chunk)
            if not chunk_result:
                return None

            if matched_coordinates and matched_coordinates[-1] == chunk_result[0]:
                matched_coordinates.extend(chunk_result[1:])
            else:
                matched_coordinates.extend(chunk_result)

        deduped = self._dedupe_coordinates(matched_coordinates)
        return deduped if len(deduped) >= 2 else None

    async def _match_mapbox_chunk(
        self,
        coordinates: list[tuple[Decimal, Decimal]],
    ) -> list[tuple[Decimal, Decimal]] | None:
        coordinate_string = ";".join(f"{float(lng)},{float(lat)}" for lng, lat in coordinates)
        url = f"{self.mapbox_api_base_url}/matching/v5/mapbox/{self.profile}/{coordinate_string}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    url,
                    params={
                        "access_token": self.mapbox_access_token,
                        "geometries": "geojson",
                        "overview": "full",
                        "tidy": "true",
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("Map matching request failed: %s", exc)
            return None

        payload = response.json()
        matchings = payload.get("matchings") or []
        if payload.get("code") != "Ok" or not matchings:
            logger.warning("Map matching returned no geometry code=%s", payload.get("code"))
            return None

        geometry = matchings[0].get("geometry") or {}
        geometry_coordinates = geometry.get("coordinates") or []
        matched = self._normalize_coordinates(geometry_coordinates)
        return matched if len(matched) >= 2 else None

    def _chunk_coordinates(
        self,
        coordinates: list[tuple[Decimal, Decimal]],
    ) -> list[list[tuple[Decimal, Decimal]]]:
        if len(coordinates) <= self.max_coordinates:
            return [coordinates]

        chunks: list[list[tuple[Decimal, Decimal]]] = []
        step = self.max_coordinates - 1
        start = 0
        while start < len(coordinates) - 1:
            end = min(start + self.max_coordinates, len(coordinates))
            chunks.append(coordinates[start:end])
            start += step
        return chunks

    def _normalize_coordinates(
        self,
        coordinates: list[list[float]],
    ) -> list[tuple[Decimal, Decimal]]:
        normalized: list[tuple[Decimal, Decimal]] = []
        for coordinate in coordinates:
            if len(coordinate) < 2:
                continue
            normalized.append(
                (
                    Decimal(str(round(float(coordinate[0]), 7))),
                    Decimal(str(round(float(coordinate[1]), 7))),
                )
            )
        return normalized

    def _dedupe_coordinates(
        self,
        coordinates: list[tuple[Decimal, Decimal]],
    ) -> list[tuple[Decimal, Decimal]]:
        deduped: list[tuple[Decimal, Decimal]] = []
        for coordinate in coordinates:
            if deduped and deduped[-1] == coordinate:
                continue
            deduped.append(coordinate)
        return deduped
