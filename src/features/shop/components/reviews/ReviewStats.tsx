"use client";

import React from "react";
import { MdStar } from "react-icons/md";
import { motion } from "framer-motion";
import styles from "./ReviewStats.module.css";

interface ReviewStatsProps {
    avgRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
}

export default function ReviewStats({ avgRating, totalReviews, distribution }: ReviewStatsProps) {
    const stars = [5, 4, 3, 2, 1];

    function renderAvgStars(rating: number) {
        const result = [];
        for (let i = 1; i <= 5; i++) {
            result.push(
                <MdStar
                    key={i}
                    style={{
                        color: i <= Math.round(rating) ? "#ffb340" : "rgba(255,255,255,0.1)",
                        fontSize: "24px"
                    }}
                />
            );
        }
        return result;
    }

    return (
        <div className={styles.container}>
            <div className={styles.avgBox}>
                <span className={styles.avgScore}>{avgRating.toFixed(1)}</span>
                <div className={styles.avgStars}>
                    {renderAvgStars(avgRating)}
                </div>
                <span className={styles.totalText}>{totalReviews} đánh giá</span>
            </div>

            <div className={styles.bars}>
                {stars.map((star) => {
                    const count = distribution[star] || 0;
                    const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                    return (
                        <div key={star} className={styles.barRow}>
                            <span className={styles.barLabel}>{star}</span>
                            <MdStar className={styles.barStar} />
                            <div className={styles.track}>
                                <motion.div
                                    className={styles.fill}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                            </div>
                            <span className={styles.barCount}>{pct.toFixed(0)}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
