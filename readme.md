# All-in-One Delivery & Ride Super App

A complete enterprise-grade multi-service super app combining **Food Delivery**, **Grocery Delivery**, **Ride Hailing**, **Wallets**, **Commissions**, **Settlements**, and much more.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Laravel 11+, PHP 8.3+, MySQL 8+ |
| **Admin Panel** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Vendor Panel** | React 18 + TypeScript + Vite |
| **Customer Web** | React 18 + TypeScript + Vite |
| **Customer Mobile** | React Native + Expo SDK 54 |
| **Delivery Partner Mobile** | React Native + Expo SDK 54 |
| **Driver Mobile** | React Native + Expo SDK 54 |
| **Caching/Queues** | Redis |
| **Real-time** | Laravel Broadcasting + WebSockets |
| **Payments** | Razorpay / Cashfree (abstraction) |
| **Maps** | Google Maps / Mapbox (abstraction) |

## Repository Structure

```
/
├── backend/          # Laravel API backend
├── admin-web/        # Admin panel (React)
├── vendor-web/       # Vendor dashboard (React)
├── customer-web/     # Customer web app (React)
├── customer-mobile/  # Customer mobile app (Expo)
├── delivery-mobile/  # Delivery partner app (Expo)
├── driver-mobile/    # Driver app (Expo)
├── shared/           # Shared design system & utilities
├── docs/             # Architecture documentation
└── infrastructure/   # Docker, nginx, deployment configs
```

## Services

- **Food Delivery** — Browse restaurants, order food, track delivery
- **Grocery Delivery** — Shop groceries, stock management, scheduled delivery
- **Ride Hailing** — Book bikes/autos/cabs, track drivers, fare estimation
- **Wallet System** — Double-entry ledger for customers, drivers, partners, vendors
- **Commission Engine** — Configurable commission rules per service/vendor/zone
- **Settlement Engine** — Automated settlement processing for all parties
- **Coupons & Promotions** — Enterprise coupon engine with abuse prevention
- **AI Platform** — Personalized recommendations, grocery prediction, search
- **Real-Time** — Live order/driver tracking via WebSockets

## Getting Started

### Prerequisites

- PHP 8.3+
- Composer 2+
- Node.js 18+
- MySQL 8+
- Redis

### Development Setup

```bash
# 1. Backend
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve

# 2. Customer Web App
cd customer-web
npm install
npm run dev

# 3. Admin Panel
cd admin-web
npm install
npm run dev
```

## Phase Status

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current implementation status.

## Documentation

See [docs/](docs/) for detailed architecture documentation.
