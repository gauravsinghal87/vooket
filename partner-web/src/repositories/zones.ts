import { api } from '@/lib/api';
import type { Zone, VehicleType } from '@/typings/models';

export const zonesApi = {
  list: () => api<Zone[]>('/zones'),
};

export const vehicleApi = {
  list: () => api<VehicleType[]>('/vehicle-types'),
};
