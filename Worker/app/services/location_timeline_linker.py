import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.location import LocationPlaceCandidate, LocationRouteDay, LocationTimelineCandidate

logger = logging.getLogger(__name__)


class LocationTimelineLinker:
    """Build timeline candidate payloads from GPS-derived route/place results."""

    def build_candidates(
        self,
        trip_id: str,
        user_id: str,
        route_days: list[LocationRouteDay],
        places: list[LocationPlaceCandidate],
    ) -> list[LocationTimelineCandidate]:
        candidates: list[LocationTimelineCandidate] = []

        for route_day in route_days:
            candidates.append(
                LocationTimelineCandidate(
                    candidateId=str(uuid4()),
                    tripId=trip_id,
                    userId=user_id,
                    candidateType="ROUTE_DAY",
                    referenceId=route_day.day,
                    startedAt=self._route_started_at(route_day),
                    endedAt=self._route_started_at(route_day),
                    title=f"{route_day.day} route",
                )
            )

        for place in places:
            candidates.append(
                LocationTimelineCandidate(
                    candidateId=str(uuid4()),
                    tripId=trip_id,
                    userId=user_id,
                    candidateType="PLACE",
                    referenceId=place.place_id,
                    startedAt=place.started_at,
                    endedAt=place.ended_at,
                    title="gps-place",
                )
            )

        logger.info(
            "Built timeline candidates tripId=%s routeDays=%s places=%s candidates=%s",
            trip_id,
            len(route_days),
            len(places),
            len(candidates),
        )
        return candidates

    def _route_started_at(self, route_day: LocationRouteDay):
        return datetime.fromisoformat(f"{route_day.day}T00:00:00+00:00").astimezone(timezone.utc)
