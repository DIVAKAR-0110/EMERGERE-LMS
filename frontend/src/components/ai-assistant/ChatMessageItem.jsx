import React from "react";
import aiIcon from "../../assets/ai-icon.svg";

const parseInlineMarkdown = (text) => {
    if (!text) return null;

    // Step 1: Extract links [title](url) safely
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
    const segments = [];
    let lastIdx = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIdx) {
            segments.push({ type: "text", content: text.slice(lastIdx, match.index) });
        }
        segments.push({ type: "link", label: match[1], url: match[2] });
        lastIdx = linkRegex.lastIndex;
    }
    if (lastIdx < text.length) {
        segments.push({ type: "text", content: text.slice(lastIdx) });
    }

    // Step 2: Format bold, code, and text inside non-link segments
    const renderTextSegment = (rawText, segIdx) => {
        // Match bold **text**, code `code`, or italics *italic*
        const styleRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
        const subParts = rawText.split(styleRegex);

        return subParts.map((sub, sIdx) => {
            if (!sub) return null;

            if (sub.startsWith("**") && sub.endsWith("**") && sub.length >= 4) {
                return (
                    <strong key={`${segIdx}-${sIdx}`} className="chat-highlight-bold">
                        {sub.slice(2, -2)}
                    </strong>
                );
            }
            if (sub.startsWith("`") && sub.endsWith("`") && sub.length >= 2) {
                return (
                    <span key={`${segIdx}-${sIdx}`} className="chat-code-badge">
                        {sub.slice(1, -1)}
                    </span>
                );
            }
            if (sub.startsWith("*") && sub.endsWith("*") && sub.length >= 2) {
                return (
                    <em key={`${segIdx}-${sIdx}`} className="chat-italic">
                        {sub.slice(1, -1)}
                    </em>
                );
            }

            return sub;
        });
    };

    return segments.map((seg, idx) => {
        if (seg.type === "link") {
            return (
                <a
                    key={`link-${idx}`}
                    href={seg.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="chat-link"
                    title={`Open ${seg.label}`}
                >
                    {seg.label}
                </a>
            );
        }
        return <React.Fragment key={`txt-${idx}`}>{renderTextSegment(seg.content, idx)}</React.Fragment>;
    });
};

const renderExternalCourseCard = (cardData, key) => {
    const { title, examCode, provider, rating, price, duration, url, badge } = cardData;

    return (
        <div
            key={key}
            className="external-course-card"
            onClick={() => {
                if (url) {
                    window.open(url, "_blank", "noopener,noreferrer");
                }
            }}
            title={`Open ${title} on ${provider || "official portal"}`}
            role="button"
            tabIndex={0}
        >
            <div className="external-card-header">
                <div className="external-card-badges">
                    <span className="external-card-provider-pill">
                        {provider || "Global Provider"}
                    </span>
                    {examCode && (
                        <span className="external-card-exam-pill">
                            {examCode}
                        </span>
                    )}
                </div>
                {rating && (
                    <span className="external-card-rating">
                        ★ {rating.replace(/[★*]/g, "").trim()}
                    </span>
                )}
            </div>

            <h4 className="external-card-title">{title}</h4>

            <div className="external-card-meta-row">
                {price && (
                    <div className="external-card-meta-item">
                        <span className="external-meta-label">Cost:</span>
                        <span className="external-meta-val">{price}</span>
                    </div>
                )}
                {duration && (
                    <div className="external-card-meta-item">
                        <span className="external-meta-label">Duration:</span>
                        <span className="external-meta-val">{duration}</span>
                    </div>
                )}
            </div>

            <div className="external-card-footer">
                <span className="external-reimburse-tag">
                    {badge || "100% Eligible for LMS Reimbursement"}
                </span>
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="external-card-redirect-btn"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span>Open Platform</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                </a>
            </div>
        </div>
    );
};

