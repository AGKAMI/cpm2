import sys
with open('C:/Users/ojuni/Documents/GAMES/cpm2/src/components/StoreHomeClient.tsx', 'r') as f:
    content = f.read()

# Replace the import line
old_import = 'import { vantaApi, formatPrice, type VantaProduct, type VantaCategory, type VantaCustomer, type VantaPromotion, type TelegramUser } from "@/lib/store/client";'
new_import = 'import { formatPrice, type VantaProduct, type VantaCategory, type VantaCustomer, type VantaPromotion, type TelegramUser, useProducts, useCategories, usePromotions, useProfile, useMedia, vantaApi } from "@/lib/store/client";'

content = content.replace(old_import, new_import)

# Replace the entire component body from "export function StoreHomeClient()" through the closing of the initial useEffect
# Find the start
start_marker = 'export function StoreHomeClient() {'
end_marker = '  }, []);\n'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)
if end_idx >= 0:
    end_idx += len(end_marker)

if start_idx >= 0 and end_idx > start_idx:
    new_body = '''export function StoreHomeClient() {
  const { products: featured, isLoading: featuredLoading } = useProducts({ featured: true });
  const { products: allProducts, isLoading: allLoading } = useProducts({});
  const { categories: allCategories, isLoading: catsLoading } = useCategories();
  const { promotions, isLoading: promosLoading } = usePromotions();
  const { customer, telegramUser, isLoading: profileLoading } = useProfile();

  const [newArrivals, setNewArrivals] = useState<VantaProduct[]>([]);
  const [onSale, setOnSale] = useState<VantaProduct[]>([]);
  const [cardImages, setCardImages] = useState<Record<number, string>>({});
  const [categories, setCategories] = useState<VantaCategory[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLoading = featuredLoading || allLoading || catsLoading || promosLoading || profileLoading;

  // Compute derived data when products load
  useEffect(() => {
    if (allProducts.length === 0) return;

    // New arrivals = products with isNew flag, fallback to most recent
    const arrivals = [...allProducts]
      .filter((p) => p.isNew)
      .slice(0, 8);
    if (arrivals.length > 0) {
      setNewArrivals(arrivals);
    } else {
      const recent = [...allProducts]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);
      setNewArrivals(recent);
    }

    // On sale = products with isSale flag
    const saleItems = [...allProducts]
      .filter((p) => p.isSale)
      .slice(0, 8);
    setOnSale(saleItems);

    // Media for up to 20 products
    const displayIds = [...new Set(allProducts.map((p) => p.id))].slice(0, 20);
    Promise.all(
      displayIds.map((id) =>
        vantaApi.media(id)
          .then((m): [number, string | undefined] => [id, m.media[0]?.publicUrl])
          .catch(() => null),
      ),
    ).then((covers) => {
      const entries = covers.filter(
        (c): c is [number, string] => c !== null && c[1] !== undefined,
      );
      setCardImages(Object.fromEntries(entries));

      const productIdsWithImages = new Set(entries.map(([id]) => id));

      // Only show categories that actually have products WITH images assigned.
      const categoryIdsWithProducts = new Set(
        allProducts
          .filter((p) => productIdsWithImages.has(p.id))
          .map((p) => p.categoryId)
          .filter(Boolean),
      );
      setCategories(allCategories.filter((cat) => categoryIdsWithProducts.has(cat.id)));
    });
  }, [allProducts, allCategories]);'''

    content = content[:start_idx] + new_body + content[end_idx:]

with open('C:/Users/ojuni/Documents/GAMES/cpm2/src/components/StoreHomeClient.tsx', 'w') as f:
    f.write(content)

print('Done')
sys.exit(0)
