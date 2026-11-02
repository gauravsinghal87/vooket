import type { RideRepository } from '../interfaces';
import type { VehicleType, RideEstimate, Ride, RideRoute, NearbyDriver } from '@/shared/types/models';
import { mockVehicleTypes, mockSavedPlaces, mockRidePromos } from './data';

const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

let mockRides: Ride[] = [];

function seedRides() {
  if (mockRides.length) return;
  const now = Date.now();
  mockRides = [
    {
      id: 1, ride_number: 'RD-1001', user_id: 1, driver_id: 1, vehicle_id: null, vehicle_type_id: 3,
      status: 'TRIP_COMPLETED',
      pickup_address: '12 MG Road', pickup_latitude: '28.6139', pickup_longitude: '77.2090',
      destination_address: 'Cyber City', destination_latitude: '28.4595', destination_longitude: '77.0266',
      distance_km: '21.4', duration_min: 45,
      base_fare: '60.00', distance_charge: '160.00', time_charge: '40.00', booking_fee: '10.00',
      platform_fee: '5.00', estimated_fare: '275.00', final_fare: '268.00',
      coupon_code: null, payment_method: 'wallet', payment_status: 'PAID',
      is_scheduled: false, scheduled_at: null,
      driver_assigned_at: null, driver_arriving_at: null, driver_arrived_at: null,
      trip_started_at: null, trip_completed_at: new Date(now - 2 * 86400000 + 3600000).toISOString(),
      cancelled_at: null, cancel_reason: null,
      driver: { id: 1, name: 'Ravi Kumar', phone: '9876543210', rating: '4.8' },
      created_at: new Date(now - 2 * 86400000).toISOString(),
    },
    {
      id: 2, ride_number: 'RD-1002', user_id: 1, driver_id: 2, vehicle_id: null, vehicle_type_id: 2,
      status: 'TRIP_COMPLETED',
      pickup_address: 'Connaught Place', pickup_latitude: '28.6315', pickup_longitude: '77.2167',
      destination_address: 'Karol Bagh', destination_latitude: '28.6450', destination_longitude: '77.1900',
      distance_km: '4.8', duration_min: 18,
      base_fare: '35.00', distance_charge: '43.00', time_charge: '18.00', booking_fee: '10.00',
      platform_fee: '4.00', estimated_fare: '110.00', final_fare: '120.00',
      coupon_code: null, payment_method: 'cash', payment_status: 'PENDING',
      is_scheduled: false, scheduled_at: null,
      driver_assigned_at: null, driver_arriving_at: null, driver_arrived_at: null,
      trip_started_at: null, trip_completed_at: new Date(now - 5 * 86400000 + 3600000).toISOString(),
      cancelled_at: null, cancel_reason: null,
      driver: { id: 2, name: 'Imran Shaikh', phone: '9876501234', rating: '4.6' },
      created_at: new Date(now - 5 * 86400000).toISOString(),
    },
  ];
}
seedRides();

