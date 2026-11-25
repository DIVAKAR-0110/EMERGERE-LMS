import React, { useState } from "react";
import { X, ShoppingCart, DollarSign, CheckCircle2 } from "lucide-react";

export default function PurchaseCourseModal({ isOpen, onClose, onPurchase, initialCourse }) {
    const [selectedCourse, setSelectedCourse] = useState(
        initialCourse?.courseTitle || "Value Not Found Error"
    );
    const [seats, setSeats] = useState(4);
    const [pricePerSeat, setPricePerSeat] = useState(4500);
    const [isSuccess, setIsSuccess] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = (e) => {
        e.preventDefault();
        if (isSuccess) return;
        setIsSuccess(true);
        setTimeout(() => {
            if (onPurchase) {
                onPurchase({
                    courseTitle: selectedCourse,
                    seats,
                    totalPrice: seats * pricePerSeat,
                });
            }
            setIsSuccess(false);
            onClose();
        }, 1200);
    };

    return (
        <div className="ld-cm-modal-overlay">
            <div className="ld-cm-modal-card" style={{ maxWidth: 600, width: "100%", maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="ld-cm-modal-close-btn"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                {isSuccess ? (
                    <div style={{ textAlign: "center", padding: "30px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                        <CheckCircle2 size={48} color="#10B981" />
                        <h3 style={{ margin: 0, fontSize: 18, color: "#0F172A" }}>Course Purchase Approved!</h3>
                        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
                            Successfully procured {seats} seats for {selectedCourse}.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="ld-cm-modal-header">
                            <h2 className="ld-cm-modal-title">Purchase Course</h2>
                            <p className="ld-cm-modal-subtitle">
                                Confirm procurement for the CEO approved course.
                            </p>
                        </div>

                        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div className="ld-cm-modal-form-group">
                                <label className="ld-cm-modal-label">Course Title</label>
                                <input
                                    type="text"
                                    className="ld-cm-search-input"
                                    value={selectedCourse}
                                    readOnly
                                    style={{ background: "#F8FAFC" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div className="ld-cm-modal-form-group">
                                    <label className="ld-cm-modal-label">License Seats</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        className="ld-cm-search-input"
                                        value={seats}
                                        onChange={(e) => setSeats(Number(e.target.value))}
                                    />
                                </div>
                                <div className="ld-cm-modal-form-group">
                                    <label className="ld-cm-modal-label">Price per Seat</label>
                                    <input
                                        type="text"
                                        className="ld-cm-search-input"
                                        value={`₹${pricePerSeat.toLocaleString()}`}
                                        readOnly
                                        style={{ background: "#F8FAFC" }}
                                    />
                                </div>
                            </div>

                            <div style={{
                                background: "#EFF6FF",
                                border: "1px solid #BFDBFE",
                                borderRadius: 8,
                                padding: "12px 16px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}>
                                <span style={{ fontSize: 13, color: "#1E40AF", fontWeight: 600 }}>Total Purchase Amount:</span>
                                <span style={{ fontSize: 16, color: "#1E40AF", fontWeight: 700 }}>
                                    ₹{(seats * pricePerSeat).toLocaleString()}
                                </span>
                            </div>

                            <div className="ld-cm-modal-footer">
                                <button
                                    type="button"
                                    className="ld-cm-modal-cancel-btn"
                                    onClick={onClose}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="ld-cm-modal-submit-btn"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                                >
                                    <ShoppingCart size={15} /> Confirm Purchase
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
