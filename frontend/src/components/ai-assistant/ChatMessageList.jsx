import React, { useEffect, useRef } from "react";
import ChatMessageItem from "./ChatMessageItem";

const ChatMessageList = ({ messages = [], isThinking = false, onActionClick }) => {
    const chatListRef = useRef(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (chatListRef.current) {
            const chatBody = chatListRef.current.closest(".ai-chat-body");
            if (chatBody) {
                if (isFirstRender.current) {
                    isFirstRender.current = false;
                    // On initial mount, start at the top of the chat
                    chatBody.scrollTop = 0;
                } else {
                    // On subsequent new messages, smoothly scroll only the inner chat body
                    chatBody.scrollTo({
                        top: chatBody.scrollHeight,
                        behavior: "smooth",
                    });
                }
            }
        }
    }, [messages, isThinking]);

    return (
        <div className="chat-message-list" ref={chatListRef}>
            {messages.map((msg) => (
                <ChatMessageItem key={msg.id} message={msg} onActionClick={onActionClick} />
            ))}

            {isThinking && (
                <div className="chat-row assistant-row">
                    <div className="chat-avatar assistant-avatar">
                        <span className="typing-dot" />
                    </div>
                    <div className="chat-bubble assistant-bubble thinking-bubble">
                        <span className="thinking-pulse">AI is thinking...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatMessageList;
