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
    ["all", ...(products.map(product => product.category).filter((v, i, a) => a.indexOf(v) === i))] : 
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
            <Card key={product.id} className="glow-card overflow-hidden bg-primary-dark/40 border-accent/20 cursor-pointer">
              <div 
                className="product-card-content" 
                onClick={() => {
                  // Create a modal or dialog to show product details
                  const modal = document.createElement('div');
                  modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
                  modal.innerHTML = `
                    <div class="bg-primary-dark/90 max-w-2xl w-full rounded-lg overflow-hidden shadow-xl relative max-h-[90vh] flex flex-col">
                      <button class="absolute top-4 right-4 text-light/70 hover:text-accent">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                      <div class="md:flex">
                        <div class="md:w-1/2 h-64 md:h-auto">
                          <img 
                            src="${product.imageUrl}" 
                            alt="${product.name}" 
                            class="w-full h-full object-cover" 
                            onerror="this.onerror=null; this.src='/assets/placeholder-product.svg';" 
                          />
                        </div>
                        <div class="p-6 md:w-1/2 overflow-y-auto max-h-[70vh]">
                          <h2 class="font-cinzel text-accent text-2xl mb-2">${product.name}</h2>
                          <div class="flex items-center justify-between mb-6">
                            <span class="text-accent font-cinzel text-xl">$${(product.price / 100).toFixed(2)}</span>
                            <span class="text-sm text-light/60 italic">${product.category}</span>
                          </div>
                          <div class="mb-6">
                            <p class="text-light/80 font-playfair">${product.description}</p>
                          </div>
                          <div class="pt-4 border-t border-accent/20">
                            <button class="w-full py-3 px-4 bg-accent text-light rounded-md hover:bg-accent/80 transition flex items-center justify-center font-cinzel">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart mr-2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                              Add to Cart
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                  document.body.appendChild(modal);
                  
                  // Add event listeners for close button and background
                  const closeBtn = modal.querySelector('button');
                  if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                      document.body.removeChild(modal);
                    });
                  }
                  
                  modal.addEventListener('click', (e: MouseEvent) => {
                    if (e.target === modal) {
                      document.body.removeChild(modal);
                    }
                  });
                  
                  // Add to cart button in modal
                  const addToCartBtn = modal.querySelector('.bg-accent');
                  if (addToCartBtn) {
                    addToCartBtn.addEventListener('click', (e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                      document.body.removeChild(modal);
                    });
                  }
                }}
              >
                <div className="h-48 overflow-hidden">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = "/assets/placeholder-product.svg";
                      console.error(`Failed to load image for product: ${product.name}`);
                    }}
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
              </div>
              <CardFooter>
                <button 
                  className="w-full py-2 px-4 bg-accent text-light rounded-md hover:bg-accent/80 transition flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(product);
                  }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </button>
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