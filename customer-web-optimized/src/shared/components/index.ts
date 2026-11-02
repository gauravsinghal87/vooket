/**
 * Shared component surface.
 *
 * These primitives are module-agnostic. Modules may compose them but must not
 * fork them; a module-specific visual belongs in that module's components.
 */
export { Avatar } from './ui/avatar';
export { Badge } from './ui/badge';
export { BottomSheet } from './ui/bottom-sheet';
export { Button, buttonVariants } from './ui/button';
export { Card } from './ui/card';
export { Checkbox } from './ui/checkbox';
export { Image, Image as ProductImage } from './ui/image';
export { Input } from './ui/input';
export { Loader } from './ui/loader';
export { Modal } from './ui/modal';
export { Price, Price as PriceDisplay } from './ui/price';
export { QuantityStepper, QuantityStepper as QuantityControl } from './ui/quantity';
export { Radio } from './ui/radio';
export { Rating } from './ui/rating';
export { Select } from './ui/select';
export { Skeleton, CardSkeleton } from './ui/skeleton';
export { EmptyState, ErrorState, NoResultsState, GenericEmpty } from './ui/state';
export { Tabs } from './ui/tabs';
export { Toaster, toast } from './ui/toast';
export { LocationSelector } from './location-selector';
export { ServiceModuleSwitcher, ServiceModuleSwitcher as ModuleSwitcher } from './service/service-module-switcher';
export { SearchBar } from './service/search-bar';
export { MapPicker } from './map/MapPicker';
