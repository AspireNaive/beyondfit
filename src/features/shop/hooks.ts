import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { ProductCategory } from '@/domain/commerce/model'

export function useProducts(filter: { category?: ProductCategory; query?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.products(filter),
    queryFn: () => container.catalog.listProducts(filter),
    // The catalogue is the most-hit read in the app and changes rarely.
    staleTime: 5 * 60_000,
  })
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(slug ?? ''),
    queryFn: () => container.catalog.getProduct(slug!),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  })
}
