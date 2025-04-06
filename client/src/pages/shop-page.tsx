import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CelestialButton } from "@/components/ui/celestial-button";
import { ShoppingCart, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CartDrawer } from "@/components/shop/cart-drawer";

export default function ShopPage() {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortOption, setSortOption] = useState("price-asc");

  // Fetch products
  const { data: products, isLoading, error } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  if (error) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Failed to load products</h2>
          <p className="text-light/70">Please try again later or contact support</p>
        </div>
      </div>
    );
  }

  // Filter and sort products
  const filteredProducts = products ? products
    .filter(product => 
      // Search filter
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      product.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(product => 
      // Category filter
      categoryFilter === "all" || product.category === categoryFilter
    )
    .sort((a, b) => {
      // Sort options
      switch (sortOption) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    }) : [];

  // Get unique categories for filter dropdown
  const categories = products ? 
    ["all", ...new Set(products.map(product => product.category))] : 
    ["all"];

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };

  return (
    <div className="container mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12 cosmic-bg p-8 rounded-lg">
        <h1 className="text-4xl md:text-5xl font-alex-brush text-accent mb-4">Spiritual Shop</h1>
        <p className="text-light/80 font-playfair max-w-2xl mx-auto">
          Discover our curated collection of spiritual tools and products to enhance your journey into the mystical realms.
        </p>
      </div>

      {/* Filters and Search */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent/60 h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-primary-dark/50 border-accent/30 text-light"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent/60 h-4 w-4" />
          <Select 
            value={categoryFilter} 
            onValueChange={setCategoryFilter}
          >
            <SelectTrigger className="pl-10 bg-primary-dark/50 border-accent/30 text-light">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Select 
          value={sortOption} 
          onValueChange={setSortOption}
        >
          <SelectTrigger className="bg-primary-dark/50 border-accent/30 text-light">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="name-asc">Name: A to Z</SelectItem>
            <SelectItem value="name-desc">Name: Z to A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 8 }).map((_, index) => (
            <Card key={index} className="glow-card overflow-hidden bg-primary-dark/40 border-accent/20">
              <Skeleton className="h-48 rounded-t-lg" />
              <CardHeader>
                <Skeleton className="h-6 w-2/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))
        ) : (
          // Actual products
          filteredProducts.map(product => (
            <Card key={product.id} className="glow-card overflow-hidden bg-primary-dark/40 border-accent/20">
              <div className="h-48 overflow-hidden">
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-full object-cover transition-transform hover:scale-105"
                />
              </div>
              <CardHeader>
                <CardTitle className="font-cinzel text-accent text-xl">{product.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-light/80 font-playfair text-sm mb-4 line-clamp-3">{product.description}</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-accent font-cinzel text-lg">${(product.price / 100).toFixed(2)}</span>
                  <span className="text-xs text-light/60 italic">{product.category}</span>
                </div>
              </CardContent>
              <CardFooter>
                <CelestialButton 
                  variant="primary" 
                  onClick={() => handleAddToCart(product)}
                  className="w-full"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </CelestialButton>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Empty state */}
      {!isLoading && filteredProducts.length === 0 && (
        <div className="text-center py-16">
          <ShoppingCart className="mx-auto h-12 w-12 text-accent/30 mb-4" />
          <h3 className="text-xl font-cinzel text-light/70 mb-2">No products found</h3>
          <p className="text-light/50 max-w-md mx-auto mb-6">
            Try adjusting your search or filter criteria
          </p>
          <CelestialButton 
            variant="secondary" 
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
            }}
          >
            Reset Filters
          </CelestialButton>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={isCartOpen} onOpenChange={setIsCartOpen} />
    </div>
  );
}