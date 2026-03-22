"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    MdFavorite,
    MdAddShoppingCart,
    MdDeleteOutline,
    MdSearch,
    MdChevronLeft,
    MdChevronRight,
    MdWarning
} from "react-icons/md";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import styles from "./Wishlist.module.css";
import { useCartContext } from "@/features/shop/context/CartContext";
import type { WishlistItemDto, WishlistResponseDto } from "@/types/shop";
import { useRouter } from "next/navigation";

export default function Wishlist() {
    const router = useRouter();
    const { refreshCartCount } = useCartContext();
    const [items, setItems] = useState<WishlistItemDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // State for removal confirmation
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchWishlist();
    }, [currentPage]);

    const fetchWishlist = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/shop/wishlist?page=${currentPage}&limit=6`); // User wants smaller cards, so maybe more per page?
            if (!res.ok) throw new Error("Failed to fetch wishlist");
            const data: WishlistResponseDto = await res.json();
            setItems(data.items || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalItems(data.pagination?.total || 0);
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi tải danh sách yêu thích.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveRequest = (e: React.MouseEvent, productId: string) => {
        e.stopPropagation();
        e.preventDefault();
        setConfirmDeleteId(productId);
    };

    const handleConfirmRemove = async () => {
        if (!confirmDeleteId) return;

        setIsDeleting(true);
        try {
            const res = await fetch("/api/shop/wishlist/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: confirmDeleteId }),
            });

            if (!res.ok) throw new Error("Failed to remove item");

            toast.success("Đã xóa sản phẩm khỏi danh sách yêu thích.");
            setConfirmDeleteId(null);

            // Nếu xóa phần tử cuối cùng của trang và không phải trang 1, quay về trang trước
            if (items.length === 1 && currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            } else {
                fetchWishlist();
            }
        } catch (error) {
            console.error(error);
            toast.error("Không thể xóa sản phẩm. Vui lòng thử lại.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAddToCart = async (e: React.MouseEvent, productId: string) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            const res = await fetch("/api/shop/cart/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, quantity: 1 }),
            });

            if (!res.ok) throw new Error("Failed to add to cart");

            toast.success("Đã thêm vào giỏ hàng!");
            refreshCartCount();
        } catch (error) {
            console.error(error);
            toast.error("Không thể thêm vào giỏ hàng.");
        }
    };

    const handleCardClick = (productId: string, productName: string) => {
        toast.info(`Đang chuyển đến chi tiết sản phẩm: ${productName}`);
        router.push(`/products/${productId}`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0
        }).format(amount);
    };

    if (isLoading && currentPage === 1) {
        return (
            <div className={styles.wishlist}>
                <div style={{ textAlign: "center", padding: "100px 0" }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: "16px", color: "var(--color-text-secondary)" }}>Đang tải danh sách yêu thích...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.wishlist}>
            <header className={styles.wishlist__header}>
                <h2 className={styles.wishlist__title}>Sản phẩm yêu thích</h2>
                <p className={styles.wishlist__subtitle}>
                    {totalItems > 0
                        ? `Bạn đang có ${totalItems} sản phẩm trong danh sách yêu thích.`
                        : "Lưu lại những sản phẩm bạn quan tâm để dễ dàng tìm lại."}
                </p>
            </header>

            {!isLoading && items.length === 0 ? (
                <div className={styles.wishlist__empty}>
                    <div className={styles.wishlist__empty_icon}>
                        <MdFavorite size={64} />
                    </div>
                    <h3 className={styles.wishlist__empty_title}>Danh sách trống</h3>
                    <p className={styles.wishlist__empty_text}>Bạn chưa thêm sản phẩm nào vào danh sách yêu thích.</p>
                    <Link href="/products" className={styles.wishlist__explore_btn}>
                        Khám phá sản phẩm
                    </Link>
                </div>
            ) : (
                <>
                    <div className={styles.wishlist__grid}>
                        <AnimatePresence>
                            {items.map((item) => {
                                const hasSale = item.salePrice !== null && item.salePrice < item.price;
                                const discountPercent = hasSale ? Math.round((1 - item.salePrice! / item.price) * 100) : 0;

                                return (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        key={item.id}
                                        className={styles.wishlist__card}
                                        onClick={() => handleCardClick(item.productId, item.productName)}
                                    >
                                        <div className={styles.wishlist_image_wrapper}>
                                            {hasSale && (
                                                <span className={clsx(styles.wishlist__badge, styles["wishlist__badge--sale"])}>
                                                    -{discountPercent}%
                                                </span>
                                            )}
                                            <button
                                                className={styles.wishlist_remove_btn}
                                                onClick={(e) => handleRemoveRequest(e, item.productId)}
                                                title="Xóa khỏi yêu thích"
                                            >
                                                <MdDeleteOutline size={18} />
                                            </button>

                                            {item.productImageUrl ? (
                                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                    <Image
                                                        src={item.productImageUrl}
                                                        alt={item.productName}
                                                        className={styles.wishlist__image}
                                                        fill
                                                        sizes="(max-width: 768px) 100vw, 33vw"
                                                    />
                                                </div>
                                            ) : (
                                                <div className={styles["wishlist__image-placeholder"]} />
                                            )}
                                        </div>

                                        <div className={styles.wishlist__content}>
                                            <p className={styles.wishlist__category}>
                                                {item.categoryName || "Sản phẩm"}
                                            </p>
                                            <h3 className={styles.wishlist__name}>{item.productName}</h3>

                                            <div className={styles.wishlist__footer}>
                                                <div className={styles.wishlist__price_group}>
                                                    {hasSale && (
                                                        <span className={styles.wishlist__price_old}>
                                                            {formatCurrency(item.price)}
                                                        </span>
                                                    )}
                                                    <span className={clsx(
                                                        styles.wishlist__price_main,
                                                        hasSale && styles["wishlist__price_main--sale"]
                                                    )}>
                                                        {formatCurrency(hasSale ? item.salePrice! : item.price)}
                                                    </span>
                                                </div>

                                                <button
                                                    className={styles.wishlist_add_btn}
                                                    onClick={(e) => handleAddToCart(e, item.productId)}
                                                    title="Thêm vào giỏ hàng"
                                                >
                                                    <MdAddShoppingCart size={24} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className={styles.wishlist__pagination}>
                            <button
                                className={styles.wishlist__page_btn}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <MdChevronLeft size={24} />
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    className={clsx(
                                        styles.wishlist__page_btn,
                                        currentPage === page && styles["wishlist__page_btn--active"]
                                    )}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                className={styles.wishlist__page_btn}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <MdChevronRight size={24} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmDeleteId && (
                    <div className={styles.modal__overlay}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={styles.modal__content}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={styles.modal__icon}>
                                <MdWarning size={32} />
                            </div>
                            <h3 className={styles.modal__title}>Xác nhận xóa?</h3>
                            <p className={styles.modal__text}>
                                Bạn có chắc chắn muốn xóa sản phẩm này khỏi danh sách yêu thích không?
                            </p>
                            <div className={styles.modal__actions}>
                                <button
                                    className={clsx(styles.modal__btn, styles["modal__btn--cancel"])}
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={isDeleting}
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    className={clsx(styles.modal__btn, styles["modal__btn--confirm"])}
                                    onClick={handleConfirmRemove}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
