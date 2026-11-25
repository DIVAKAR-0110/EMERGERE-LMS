import React, { useState, useEffect, useRef } from "react";
import sendIcon from "../../assets/send.svg";
import { getTypingSuggestions } from "../../utils/pillSuggestions";
import "../../styles/ai-assistant/TypingSuggestions.css";

const ChatInputBar = ({ onSendMessage, disabled = false, role = "Employee" }) => {
    const [inputValue, setInputValue] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!inputValue || inputValue.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const matches = getTypingSuggestions(inputValue, role, 3);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
    }, [inputValue, role]);

    // Close suggestions if clicked outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSubmit = (e) => {
        e?.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed || disabled) return;
        setShowSuggestions(false);
        onSendMessage(trimmed);
        setInputValue("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (suggestion) => {
        setShowSuggestions(false);
        onSendMessage(suggestion.query);
        setInputValue("");
    };

    return (
        <form className="chat-input-form" onSubmit={handleSubmit} ref={containerRef}>
            <div className="typing-suggestions-wrapper">
                {showSuggestions && suggestions.length > 0 && (
                    <div className="typing-suggestions-popup" role="listbox" aria-label="Suggested prompts">
                        <div className="typing-suggestions-header">
                            <span>Suggested Prompts</span>
                            <span className="hint">Click to ask instantly</span>
                        </div>
                        {suggestions.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="typing-suggestion-btn"
                                onClick={() => handleSelectSuggestion(s)}
                            >
                                <span className="typing-suggestion-icon">💡</span>
                                <span className="typing-suggestion-text">{s.label}</span>
                                <span className="typing-suggestion-arrow">↵</span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="chat-input-wrapper">
                    <input
                        type="text"
                        className="chat-input-field"
                        placeholder={
                            role === "L&D Team" || role === "L&D" || role === "L_D"
                                ? "Ask about org enrollments, pending approvals, department stats..."
                                : "Ask about courses, progress, certifications, reimbursements..."
                        }
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                    />
                    <button
                        type="submit"
                        className="chat-send-btn"
                        aria-label="Send message"
                        disabled={disabled || !inputValue.trim()}
                    >
                        <img src={sendIcon} alt="Send" className="chat-send-icon" />
                    </button>
                </div>
            </div>
        </form>
    );
};

export default ChatInputBar;
