import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, User, LogOut } from "lucide-react";
import { PATHS } from "@/lib/constants";
import { CelestialButton } from "@/components/ui/celestial-button";
import { useAuth } from "@/hooks/use-auth";
import { CartButton } from "@/components/shop/cart-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { href: PATHS.HOME, label: "Home" },
  { href: PATHS.ABOUT, label: "About" },
  { href: PATHS.READERS, label: "Readers" },
  { href: PATHS.LIVE, label: "Live" },
  { href: PATHS.SHOP, label: "Shop" },
  { href: PATHS.COMMUNITY, label: "Community" },
  { href: PATHS.MESSAGES, label: "Messages" },
  { href: PATHS.DASHBOARD, label: "Dashboard" },
  { href: PATHS.HELP, label: "Help Center" },
  { href: PATHS.POLICIES, label: "Policies" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  
  return (
    <header className="sticky top-0 z-50 bg-primary-dark/80 backdrop-blur-lg border-b border-accent-gold/30">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href={PATHS.HOME} className="flex items-center gap-3">
            <img 
              src="/assets/logos/soulseer_logo.png" 
              alt="SoulSeer Logo" 
              className="w-8 h-8 md:w-10 md:h-10 object-contain glow-effect"
            />
            <span className="text-3xl md:text-4xl font-alex-brush text-accent">SoulSeer</span>
          </Link>
          
          {/* Navigation - Desktop */}
          <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-light hover:text-accent transition duration-300 font-playfair text-sm xl:text-base ${
                  location === link.href ? "text-accent" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          
          {/* Action Buttons / User Menu */}
          <div className="flex items-center space-x-3">
            {/* Cart Button */}
            <CartButton />
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 focus:outline-none">
                    <Avatar className="h-8 w-8 border border-secondary/50">
                      <AvatarImage src={user.profileImage || ""} />
                      <AvatarFallback className="bg-accent text-white">
                        {user.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-light font-playfair">{user.fullName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-cinzel">My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={PATHS.DASHBOARD} className="cursor-pointer w-full font-playfair">
                      <User className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    className="text-destructive focus:text-destructive cursor-pointer font-playfair"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/auth" className="hidden lg:block">
                  <CelestialButton variant="secondary" size="sm" className="text-sm">
                    Login
                  </CelestialButton>
                </Link>
                <Link href="/auth" className="hidden lg:block">
                  <CelestialButton className="text-sm">
                    Get Started
                  </CelestialButton>
                </Link>
              </>
            )}
            
            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden text-light focus:outline-none"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div 
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen 
              ? 'max-h-[500px] opacity-100 border-t border-accent/20 mt-3' 
              : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="py-3 space-y-3 cosmic-bg backdrop-blur-md rounded-lg">
            {!user && (
              <>
                <Link
                  href="/auth"
                  className="block py-2.5 px-4 text-accent hover:text-accent-dark transition duration-300 font-playfair"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/auth"
                  className="block py-2.5 px-4 text-secondary hover:text-secondary-light transition duration-300 font-playfair"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
                <div className="border-b border-accent/20 my-3"></div>
              </>
            )}
            
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block py-2.5 px-4 text-light hover:text-accent transition duration-300 font-playfair ${
                  location === link.href 
                    ? "text-accent border-l-2 border-accent pl-3" 
                    : ""
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            
            {user && (
              <>
                <div className="border-t border-accent/20 mt-3"></div>
                <button
                  onClick={() => {
                    logoutMutation.mutate();
                    setMobileMenuOpen(false);
                  }}
                  disabled={logoutMutation.isPending}
                  className="w-full text-left py-2.5 px-4 text-red-400 hover:text-red-300 hover:bg-red-900/20 transition duration-300 font-playfair"
                >
                  <LogOut className="inline-block h-4 w-4 mr-2" />
                  <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
                </button>
              </>
            )}
            
            {user ? (
              <div className="border-t border-accent/20 mt-3 pt-3 px-4">
                <div className="flex items-center mb-3 space-x-3">
                  <Avatar className="h-10 w-10 border border-secondary/50">
                    <AvatarImage src={user.profileImage || ""} />
                    <AvatarFallback className="bg-accent text-white">
                      {user.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-light font-medium">{user.fullName}</div>
                    <div className="text-sm text-light/70">{user.email}</div>
                  </div>
                </div>
                
                <Link
                  href={PATHS.DASHBOARD}
                  className="w-full flex items-center space-x-2 py-2.5 px-4 text-light hover:text-accent hover:bg-accent/10 rounded-md transition duration-300"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                
                <button
                  onClick={() => {
                    logoutMutation.mutate();
                    setMobileMenuOpen(false);
                  }}
                  disabled={logoutMutation.isPending}
                  className="w-full flex items-center space-x-2 py-2.5 px-4 mt-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition duration-300"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
                </button>
              </div>
            ) : (
              <div className="border-t border-accent/20 mt-3 pt-3 px-4 space-y-2">
                <Link
                  href="/auth"
                  className="w-full flex justify-center py-2.5 px-4 bg-transparent border border-secondary text-secondary hover:bg-secondary/10 rounded-full transition duration-300 celestial-button"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/auth"
                  className="w-full flex justify-center py-2.5 px-4 bg-gradient-to-r from-accent to-accent-dark text-white rounded-full transition duration-300 celestial-button"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
