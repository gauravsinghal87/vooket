import type { Restaurant, Store, Product, Category, ProductCategory, Banner, Offer } from '@/shared/types/catalog';
import type { VehicleType } from '@/shared/types/models';
import type { MonthlySuggestion, DeliverySlot } from '@/shared/repositories/interfaces';

const img = (seed: string, w = 600) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=${w}&q=80`;

export const mockCategories: Category[] = [
  { id: 1, name: 'North Indian', slug: 'north-indian', image: img('1547592180-85f173990554'), navigation_icon: null, icon: null, description: 'Rich curries & breads', parent_id: null, type: 'food', sort_order: 1, is_active: true },
  { id: 2, name: 'Chinese', slug: 'chinese', image: img('1579871494447-9811cf80d66c'), navigation_icon: null, icon: null, description: 'Wok-tossed favourites', parent_id: null, type: 'food', sort_order: 2, is_active: true },
  { id: 3, name: 'Pizza & Burgers', slug: 'pizza-burgers', image: img('1513104890138-7c749659a591'), navigation_icon: null, icon: null, description: 'Fast food classics', parent_id: null, type: 'food', sort_order: 3, is_active: true },
  { id: 4, name: 'South Indian', slug: 'south-indian', image: img('1589301763274-2893aaf65eef'), navigation_icon: null, icon: null, description: 'Dosas, idlis & filter coffee', parent_id: null, type: 'food', sort_order: 4, is_active: true },
  { id: 5, name: 'Desserts', slug: 'desserts', image: img('1551913902-c92202466a57'), navigation_icon: null, icon: null, description: 'Sweet endings', parent_id: null, type: 'food', sort_order: 5, is_active: true },
  { id: 6, name: 'Fruits & Vegetables', slug: 'fruits-vegetables', image: img('1610832958506-aa56368176cf'), navigation_icon: null, icon: null, description: 'Fresh produce', parent_id: null, type: 'grocery', sort_order: 1, is_active: true },
  { id: 7, name: 'Dairy & Bakery', slug: 'dairy-bakery', image: img('1550583724-b2692b85b150'), navigation_icon: null, icon: null, description: 'Milk, butter & bread', parent_id: null, type: 'grocery', sort_order: 2, is_active: true },
  { id: 8, name: 'Staples', slug: 'staples', image: img('1586417547404-7532edf61b13'), navigation_icon: null, icon: null, description: 'Flour, oil & rice', parent_id: null, type: 'grocery', sort_order: 3, is_active: true },
  { id: 9, name: 'Snacks & Beverages', slug: 'snacks-beverages', image: img('1597318181409-cf64d0b5d8a2'), navigation_icon: null, icon: null, description: 'Chips & cold drinks', parent_id: null, type: 'grocery', sort_order: 4, is_active: true },
  { id: 10, name: 'Household', slug: 'household', image: img('1585421514738-01798e348b17'), navigation_icon: null, icon: null, description: 'Cleaning & essentials', parent_id: null, type: 'grocery', sort_order: 5, is_active: true },
];

export const mockRestaurants: Restaurant[] = [
  {
    id: 1, vendor_id: 1, name: 'Spice Villa', slug: 'spice-villa', cuisine_type: 'North Indian, Mughlai',
    description: 'Authentic North Indian comfort food, rich curries and freshly baked naan.',
    address: 'Connaught Place, New Delhi', latitude: '28.6139', longitude: '77.2090', phone: '9812345678',
    logo: img('1547592180-85f173990554'), cover_image: img('1547592180-85f173990554', 1200),
    opens_at: '10:00:00', closes_at: '23:00:00', is_open: true, is_featured: true, is_veg: false,
    is_halal: false, dine_in: true, avg_prep_time_min: '15.0', avg_delivery_time_min: '30.0', order_type: 'both',
    rating: '4.6', rating_count: 250, min_order_amount: '100', delivery_fee: '30', free_delivery_above: '500',
  },
  {
    id: 2, vendor_id: 1, name: 'Biryani House', slug: 'biryani-house', cuisine_type: 'Hyderabadi, Biryani',
    description: 'Slow-cooked dum biryanis and rich side dishes. A biryani lover’s paradise.',
    address: 'Karol Bagh, New Delhi', latitude: '28.6450', longitude: '77.1900', phone: '9823456789',
    logo: img('1563379926898-05f4575a45d8'), cover_image: img('1563379926898-05f4575a45d8', 1200),
    opens_at: '11:00:00', closes_at: '22:30:00', is_open: true, is_featured: true, is_veg: false,
    is_halal: true, dine_in: true, avg_prep_time_min: '18.0', avg_delivery_time_min: '35.0', order_type: 'both',
    rating: '4.3', rating_count: 540, min_order_amount: '150', delivery_fee: '40', free_delivery_above: '600',
  },
  {
    id: 3, vendor_id: 1, name: 'Green Bowl Salads', slug: 'green-bowl-salads', cuisine_type: 'Healthy, Salads, Continental',
    description: 'Fresh, nutritious bowls and wraps that keep you energised all day.',
    address: 'Saket, New Delhi', latitude: '28.5245', longitude: '77.2060', phone: '9834567890',
    logo: img('1512621776951-a57141f2eefd'), cover_image: img('1512621776951-a57141f2eefd', 1200),
    opens_at: '09:00:00', closes_at: '21:00:00', is_open: true, is_featured: false, is_veg: true,
    is_halal: true, dine_in: false, avg_prep_time_min: '10.0', avg_delivery_time_min: '22.0', order_type: 'delivery',
    rating: '4.5', rating_count: 180, min_order_amount: '80', delivery_fee: '25', free_delivery_above: '300',
  },
  {
    id: 4, vendor_id: 1, name: 'Mad Over Pizza', slug: 'mad-over-pizza', cuisine_type: 'Pizza, Fast Food',
    description: 'Wood-fired pizzas loaded with toppings and gooey cheese.',
    address: 'Lajpat Nagar, New Delhi', latitude: '28.5670', longitude: '77.2440', phone: '9845678901',
    logo: img('1513104890138-7c749659a591'), cover_image: img('1513104890138-7c749659a591', 1200),
    opens_at: '11:30:00', closes_at: '23:00:00', is_open: true, is_featured: true, is_veg: false,
    is_halal: false, dine_in: true, avg_prep_time_min: '14.0', avg_delivery_time_min: '32.0', order_type: 'both',
    rating: '4.2', rating_count: 320, min_order_amount: '120', delivery_fee: '35', free_delivery_above: '400',
  },
  {
    id: 5, vendor_id: 1, name: 'Dosa Junction', slug: 'dosa-junction', cuisine_type: 'South Indian',
    description: 'Crispy dosas, fluffy idlis and filter coffee straight from the south.',
    address: 'Rajouri Garden, New Delhi', latitude: '28.6400', longitude: '77.1200', phone: '9856789012',
    logo: img('1589301763274-2893aaf65eef'), cover_image: img('1589301763274-2893aaf65eef', 1200),
    opens_at: '07:00:00', closes_at: '22:00:00', is_open: true, is_featured: false, is_veg: true,
    is_halal: true, dine_in: false, avg_prep_time_min: '8.0', avg_delivery_time_min: '20.0', order_type: 'both',
    rating: '4.4', rating_count: 210, min_order_amount: '90', delivery_fee: '20', free_delivery_above: '250',
  },
];

const mkProduct = (
  id: number,
  name: string,
  restId: number,
  catId: number,
  price: string,
  isVeg: boolean,
  type: 'food' | 'grocery',
  image: string,
  desc: string,
  extra: Partial<Product> = {},
  compare?: string
): Product => ({
  id, vendor_id: 1, store_id: null, restaurant_id: restId, category_id: catId, brand_id: null,
  type, name, slug: name.toLowerCase().replace(/\s+/g, '-'), description: desc,
  price, compare_at_price: compare ?? null, image, images: [image], is_veg: isVeg,
  is_featured: false, is_active: true, is_available: true, tax_rate: '5',
  min_order_qty: 1, max_order_qty: null, preparation_time_min: null,
  addons: [], variants: [], ...extra,
});

export const mockMenu: ProductCategory[] = [
  {
    id: 1, name: 'Starters', slug: 'starters',
    products: [
      mkProduct(1, 'Paneer Tikka', 1, 1, '249', true, 'food', img('1567188040759-fb8a883dcb40'), 'Char-grilled cottage cheese with mint chutney', { preparation_time_min: '15' }),
      mkProduct(2, 'Chicken Malai Tikka', 1, 1, '299', false, 'food', img('1599487488170-dad043974661'), 'Creamy, succulent chicken tikka skewers', { preparation_time_min: '15' }),
      mkProduct(3, 'Veg Manchurian', 1, 2, '189', true, 'food', img('1579871494447-9811cf80d66c'), 'Crispy veg balls in spicy garlic sauce', { preparation_time_min: '12' }),
    ],
  },
  {
    id: 2, name: 'Main Course', slug: 'main-course',
    products: [
      mkProduct(4, 'Butter Chicken', 1, 1, '359', false, 'food', img('1603894584378-5ac82b60ae4d'), 'Tandoori chicken in rich tomato-butter gravy', { preparation_time_min: '20' }),
      mkProduct(5, 'Paneer Butter Masala', 1, 1, '289', true, 'food', img('1631452180519-c014fe946bc7'), 'Paneer in silky creamy tomato gravy', { preparation_time_min: '18' }),
      mkProduct(6, 'Dal Makhani', 1, 1, '239', true, 'food', img('1585937421612-70a008356fbe'), 'Slow-cooked black lentils with butter', { preparation_time_min: '15' }),
      mkProduct(7, 'Garlic Naan', 1, 1, '79', true, 'food', img('1601050690597-df0568f70950'), 'Crispy naan with garlic and butter', { preparation_time_min: '8' }),
    ],
  },
  {
    id: 3, name: 'Desserts', slug: 'desserts',
    products: [
      mkProduct(8, 'Gulab Jamun (2 pcs)', 1, 5, '99', true, 'food', img('1551913902-c92202466a57'), 'Classic warm gulab jamun', { preparation_time_min: '5' }),
      mkProduct(9, 'Chocolate Brownie', 1, 5, '129', true, 'food', img('1606312619070-d48b4c652a52'), 'Fudgy chocolate brownie with ice cream', { preparation_time_min: '10' }),
    ],
  },
];

export const mockStores: Store[] = [
  {
    id: 1, vendor_id: 2, name: 'FreshMart Supermarket', slug: 'freshmart-supermarket', store_type: 'supermarket',
    description: 'Everything you need for your weekly groceries in one place.',
    address: 'Janpath, New Delhi', latitude: '28.6315', longitude: '77.2167', phone: '9823456789',
    logo: img('1578916171728-46686eac8d58'), cover_image: img('1578916171728-46686eac8d58', 1200),
    opens_at: '08:00:00', closes_at: '22:00:00', is_open: true, is_featured: true,
    rating: '4.3', rating_count: 180, min_order_amount: '200', delivery_fee: '40', free_delivery_above: '499',
    supports_instant_delivery: true, supports_scheduled_delivery: true,
    order_type: 'both', substitution_policy: 'contact',
  },
  {
    id: 2, vendor_id: 2, name: 'Daily Essentials Mart', slug: 'daily-essentials-mart', store_type: 'convenience',
    description: 'Quick daily needs delivered in minutes.',
    address: 'Vasant Vihar, New Delhi', latitude: '28.5650', longitude: '77.1570', phone: '9923456789',
    logo: img('1556742049-0cfed4f6a45d'), cover_image: img('1556742049-0cfed4f6a45d', 1200),
    opens_at: '07:00:00', closes_at: '23:00:00', is_open: true, is_featured: false,
    rating: '4.1', rating_count: 95, min_order_amount: '150', delivery_fee: '30', free_delivery_above: '399',
    supports_instant_delivery: true, supports_scheduled_delivery: false,
    order_type: 'both', substitution_policy: 'contact',
  },
];

export const mockProducts: Product[] = [
  mkProduct(21, 'Aashirvaad Atta 5kg', 0, 8, '265', true, 'grocery', img('1586417547404-7532edf61b13'), 'Whole wheat chakki atta, 5 kg', { store_id: 1, unit_label: '5kg', min_order_qty: 1 }, '299'),
  mkProduct(22, 'Amul Taaza Milk 1L', 0, 7, '58', true, 'grocery', img('1550583724-b2692b85b150'), 'Tonked milk, 1 litre', { store_id: 1, unit_label: '1L' }, '62'),
  mkProduct(23, 'Fortune Sunflower Oil 1L', 0, 8, '145', true, 'grocery', img('1621939514649-280e491ee3d5'), 'Refined sunflower oil, 1 litre', { store_id: 1, unit_label: '1L' }, '158'),
  mkProduct(24, 'Tata Salt 1kg', 0, 8, '28', true, 'grocery', img('1605675429537-2dcfe1b8aa4b'), 'Iodised table salt, 1 kg', { store_id: 1, unit_label: '1kg' }),
  mkProduct(25, 'Basmati Rice 5kg', 0, 8, '390', true, 'grocery', img('1586201375761-838650eee31a'), 'Premium long-grain basmati rice, 5 kg', { store_id: 1, unit_label: '5kg', is_featured: true }, '430'),
  mkProduct(26, 'Onion 1kg', 0, 6, '35', true, 'grocery', img('1518977956812-cd3dbadaaf31'), 'Fresh red onions, 1 kg', { store_id: 1, unit_label: '1kg' }),
  mkProduct(27, 'Tomato 500g', 0, 6, '25', true, 'grocery', img('1592924357228-91a4daadcfea'), 'Fresh tomatoes, 500 g', { store_id: 1, unit_label: '500g' }),
  mkProduct(28, 'Apple 1kg', 0, 6, '179', true, 'grocery', img('1560806887-1e4cd0b6cbd6'), 'Shimla apples, 1 kg', { store_id: 1, unit_label: '1kg', is_featured: true }, '199'),
  mkProduct(29, 'Lay’s Classic 52g', 0, 9, '20', true, 'grocery', img('1566478989037-eec170784d0d'), 'Classic salted potato chips', { store_id: 1, unit_label: '52g' }),
  mkProduct(30, 'Coca-Cola 750ml', 0, 9, '40', true, 'grocery', img('1629203851122-3726ecdf080e'), 'Chilled cola, 750 ml', { store_id: 1, unit_label: '750ml' }),
  mkProduct(31, 'Amul Butter 500g', 0, 7, '275', true, 'grocery', img('1589985270826-4b7bb135bc9d'), 'Pure dairy butter, 500 g', { store_id: 1, unit_label: '500g' }),
  mkProduct(32, 'Surf Excel 1kg', 0, 10, '140', true, 'grocery', img('1585421514738-01798e348b17'), 'Detergent powder, 1 kg', { store_id: 1, unit_label: '1kg' }),
];

export const mockVehicleTypes: VehicleType[] = [
  { id: 1, name: 'Bike', code: 'bike', icon: null, description: '1 pax · fast & cheap', capacity: 1, ac: false, is_active: true, sort_order: 1 },
  { id: 2, name: 'Auto', code: 'auto', icon: null, description: '3 pax · open air', capacity: 3, ac: false, is_active: true, sort_order: 2 },
  { id: 3, name: 'Cab', code: 'cab', icon: null, description: '4 pax · AC comfort', capacity: 4, ac: true, is_active: true, sort_order: 3 },
  { id: 4, name: 'Cab XL', code: 'cab_xl', icon: null, description: '6 pax · spacious SUV', capacity: 6, ac: true, is_active: true, sort_order: 4 },
];

export const mockMonthlySuggestions: MonthlySuggestion[] = [
  { id: 1, product: mockProducts[0], recommendedQuantity: 2, unitLabel: '5kg', lastPurchased: '2026-08-20', suggestedReorderDate: '2026-09-15', isEssential: true },
  { id: 2, product: mockProducts[1], recommendedQuantity: 8, unitLabel: '1L', lastPurchased: '2026-08-28', suggestedReorderDate: '2026-09-10', isEssential: true },
  { id: 3, product: mockProducts[3], recommendedQuantity: 4, unitLabel: '1kg', lastPurchased: '2026-08-22', suggestedReorderDate: '2026-09-18', isEssential: true },
  { id: 4, product: mockProducts[7], recommendedQuantity: 1, unitLabel: '1kg', lastPurchased: '2026-08-30', suggestedReorderDate: '2026-09-12', isEssential: true },
  { id: 5, product: mockProducts[4], recommendedQuantity: 1, unitLabel: '5kg', lastPurchased: '2026-08-05', suggestedReorderDate: '2026-09-20', isEssential: true },
  { id: 6, product: mockProducts[11], recommendedQuantity: 2, unitLabel: '1kg', lastPurchased: '2026-08-25', suggestedReorderDate: '2026-09-22', isEssential: false },
];

const slotWindows: { start: string; end: string; availability: number }[] = [
  { start: '08:00', end: '10:00', availability: 6 },
  { start: '10:00', end: '12:00', availability: 10 },
  { start: '12:00', end: '14:00', availability: 4 },
  { start: '16:00', end: '18:00', availability: 8 },
  { start: '18:00', end: '20:00', availability: 12 },
  { start: '20:00', end: '22:00', availability: 0 },
];

/** Mock slots are dated, exactly like the API, and always start in the future. */
export const mockDeliverySlots: DeliverySlot[] = (() => {
  const slots: DeliverySlot[] = [];
  let id = 1;

  for (let day = 1; day <= 3; day += 1) {
    const date = new Date();
    date.setDate(date.getDate() + day);

    for (const window of slotWindows) {
      const startsAt = new Date(`${date.toISOString().slice(0, 10)}T${window.start}:00`);

      slots.push({
        id: id++,
        vendor_id: 1,
        store_id: 1,
        slot_date: date.toISOString().slice(0, 10),
        start_time: `${window.start}:00`,
        end_time: `${window.end}:00`,
        slot_timezone: 'Asia/Kolkata',
        label: `${window.start} - ${window.end}`,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        lead_time_min: 60,
        max_orders: 10,
        availability: window.availability,
        is_active: window.availability > 0,
      });
    }
  }

  return slots;
})();

const banner = (
  id: number,
  title: string,
  subtitle: string,
  cta: string,
  service: Banner['service'],
  image: string,
  target: { type: Banner['target_type']; id: number | null; url: string } | null,
  placement: Banner['placement'] = null
): Banner => ({
  id,
  title,
  subtitle,
  cta_text: cta,
  service,
  image,
  placement,
  target_type: target?.type ?? null,
  target_id: target?.id ?? null,
  target_url: target?.url ?? null,
  sort_order: id,
  is_active: true,
});

export const mockBanners: Banner[] = [
  banner(1, 'Craving something delicious?', 'Fresh meals delivered to your door in minutes.', 'Order now', 'food', img('1563379926898-05f4575a45d8', 1200), { type: 'restaurant', id: 1, url: '/restaurant/1' }, 'food_home_hero'),
  banner(2, 'Weekend Food Festival', 'Save big on your favourite meals this weekend.', 'Explore offers', 'food', img('1513104890138-7c749659a591', 1200), { type: 'search', id: null, url: '/restaurants' }, 'food_home_hero'),
  banner(3, 'Discover local favourites', 'Curated kitchens near you, loved by your area.', 'Browse restaurants', 'food', img('1589301763274-2893aaf65eef', 1200), { type: 'restaurant', id: 4, url: '/restaurant/4' }, 'food_home_hero'),
  banner(4, 'Your Monthly Essentials', 'Reorder the things you buy every month, in one tap.', 'Add all', 'grocery', img('1586201375761-838650eee31a', 1200), { type: 'service', id: null, url: '/grocery' }, 'grocery_home_hero'),
  banner(5, 'Fresh produce, every morning', 'Hand-picked fruits & vegetables at your door.', 'Shop fresh', 'grocery', img('1610832958506-aa56368176cf', 1200), { type: 'service', id: null, url: '/stores' }, 'grocery_home_hero'),
  banner(6, 'Stock up and save', 'Upto 30% off on kitchen staples & essentials.', 'View deals', 'grocery', img('1586417547404-7532edf61b13', 1200), { type: 'service', id: null, url: '/stores' }, 'grocery_home_hero'),
  banner(9, 'FreshMart brand week', 'Top brands at their lowest prices this week.', 'Shop brands', 'grocery', img('1542838132-92c53300491e', 1200), { type: 'service', id: null, url: '/grocery' }, 'grocery_home_brand_promo'),
  banner(7, 'Where to next?', 'Bike, Auto or Cab — ride whenever you want.', 'Book a ride', 'rides', img('1544620347-c4fd4a3d5957', 1200), { type: 'service', id: null, url: '/rides' }, 'rides_home_hero'),
  banner(8, 'Airport runs, made easy', 'Fixed fares, honest pricing, zero surge surprises.', 'Plan a trip', 'rides', img('1569154841065-8900174351e2', 1200), { type: 'service', id: null, url: '/rides' }, 'rides_home_hero'),
  banner(10, 'Parcel', 'Send anything', 'Send', 'rides', img('1513104890138-7c749659a591', 800), { type: 'service', id: null, url: '/rides' }, 'rides_promotions'),
  banner(11, 'Everyday rides', 'Book now', 'Book', 'rides', img('1544620347-c4fd4a3d5957', 800), { type: 'service', id: null, url: '/rides' }, 'rides_promotions'),
  banner(12, 'Bike Taxi', 'Beat the traffic', 'Book', 'rides', img('1569154841065-8900174351e2', 800), { type: 'service', id: null, url: '/rides' }, 'rides_promotions'),
  banner(13, 'All Services', 'Food, Grocery & Rides', 'Explore', 'rides', img('1563379926898-05f4575a45d8', 800), { type: 'service', id: null, url: '/rides' }, 'rides_promotions'),
];

export const mockOffers: Offer[] = [
  { id: 1, title: 'Flat 20% off', subtitle: 'on your first food order above ₹249', tag: 'New here?', type: 'flat', value: 20, code: 'FOOD20', service: 'food', min_order: '249', ends_at: null },
  { id: 2, title: 'Pure veg picks', subtitle: 'wholesome & meat-free kitchens', tag: 'Veg', type: 'percentage', value: 15, code: 'VEG15', service: 'food', min_order: null, ends_at: null },
  { id: 3, title: 'Fast delivery', subtitle: 'hot food in under 25 minutes', tag: 'Quick', type: 'percentage', value: 10, code: 'FAST10', service: 'food', min_order: null, ends_at: null },
  { id: 4, title: 'New on the block', subtitle: 'restaurants worth trying today', tag: 'New', type: 'percentage', value: null, code: null, service: 'food', min_order: null, ends_at: null },
  { id: 5, title: 'Stock up & save', subtitle: 'upto 30% off on staples', tag: 'Save', type: 'percentage', value: 30, code: 'STAPLES30', service: 'grocery', min_order: '499', ends_at: null },
  { id: 6, title: 'Wallet boost', subtitle: 'top up ₹1000, get ₹100 free', tag: 'Wallet', type: 'flat', value: 100, code: 'WALLET100', service: 'grocery', min_order: null, ends_at: null },
  { id: 7, title: 'Fresh fruits & veg', subtitle: 'picked daily, delivered fast', tag: 'Fresh', type: 'percentage', value: null, code: null, service: 'grocery', min_order: null, ends_at: null },
  { id: 8, title: 'First ride deal', subtitle: '₹30 off your first bike ride', tag: 'Ride', type: 'flat', value: 30, code: 'RIDE30', service: 'rides', min_order: null, ends_at: null },
  { id: 9, title: 'Airport specials', subtitle: 'flat ₹549 airport drop any day', tag: 'Airport', type: 'flat', value: 549, code: 'AIRPORT', service: 'rides', min_order: null, ends_at: null },
];

export const mockFoodHome = {
  recommended: [mockRestaurants[0], mockRestaurants[1], mockRestaurants[3]],
  popular: [mockRestaurants[1], mockRestaurants[3], mockRestaurants[0], mockRestaurants[4]],
  top: [mockRestaurants[0], mockRestaurants[3], mockRestaurants[2]],
  fast: [mockRestaurants[1], mockRestaurants[4], mockRestaurants[3]],
  offers: [mockRestaurants[3], mockRestaurants[1]],
  recentlyOrdered: [mockRestaurants[4], mockRestaurants[2]],
  products: [mockProducts[2], mockProducts[3], mockProducts[5], mockProducts[7]],
  deals: [mockProducts[1], mockProducts[4], mockProducts[6], mockProducts[9]],
  banners: mockBanners.filter((b) => b.service === 'food'),
  categories: mockCategories,
  promos: mockOffers.filter((o) => o.service === 'food'),
};

export const mockGroceryHome = {
  buyAgain: [mockProducts[0], mockProducts[1], mockProducts[7], mockProducts[9]],
  monthlyEssentials: mockMonthlySuggestions,
  recommended: [mockProducts[3], mockProducts[4], mockProducts[6], mockProducts[8]],
  deals: [mockProducts[0], mockProducts[1], mockProducts[4], mockProducts[7]],
  stores: mockStores,
  categories: mockCategories.slice(5),
  recentlyViewed: [mockProducts[1], mockProducts[4], mockProducts[8], mockProducts[10]],
  banners: mockBanners.filter((b) => b.service === 'grocery'),
  promos: mockOffers.filter((o) => o.service === 'grocery'),
};

export const mockRidePromos = mockOffers.filter((o) => o.service === 'rides');

export const mockSavedPlaces = [
  { id: 1, label: 'Home', address: '12 MG Road, New Delhi', latitude: '28.6139', longitude: '77.2090' },
  { id: 2, label: 'Work', address: 'Cyber City, Gurugram', latitude: '28.4595', longitude: '77.0266' },
  { id: 3, label: 'Gym', address: 'Connaught Place, New Delhi', latitude: '28.6315', longitude: '77.2167' },
];