function haversine(a: number, b: number, c: number, d: number): number {
  const R = 6371;
  const dLat = ((c - a) * Math.PI) / 180;
  const dLon = ((d - b) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function toMoney(n: number): string {
  return n.toFixed(2);
}

export class MockRideRepository implements RideRepository {
  async getVehicleTypes(): Promise<VehicleType[]> {
    await delay(200);
    return [...mockVehicleTypes];
  }

  async estimate({
    pickup_latitude,
    pickup_longitude,
    destination_latitude,
    destination_longitude,
    vehicle_type_id,
  }: {
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
    vehicle_type_id?: number;
  }): Promise<RideEstimate[]> {
    await delay(600);
    const distanceKm = haversine(pickup_latitude, pickup_longitude, destination_latitude, destination_longitude);
    const durationMin = Math.round((distanceKm / 25) * 60);

    const estimates: RideEstimate[] = mockVehicleTypes.map((v) => {
      let base = 30;
      let perKm = 8;
      if (v.code === 'bike') {
        base = 25;
        perKm = 7;
      } else if (v.code === 'auto') {
        base = 35;
        perKm = 9;
      } else if (v.code === 'cab') {
        base = 60;
        perKm = 14;
      } else if (v.code === 'cab_xl') {
        base = 90;
        perKm = 19;
      }
      const distanceCharge = Math.round(distanceKm * perKm);
      const timeCharge = Math.round(durationMin * 1.2);
      const bookingFee = 10;
      const platformFee = Math.round((base + distanceCharge + timeCharge + bookingFee) * 0.03);
      const estimatedFare = Math.round((base + distanceCharge + timeCharge + bookingFee + platformFee) / 5) * 5;
      return {
        vehicle_type: v,
        distance_km: Math.round(distanceKm * 100) / 100,
        duration_min: durationMin,
        base_fare: toMoney(base),
        distance_charge: toMoney(distanceCharge),
        time_charge: toMoney(timeCharge),
        booking_fee: toMoney(bookingFee),
        platform_fee: toMoney(platformFee),
        tax_amount: '0.00',
        estimated_fare: toMoney(estimatedFare),
        fare_rule_id: 1,
      };
    });

    if (vehicle_type_id) {
      const selected = estimates.find((e) => e.vehicle_type.id === vehicle_type_id);
      return selected ? [selected] : [estimates[0]];
    }
    return estimates;
  }

  async getRoute({
    pickup_latitude,
    pickup_longitude,
    destination_latitude,
    destination_longitude,
  }: {
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
  }): Promise<RideRoute> {
    await delay(400);
    const distanceKm = haversine(pickup_latitude, pickup_longitude, destination_latitude, destination_longitude);
    return {
      distance_km: Math.round(distanceKm * 100) / 100,
      duration_min: Math.max(2, Math.round((distanceKm / 25) * 60)),
      polyline: null,
      source: 'haversine',
      status: 'OK',
    };
  }

  async getNearbyDrivers(params: {
    latitude: number;
    longitude: number;
    vehicle_type_id?: number;
    radius_km?: number;
  }): Promise<NearbyDriver[]> {
    void params;
    await delay(250);
    return [];
  }

  async book(params: {
    vehicle_type_id: number;
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
    pickup_address?: string;
    destination_address?: string;
    payment_method?: 'cash' | 'wallet' | 'online';
    scheduled_at?: string;
    idempotency_key?: string;
  }): Promise<Ride> {
    await delay(700);
    const vehicle = mockVehicleTypes.find((v) => v.id === params.vehicle_type_id) ?? mockVehicleTypes[2];
    const ride: Ride = {
      id: Date.now(),
      ride_number: `RD-${1000 + mockRides.length + 1}`,
      user_id: 1,
      driver_id: null,
      vehicle_id: null,
      vehicle_type_id: vehicle.id,
      status: 'SEARCHING_DRIVER',
      pickup_address: params.pickup_address ?? 'Pickup',
      pickup_latitude: String(params.pickup_latitude ?? ''),
      pickup_longitude: String(params.pickup_longitude ?? ''),
      destination_address: params.destination_address ?? 'Drop',
      destination_latitude: String(params.destination_latitude ?? ''),
      destination_longitude: String(params.destination_longitude ?? ''),
      distance_km: null,
      duration_min: null,
      base_fare: '0.00',
      distance_charge: '0.00',
      time_charge: '0.00',
      booking_fee: '10.00',
      platform_fee: '5.00',
      estimated_fare: '0.00',
      final_fare: null,
      coupon_code: null,
      payment_method: params.payment_method ?? 'wallet',
      payment_status: 'PENDING',
      is_scheduled: false,
      scheduled_at: params.scheduled_at ?? null,
      driver_assigned_at: null,
      driver_arriving_at: null,
      driver_arrived_at: null,
      trip_started_at: null,
      trip_completed_at: null,
      cancelled_at: null,
      cancel_reason: null,
      driver: null,
      created_at: new Date().toISOString(),
    };
    mockRides.unshift(ride);
    return ride;
  }

  async getRide(id: number): Promise<Ride> {
    await delay(300);
    const ride = mockRides.find((r) => r.id === id);
    if (!ride) throw new Error('Ride not found');
    return ride;
  }

  async getRideHistory(): Promise<Ride[]> {
    await delay();
    return [...mockRides];
  }

  async cancel(id: number, _reason?: string): Promise<Ride> {
    await delay(400);
    const ride = mockRides.find((r) => r.id === id);
    if (!ride) throw new Error('Ride not found');
    ride.status = 'CANCELLED';
    ride.cancelled_at = new Date().toISOString();
    return ride;
  }

  async rate(_id: number, _rating: number, _comment?: string) {
    await delay(300);
  }

  async getSavedPlaces() {
    await delay(150);
    return [...mockSavedPlaces];
  }

  async savePlace(data: { label: string; address: string; latitude: number; longitude: number; icon?: string }) {
    await delay(200);
    const place = {
      id: Date.now(),
      label: data.label,
      address: data.address,
      latitude: String(data.latitude),
      longitude: String(data.longitude),
      icon: data.icon ?? null,
    };
    mockSavedPlaces.push(place);
    return place;
  }

  async deleteSavedPlace(id: number) {
    await delay(200);
    const idx = mockSavedPlaces.findIndex((p) => p.id === id);
    if (idx >= 0) mockSavedPlaces.splice(idx, 1);
  }

  async getPromos() {
    await delay(150);
    return [...mockRidePromos];
  }
}
