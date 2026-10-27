import { Link } from 'react-router-dom';
import type { Category } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { Rail } from './section-header';
import { serviceTheme } from '@/components/service/service-theme';
import { cn } from '@/lib/utils';
import type { ServiceType } from '@/types/models';

interface CategoryRailProps {
  categories: Category[];
  service: ServiceType;
}

function categoryLink(c: Category, service: ServiceType): string {
  if (service === 'grocery') return `/search?type=grocery&q=${encodeURIComponent(c.name)}`;
  return `/restaurants?cuisine=${encodeURIComponent(c.name)}`;
}

export function CategoryRail({ categories, service }: CategoryRailProps) {
  const theme = serviceTheme(service);

  return (
    <Rail>
      {categories.map((c) => (
        <Link
          key={c.id}
          to={categoryLink(c, service)}
          className="group flex w-[72px] shrink-0 snap-start flex-col items-center gap-1.5 py-1"
        >
          <span
            className={cn(
              'relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-neutral-100 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-pill group-active:scale-95',
              theme.soft
            )}
          >
            <Image
              src={c.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </span>
          <span className="line-clamp-2 px-0.5 text-center text-[11px] font-semibold leading-tight text-neutral-700">
            {c.name}
          </span>
        </Link>
      ))}
    </Rail>
  );
}