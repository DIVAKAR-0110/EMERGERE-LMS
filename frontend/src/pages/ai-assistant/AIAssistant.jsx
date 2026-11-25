import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AIAssistantHeader from "../../components/ai-assistant/AIAssistantHeader";
import ChatMessageList from "../../components/ai-assistant/ChatMessageList";
import SuggestedPromptPills from "../../components/ai-assistant/SuggestedPromptPills";
import ChatInputBar from "../../components/ai-assistant/ChatInputBar";
import {
    getRoleInitialMessages,
    generateAIResponse,
    fetchSuggestedPills,
} from "../../services/aiAssistantService";
import "../../styles/ai-assistant/AIAssistant.css";

const AIAssistant = () => {
    const { currentUser, role, token, activeRole, primaryRole } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const activePage = location?.pathname || "";

    // Determine effective role (supports "⇄ Employee View" toggle)
    const effectiveRole = activeRole || role || currentUser?.role || "Employee";

    const isLdOrManager =
        effectiveRole === "L&D Team" ||
        effectiveRole === "L&D" ||
        effectiveRole === "L_D" ||
        effectiveRole === "Reporting Manager" ||
        effectiveRole === "Reporting_Manager";

    const displayName =
        currentUser?.name && !currentUser.name.includes("User")
            ? currentUser.name
            : currentUser?.displayName || (currentUser?.email ? currentUser.email.split("@")[0] : "Learner");

    const firstName = displayName.split(" ")[0];

    // Initial messages state initialized based on active role
    const [messages, setMessages] = useState(() =>
        getRoleInitialMessages(effectiveRole, firstName)
    );
    const [isThinking, setIsThinking] = useState(false);
    const [dynamicPills, setDynamicPills] = useState(null);

    // Fetch dynamic suggested pills based on role & active route
    useEffect(() => {
        let isMounted = true;
        const loadPills = async () => {
            const pills = await fetchSuggestedPills(activePage, effectiveRole, token);
            if (isMounted && pills && pills.length > 0) {
                setDynamicPills(pills);
            }
        };
        loadPills();
        return () => {
            isMounted = false;
        };
    }, [activePage, effectiveRole, token]);

    // Update conversation flow when switching roles (e.g., clicking "⇄ Employee View")
    useEffect(() => {
        setMessages(getRoleInitialMessages(effectiveRole, firstName));
    }, [effectiveRole, firstName]);

    const handleSendMessage = async (text) => {
        if (!text.trim() || isThinking) return;

        const timeStr = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });

        const newUserMessage = {
            id: `msg-user-${Date.now()}`,
            sender: "user",
            text: text.trim(),
            timestamp: timeStr,
        };

        setMessages((prev) => [...prev, newUserMessage]);
        setIsThinking(true);

        try {
            const aiResponse = await generateAIResponse(
                text,
                firstName,
                token,
                messages,
                effectiveRole,
                activePage
            );
            const replyText =
                typeof aiResponse === "string" ? aiResponse : aiResponse?.reply || "";

            const newAiMessage = {
                id: `msg-ai-${Date.now()}`,
                sender: "assistant",
                text: replyText,
                actions: aiResponse?.actions || [],
                timestamp: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            };
            setMessages((prev) => [...prev, newAiMessage]);

            if (aiResponse && aiResponse.suggestedPills && aiResponse.suggestedPills.length > 0) {
                setDynamicPills(aiResponse.suggestedPills);
            }
        } catch (error) {
            console.error("Failed to generate AI reply:", error);
            const errorAiMessage = {
                id: `msg-ai-${Date.now()}`,
                sender: "assistant",
                text: "I apologize, but I encountered a momentary connection issue. Please try asking again!",
                timestamp: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            };
            setMessages((prev) => [...prev, errorAiMessage]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleActionClick = (action) => {
        if (!action) return;
        if (action.actionType === "NAVIGATE" && action.target) {
            navigate(action.target);
        } else if (action.actionType === "QUERY" && action.query) {
            handleSendMessage(action.query);
        } else if (action.actionType === "DOWNLOAD" && action.target) {
            const link = document.createElement("a");
            link.href = action.target;
            link.setAttribute("download", "");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="ai-assistant-page-container">
            {/* 1. Header (Title, Role Greeting, Switcher, Role Badge) */}
            <AIAssistantHeader userName={displayName} role={effectiveRole} />

            {/* 2. Main Chat Card (Figma Style) */}
            <div className="ai-assistant-chat-card">
                {/* Conversation Stream */}
                <div className="ai-chat-body">
                    <ChatMessageList messages={messages} isThinking={isThinking} onActionClick={handleActionClick} />
                </div>

                {/* Bottom Interactive Area */}
                <div className="ai-chat-footer">
                    <SuggestedPromptPills
                        onSelectPrompt={handleSendMessage}
                        disabled={isThinking}
                        role={effectiveRole}
                        customPills={dynamicPills}
                    />
                    <ChatInputBar
                        onSendMessage={handleSendMessage}
                        disabled={isThinking}
                        role={effectiveRole}
                    />
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
