import { useState } from "react";
import { useCart } from "@/hooks/use-cart";
import { Link } from "wouter";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Trash2, Plus, Minus, ShoppingCart, XCircle } from "lucide-react";
import { PATHS } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const { items, totalAmount, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      onOpenChange(false);
      return;
    }

    setIsProcessing(true);
    
    try {
      // Close the drawer and navigate to checkout page
      onOpenChange(false);
      window.location.href = '/checkout';
    } catch (error) {
      setIsProcessing(false);
      console.error('Error proceeding to checkout:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-primary-dark/95 backdrop-blur-md border-accent/20">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="text-3xl font-alex text-accent">Shopping Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[70vh]">
            <ShoppingCart className="h-16 w-16 text-accent/30 mb-4" />
            <p className="text-lg font-cinzel text-light/70 mb-2">Your cart is empty</p>
            <p className="text-sm text-light/50 mb-6 font-playfair text-center">
              Add spiritual items to your cart to enhance your journey
            </p>
            <SheetClose asChild>
              <Link href={PATHS.SHOP}>
                <CelestialButton variant="outline">
                  Explore Shop
                </CelestialButton>
              </Link>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <button 
                onClick={clearCart} 
                className="text-sm text-light/50 hover:text-accent flex items-center"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear Cart
              </button>
            </div>

            <div className="space-y-4 mb-4 max-h-[60vh] overflow-y-auto pr-2">
              {items.map((item) => (
                <div 
                  key={item.product.id} 
                  className="flex border-b border-accent/10 pb-4"
                >
                  <div className="h-16 w-16 rounded-md overflow-hidden mr-3 flex-shrink-0">
                    <img 
                      src={item.product.imageUrl} 
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h4 className="font-cinzel text-accent text-sm">{item.product.name}</h4>
                      <button 
                        onClick={() => removeFromCart(item.product.id)}
                        aria-label="Remove item"
                        className="text-light/50 hover:text-red-500"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <p className="text-light/80 text-xs font-playfair mb-2">
                      ${(item.product.price / 100).toFixed(2)}
                    </p>
                    
                    <div className="flex items-center">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="h-6 w-6 flex items-center justify-center rounded-full bg-primary-light/10 text-light/70 hover:bg-accent/20"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      
                      <span className="mx-2 min-w-[20px] text-center text-light/90">
                        {item.quantity}
                      </span>
                      
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="h-6 w-6 flex items-center justify-center rounded-full bg-primary-light/10 text-light/70 hover:bg-accent/20"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      
                      <span className="ml-auto text-light/90 font-playfair">
                        ${((item.product.price * item.quantity) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="border-t border-accent/20 pt-4 mt-auto">
              <div className="flex justify-between mb-2">
                <span className="text-light/70 font-playfair">Subtotal</span>
                <span className="text-light font-playfair">${(totalAmount / 100).toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between mb-4">
                <span className="text-light/70 font-playfair">Shipping</span>
                <span className="text-light font-playfair">Calculated at checkout</span>
              </div>
              
              <SheetFooter className="flex justify-between sm:justify-between">
                <SheetClose asChild>
                  <CelestialButton variant="outline" className="flex-1 mr-2">
                    Continue Shopping
                  </CelestialButton>
                </SheetClose>
                
                <CelestialButton 
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="flex-1"
                  variant="gold"
                >
                  {isProcessing ? 'Processing...' : 'Checkout'}
                </CelestialButton>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}