const formatMessageText = (text) => {
    if (!text) return null;
    const lines = text.split("\n");

    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if this line starts an external course or certification item (e.g. "### 1. 🌍 ..." or "### 1. [Title]")
        const isCourseHeader = (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) && (
            trimmed.includes("🌍") ||
            trimmed.includes("🏅") ||
            trimmed.includes("🚀") ||
            trimmed.includes("Exam Code:") ||
            trimmed.toLowerCase().includes("certified") ||
            trimmed.toLowerCase().includes("certification") ||
            trimmed.toLowerCase().includes("course")
        );

        if (isCourseHeader) {
            // Parse structured course card
            const headerPrefix = trimmed.startsWith("#### ") ? "#### " : "### ";
            let cleanTitle = trimmed.slice(headerPrefix.length).replace(/^\d+\.\s*/, "").replace(/[🌍🏅🚀]\s*/, "").trim();
            let examCode = "";

            const examMatch = cleanTitle.match(/`Exam Code:\s*([^`]+)`/i) || cleanTitle.match(/\(([A-Z0-9]+-[A-Z0-9]+)\)/);
            if (examMatch) {
                examCode = examMatch[1].trim();
                cleanTitle = cleanTitle.replace(/•?\s*`Exam Code:\s*[^`]+`/i, "").trim();
            }

            let provider = "";
            let rating = "";
            let price = "";
            let duration = "";
            let url = "";
            let badge = "";

            let j = i + 1;
            while (j < lines.length) {
                const subTrim = lines[j].trim();
                if (subTrim.startsWith("### ") || subTrim.startsWith("#### ") || subTrim === "---" || subTrim.startsWith("## ")) {
                    break;
                }

                if (subTrim.toLowerCase().includes("provider") || subTrim.toLowerCase().includes("issuing authority")) {
                    provider = subTrim.replace(/^[\*\-\•]\s*.*?:/i, "").trim();
                } else if (subTrim.toLowerCase().includes("rating")) {
                    rating = subTrim.replace(/^[\*\-\•]\s*.*?:/i, "").trim();
                } else if (subTrim.toLowerCase().includes("price") || subTrim.toLowerCase().includes("exam fee") || subTrim.toLowerCase().includes("cost")) {
                    price = subTrim.replace(/^[\*\-\•]\s*.*?:/i, "").trim();
                } else if (subTrim.toLowerCase().includes("duration") || subTrim.toLowerCase().includes("preparation")) {
                    duration = subTrim.replace(/^[\*\-\•]\s*.*?:/i, "").trim();
                } else if (subTrim.toLowerCase().includes("reimbursement")) {
                    badge = subTrim.replace(/^[\*\-\•]\s*.*?:/i, "").replace(/[🟢*]/g, "").trim();
                } else if (subTrim.toLowerCase().includes("link") || subTrim.toLowerCase().includes("url") || subTrim.toLowerCase().includes("access")) {
                    const urlMatch = subTrim.match(/\((https?:\/\/[^\)]+)\)/);
                    if (urlMatch) {
                        url = urlMatch[1];
                    } else {
                        const directUrlMatch = subTrim.match(/(https?:\/\/[^\s]+)/);
                        if (directUrlMatch) url = directUrlMatch[1];
                    }
                }
                j++;
            }

            // If we captured a valid course item with URL or provider, render individual card div
            if (url || provider) {
                elements.push(
                    renderExternalCourseCard(
                        {
                            title: cleanTitle,
                            examCode,
                            provider,
                            rating,
                            price,
                            duration,
                            url,
                            badge
                        },
                        `course-card-${i}`
                    )
                );
                i = j;
                continue;
            }
        }

        if (trimmed === "") {
            elements.push(<div key={`br-${i}`} className="chat-line-break" />);
            i++;
            continue;
        }

        // Horizontal rule
        if (trimmed === "---" || trimmed === "***") {
            elements.push(<hr key={`hr-${i}`} className="chat-divider" />);
            i++;
            continue;
        }

        // Header ## or ###
        if (trimmed.startsWith("## ")) {
            elements.push(
                <h3 key={`h3-${i}`} className="chat-header-h3">
                    {parseInlineMarkdown(trimmed.slice(3))}
                </h3>
            );
            i++;
            continue;
        }
        if (trimmed.startsWith("### ")) {
            elements.push(
                <h4 key={`h4-${i}`} className="chat-header-h4">
                    {parseInlineMarkdown(trimmed.slice(4))}
                </h4>
            );
            i++;
            continue;
        }

        // Bullet point * or -
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
            const content = trimmed.replace(/^[\*\-\•]\s+/, "");
            elements.push(
                <div key={`bp-${i}`} className="chat-bullet-line">
                    <span className="chat-bullet-dot">•</span>
                    <span className="chat-bullet-text">{parseInlineMarkdown(content)}</span>
                </div>
            );
            i++;
            continue;
        }

        // Sub-bullet (indented)
        if (line.startsWith("  - ") || line.startsWith("    - ")) {
            const content = line.trim().replace(/^[\*\-\•]\s+/, "");
            elements.push(
                <div key={`sub-${i}`} className="chat-sub-bullet-line">
                    <span className="chat-sub-bullet-dot">◦</span>
                    <span className="chat-bullet-text">{parseInlineMarkdown(content)}</span>
                </div>
            );
            i++;
            continue;
        }

        // Standard line
        elements.push(
            <p key={`p-${i}`} className="chat-message-line">
                {parseInlineMarkdown(line)}
            </p>
        );
        i++;
    }

    return elements;
};

const ChatMessageItem = ({ message, onActionClick }) => {
    const isUser = message.sender === "user";

    if (isUser) {
        return (
            <div className="chat-row user-row">
                <div className="chat-bubble user-bubble">
                    {formatMessageText(message.text)}
                </div>
                <div className="chat-avatar user-avatar" title="You">
                    <span>You</span>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-row assistant-row">
            <div className="chat-avatar assistant-avatar" title="AI Workplace Assistant">
                <img src={aiIcon} alt="AI" className="ai-icon-img" />
            </div>
            <div className="chat-bubble assistant-bubble">
                {formatMessageText(message.text)}
                {message.actions && message.actions.length > 0 && (
                    <div className="chat-action-buttons-group">
                        {message.actions.map((act) => (
                            <button
                                key={act.id}
                                className="chat-action-btn"
                                onClick={() => onActionClick && onActionClick(act)}
                                title={act.label}
                            >
                                <span>{act.label}</span>
                                <svg
                                    className="chat-action-arrow"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessageItem;
