"use client";

import React, { useEffect, useState } from "react";
import { 
  MdDelete, 
  MdVisibility, 
  MdVisibilityOff, 
  MdStar, 
  MdStarBorder, 
  MdSearch, 
  MdChevronLeft, 
  MdChevronRight 
} from "react-icons/md";
import styles from "./AdminReviewsPage.module.css";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";

type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";

type AdminReviewListItemDto = {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  status: ReviewStatus;
  createdAt: string;
  productName: string;
  userName: string | null;
};

type AdminReviewListResponseDto = {
  data: AdminReviewListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 20;

const AdminReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<AdminReviewListItemDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "HIDE" | "SHOW" | "DELETE";
    review: AdminReviewListItemDto;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      const start = performance.now();

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        if (ratingFilter !== "all") {
          params.set("rating", String(ratingFilter));
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const res = await fetch(`/api/admin/reviews?${params.toString()}`);
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? "Không thể tải danh sách đánh giá.");
        }

        const json = (await res.json()) as AdminReviewListResponseDto;
        if (!cancelled) {
          setReviews(json.data);
          setTotalPages(json.totalPages);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Không thể tải danh sách đánh giá.",
          );
        }
      } finally {
        const elapsed = performance.now() - start;
        const minDelay = 600;
        const remaining = Math.max(minDelay - elapsed, 0);
        setTimeout(() => {
          if (!cancelled) {
            setIsLoading(false);
            setShowLoadingOverlay(false);
          }
        }, remaining);
      }
    };

    setShowLoadingOverlay(true);
    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [page, ratingFilter, statusFilter, search]);

  const refresh = () => {
    setPage(1);
    setShowLoadingOverlay(true);
  };

  const handleStatusChange = async (
    review: AdminReviewListItemDto,
    nextStatus: ReviewStatus,
  ) => {
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Không thể cập nhật trạng thái đánh giá.");
      }
      refresh();
    } catch (e) {
      console.error("[AdminReviewsPage] update status failed:", e);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (review: AdminReviewListItemDto) => {
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Không thể xóa đánh giá.");
      }
      refresh();
    } catch (e) {
      console.error("[AdminReviewsPage] delete failed:", e);
    } finally {
      setPendingAction(null);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className={styles["admin-reviews-page__stars"]}>
        {[1, 2, 3, 4, 5].map((star) => (
          star <= rating ? (
            <MdStar key={star} className={styles["admin-reviews-page__star-icon"]} />
          ) : (
            <MdStarBorder key={star} className={styles["admin-reviews-page__star-icon-empty"]} />
          )
        ))}
      </div>
    );
  };

  const getStatusBadgeClass = (status: ReviewStatus) => {
    switch (status) {
      case "APPROVED":
        return styles["admin-reviews-page__status-badge--approved"];
      case "HIDDEN":
        return styles["admin-reviews-page__status-badge--hidden"];
      case "PENDING":
        return styles["admin-reviews-page__status-badge--pending"];
      default:
        return "";
    }
  };

  const getStatusLabel = (status: ReviewStatus) => {
    switch (status) {
      case "APPROVED":
        return "Hiển thị";
      case "HIDDEN":
        return "Đã ẩn";
      case "PENDING":
        return "Chờ duyệt";
      default:
        return status;
    }
  };

  return (
    <div className={styles["admin-reviews-page"]}>
      <div className={styles["admin-reviews-page__header"]}>
        <h1 className={styles["admin-reviews-page__title"]}>
          Quản lý đánh giá sản phẩm
        </h1>
      </div>

      <div className={styles["admin-reviews-page__filters"]}>
        <div className={styles["admin-reviews-page__search-wrapper"]}>
          <MdSearch className={styles["admin-reviews-page__search-icon"]} />
          <input
            type="text"
            className={styles["admin-reviews-page__search-input"]}
            placeholder="Tìm theo sản phẩm / người dùng / nội dung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles["admin-reviews-page__select"]}
          value={ratingFilter}
          onChange={(e) =>
            setRatingFilter(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
        >
          <option value="all">Tất cả số sao</option>
          <option value="5">5 sao</option>
          <option value="4">4 sao</option>
          <option value="3">3 sao</option>
          <option value="2">2 sao</option>
          <option value="1">1 sao</option>
        </select>
        <select
          className={styles["admin-reviews-page__select"]}
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ReviewStatus | "all")
          }
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Hiển thị</option>
          <option value="HIDDEN">Ẩn</option>
        </select>
      </div>

      <div className={styles["admin-reviews-page__table-card"]}>
        <div className={styles["admin-reviews-page__table-wrapper"]}>
          {showLoadingOverlay && (
            <DataLoadingOverlay
              isActive={showLoadingOverlay}
              title="Đang tải danh sách đánh giá"
              subtitle="Đức Uy Audio đang tổng hợp phản hồi của khách hàng..."
              bottomText="Vui lòng chờ trong giây lát."
            />
          )}

          {error && !isLoading && (
            <div className={styles["admin-reviews-page__error"]}>{error}</div>
          )}

          {!isLoading && !error && (
            <table className={styles["admin-reviews-page__table"]}>
              <thead>
                <tr className={styles["admin-reviews-page__table-head-row"]}>
                  <th className={styles["admin-reviews-page__table-head-cell"]}>Ngày</th>
                  <th className={styles["admin-reviews-page__table-head-cell"]}>Sản phẩm</th>
                  <th className={styles["admin-reviews-page__table-head-cell"]}>Người dùng</th>
                  <th className={styles["admin-reviews-page__table-head-cell"]}>Đánh giá</th>
                  <th className={styles["admin-reviews-page__table-head-cell"]}>Trạng thái</th>
                  <th className={`${styles["admin-reviews-page__table-head-cell"]} ${styles["admin-reviews-page__table-head-cell--right"]}`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className={styles["admin-reviews-page__table-body"]}>
                {reviews.map((review) => (
                  <tr key={review.id} className={styles["admin-reviews-page__table-row"]}>
                    <td className={styles["admin-reviews-page__table-cell"]}>
                      <span className={styles["admin-reviews-page__date"]}>
                        {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                      <span className={styles["admin-reviews-page__time"]}>
                        {new Date(review.createdAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className={`${styles["admin-reviews-page__table-cell"]} ${styles["admin-reviews-page__product-cell"]}`}>
                      {review.productName}
                    </td>
                    <td className={`${styles["admin-reviews-page__table-cell"]} ${styles["admin-reviews-page__user-cell"]}`}>
                      {review.userName ?? "Ẩn danh"}
                    </td>
                    <td className={styles["admin-reviews-page__table-cell"]}>
                      {renderStars(review.rating)}
                      {review.content && (
                        <div className={styles["admin-reviews-page__review-content"]}>
                          {review.title && <strong className={styles["admin-reviews-page__review-title"]}>{review.title} - </strong>}
                          {review.content}
                        </div>
                      )}
                    </td>
                    <td className={styles["admin-reviews-page__table-cell"]}>
                      <span className={`${styles["admin-reviews-page__status-badge"]} ${getStatusBadgeClass(review.status)}`}>
                        {getStatusLabel(review.status)}
                      </span>
                    </td>
                    <td className={`${styles["admin-reviews-page__table-cell"]} ${styles["admin-reviews-page__action-cell"]}`}>
                      <div className={styles["admin-reviews-page__action-group"]}>
                        <button
                          type="button"
                          className={`${styles["admin-reviews-page__icon-button"]} ${styles["admin-reviews-page__icon-button--primary"]}`}
                          title={review.status === "HIDDEN" ? "Hiển thị đánh giá" : "Ẩn đánh giá"}
                          onClick={() =>
                            setPendingAction({
                              type:
                                review.status === "HIDDEN" ? "SHOW" : "HIDE",
                              review,
                            })
                          }
                        >
                          {review.status === "HIDDEN" ? <MdVisibility /> : <MdVisibilityOff />}
                        </button>
                        <button
                          type="button"
                          className={`${styles["admin-reviews-page__icon-button"]} ${styles["admin-reviews-page__icon-button--danger"]}`}
                          title="Xóa đánh giá"
                          onClick={() =>
                            setPendingAction({ type: "DELETE", review })
                          }
                        >
                          <MdDelete />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles["admin-reviews-page__empty-cell"]}>
                      Chưa có đánh giá nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className={styles["admin-reviews-page__pagination"]}>
            <span className={styles["admin-reviews-page__pagination-text"]}>
              Trang <strong>{page}</strong> / <strong>{totalPages}</strong>
            </span>
            <div className={styles["admin-reviews-page__pagination-controls"]}>
              <button
                type="button"
                className={styles["admin-reviews-page__pagination-button"]}
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <MdChevronLeft /> Trước
              </button>
              <div className={styles["admin-reviews-page__pagination-pages"]}>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      className={`${styles["admin-reviews-page__page-pill"]} ${
                        page === pNum ? styles["admin-reviews-page__page-pill--active"] : ""
                      }`}
                      onClick={() => setPage(pNum)}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={styles["admin-reviews-page__pagination-button"]}
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Sau <MdChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingAction && (
        <ConfirmActionDialog
          isOpen={true}
          title={
            pendingAction.type === "DELETE"
              ? "Xóa đánh giá?"
              : pendingAction.type === "HIDE"
                ? "Ẩn đánh giá?"
                : "Hiển thị đánh giá?"
          }
          description={
            pendingAction.type === "DELETE"
              ? "Hành động này sẽ xóa vĩnh viễn đánh giá khỏi hệ thống."
              : "Bạn có chắc chắn muốn thay đổi trạng thái hiển thị của đánh giá này?"
          }
          confirmLabel={
            pendingAction.type === "DELETE"
              ? "Xóa"
              : pendingAction.type === "HIDE"
                ? "Ẩn"
                : "Hiển thị"
          }
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (!pendingAction) return;
            if (pendingAction.type === "DELETE") {
              void handleDelete(pendingAction.review);
            } else {
              const nextStatus: ReviewStatus =
                pendingAction.type === "HIDE" ? "HIDDEN" : "APPROVED";
              void handleStatusChange(pendingAction.review, nextStatus);
            }
          }}
        />
      )}
    </div>
  );
};

export default AdminReviewsPage;

