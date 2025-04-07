import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Product } from "@shared/schema";
import { CelestialButton } from "@/components/ui/celestial-button";
import { ShoppingCart, ChevronLeft, Star } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { PATHS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { useState } from "react";
import { env } from "@/lib/env";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Fetch product details
  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['/api/products', parseInt(id)],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product details');
      }
      return response.json();
    },
  });
  
  const handleAddToCart = () => {
    if (product) {
      addToCart(product);
      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart.`
      });
      setIsCartOpen(true);
    }
  };
  
  if (error) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Failed to load product details</h2>
          <p className="text-light/70 mb-6">Please try again later or contact support</p>
          <Link href={PATHS.SHOP}>
            <CelestialButton variant="secondary">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Shop
            </CelestialButton>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-12 px-4">
      {/* Breadcrumb navigation */}
      <nav className="mb-8">
        <Link href={PATHS.SHOP} className="text-accent hover:text-accent-dark transition-colors flex items-center text-sm">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Shop
        </Link>
      </nav>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-primary-dark/30 rounded-lg overflow-hidden">
            <Skeleton className="w-full aspect-square" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-12 w-full max-w-md" />
          </div>
        </div>
      ) : product ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="bg-primary-dark/30 rounded-lg overflow-hidden shadow-glow">
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full aspect-square object-cover"
              onError={(e) => {
                // If image fails to load, replace with placeholder
                const target = e.target as HTMLImageElement;
                target.src = '/images/product-placeholder.png';
              }}
            />
          </div>
          
          {/* Product Details */}
          <div className="space-y-6">
            <h1 className="text-3xl font-cinzel text-accent">{product.name}</h1>
            
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 text-secondary" />
              ))}
              <span className="text-light/70 text-sm ml-2">5.0 (12 reviews)</span>
            </div>
            
            <p className="text-light/80 font-playfair">{product.description}</p>
            
            <div className="flex items-baseline">
              <span className="text-2xl font-cinzel text-accent">${(product.price / 100).toFixed(2)}</span>
              <span className="ml-2 text-light/60 text-sm">In stock: {product.stock}</span>
            </div>
            
            <div className="pt-4">
              <CelestialButton 
                onClick={handleAddToCart}
                variant="default"
                className="w-full max-w-md"
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart
              </CelestialButton>
            </div>
            
            {/* Additional product details if available */}
            <div className="border-t border-accent/20 pt-6 mt-6">
              <h3 className="text-xl font-cinzel text-accent mb-3">Product Details</h3>
              <div className="space-y-2 text-light/70">
                <p className="flex justify-between">
                  <span>Category:</span>
                  <span className="text-light/90">{product.category}</span>
                </p>
                <p className="flex justify-between">
                  <span>Item ID:</span>
                  <span className="text-light/90">#{product.id}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-red-500 mb-4">Product not found</h2>
          <p className="text-light/70 mb-6">The product you're looking for doesn't exist or has been removed</p>
          <Link href={PATHS.SHOP}>
            <CelestialButton variant="secondary">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Shop
            </CelestialButton>
          </Link>
        </div>
      )}
      
      <CartDrawer open={isCartOpen} onOpenChange={setIsCartOpen} />
    </div>
  );
}