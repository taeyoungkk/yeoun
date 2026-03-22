import MockTripRecordingScreen from '@/src/features/trip/screens/MockTripRecordingScreen';

export default function TripRecordingRoute() {
  return <MockTripRecordingScreen reportRoute="/trip/report" useMockData={false} />;
}
