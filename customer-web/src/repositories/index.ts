import type {
  FoodRepository,
  GroceryRepository,
  RideRepository,
  OrderRepository,
  CartRepository,
  WalletRepository,
  PaymentRepository,
  UserRepository,
  SearchRepository,
  BannerRepository,
} from './interfaces';
import { getDataSource } from '@/config/dataSource';
import { MockFoodRepository, MockGroceryRepository, MockRideRepository, MockOrderRepository, MockCartRepository, MockWalletRepository, MockPaymentRepository, MockUserRepository, MockSearchRepository, MockBannerRepository } from './mock';
import { ApiFoodRepository, ApiGroceryRepository, ApiRideRepository, ApiOrderRepository, ApiCartRepository, ApiWalletRepository, ApiPaymentRepository, ApiUserRepository, ApiSearchRepository, ApiBannerRepository } from './api';

export interface Repositories {
  food: FoodRepository;
  grocery: GroceryRepository;
  rides: RideRepository;
  orders: OrderRepository;
  cart: CartRepository;
  wallet: WalletRepository;
  payments: PaymentRepository;
  user: UserRepository;
  search: SearchRepository;
  banners: BannerRepository;
}

function buildRepositories(dataSource: 'mock' | 'api'): Repositories {
  if (dataSource === 'api') {
    return {
      food: new ApiFoodRepository(),
      grocery: new ApiGroceryRepository(),
      rides: new ApiRideRepository(),
      orders: new ApiOrderRepository(),
      cart: new ApiCartRepository(),
      wallet: new ApiWalletRepository(),
      payments: new ApiPaymentRepository(),
      user: new ApiUserRepository(),
      search: new ApiSearchRepository(),
      banners: new ApiBannerRepository(),
    };
  }
  return {
    food: new MockFoodRepository(),
    grocery: new MockGroceryRepository(),
    rides: new MockRideRepository(),
    orders: new MockOrderRepository(),
    cart: new MockCartRepository(),
    wallet: new MockWalletRepository(),
    payments: new MockPaymentRepository(),
    user: new MockUserRepository(),
    search: new MockSearchRepository(),
    banners: new MockBannerRepository(),
  };
}

export const repositories: Repositories = buildRepositories(getDataSource());
