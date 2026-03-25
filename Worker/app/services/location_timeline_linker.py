import logging
from uuid import NAMESPACE_URL, uuid5

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
                    candidateId=self._candidate_id(trip_id, user_id, "ROUTE_DAY", route_day.day),
                    tripId=trip_id,
                    userId=user_id,
                    candidateType="ROUTE_DAY",
                    referenceId=route_day.day,
                    startedAt=route_day.started_at,
                    endedAt=route_day.ended_at,
                    title=f"{route_day.day} route",
                )
            )

        for place in places:
            candidates.append(
                LocationTimelineCandidate(
                    candidateId=self._candidate_id(trip_id, user_id, "PLACE", place.place_id),
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

    def _candidate_id(self, trip_id: str, user_id: str, candidate_type: str, reference_id: str) -> str:
        return str(uuid5(NAMESPACE_URL, f"{trip_id}:{user_id}:{candidate_type}:{reference_id}"))
