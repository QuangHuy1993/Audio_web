"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";

type CartContextValue = {
  cartItemCount: number;
  refreshCartCount: () => void;
  wishlistCount: number;
  refreshWishlistCount: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

type CartProviderProps = {
  children: React.ReactNode;
};

export function CartProvider({ children }: CartProviderProps) {
  const { data: session, status } = useSession();
  const [cartItemCount, setCartItemCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  // Dùng ref thay vì state để tránh trigger re-render → vòng lặp useEffect vô hạn
  const isFetchingCartRef = useRef(false);
  const isFetchingWishlistRef = useRef(false);

  const fetchCartCount = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.id) {
      if (status !== "authenticated") {
        setCartItemCount(0);
      }
      return;
    }

    if (isFetchingCartRef.current) return;
    isFetchingCartRef.current = true;

    try {
      const response = await fetch("/api/shop/cart/count");
      if (!response.ok) {
        if (response.status === 401) setCartItemCount(0);
        return;
      }
      const data = (await response.json()) as { count: number };
      setCartItemCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      // ignore
    } finally {
      isFetchingCartRef.current = false;
    }
  }, [session?.user?.id, status]);

  const fetchWishlistCount = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.id) {
      if (status !== "authenticated") {
        setWishlistCount(0);
      }
      return;
    }

    if (isFetchingWishlistRef.current) return;
    isFetchingWishlistRef.current = true;

    try {
      const response = await fetch("/api/shop/wishlist?limit=1");
      if (!response.ok) {
        if (response.status === 401) setWishlistCount(0);
        return;
      }
      const data = (await response.json()) as { itemCount: number };
      setWishlistCount(typeof data.itemCount === "number" ? data.itemCount : 0);
    } catch {
      // ignore
    } finally {
      isFetchingWishlistRef.current = false;
    }
  }, [session?.user?.id, status]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      void fetchCartCount();
      void fetchWishlistCount();
    } else if (status === "unauthenticated") {
      setCartItemCount(0);
      setWishlistCount(0);
    }
  }, [fetchCartCount, fetchWishlistCount, session?.user?.id, status]);

  const refreshCartCount = useCallback(() => {
    void fetchCartCount();
  }, [fetchCartCount]);

  const refreshWishlistCount = useCallback(() => {
    void fetchWishlistCount();
  }, [fetchWishlistCount]);

  const value: CartContextValue = {
    cartItemCount,
    refreshCartCount,
    wishlistCount,
    refreshWishlistCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    return {
      cartItemCount: 0,
      refreshCartCount: () => {},
      wishlistCount: 0,
      refreshWishlistCount: () => {},
    };
  }

  return context;
}

