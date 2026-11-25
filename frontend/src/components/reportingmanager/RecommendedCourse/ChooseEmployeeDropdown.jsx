import React, { useMemo } from "react";
import openBookIcon from "../../../assets/course_library/open_book_icon.svg";

const ChooseEmployeeDropdown = ({
    teamMembers = [],
    searchQuery = "",
    selectedMemberIds = [],
    onToggleMember,
    onSelectAll,
    isLoading = false,
}) => {
    const currentSourceList = teamMembers;

    const filteredMembers = useMemo(() => {
        const query = (searchQuery || "").trim().toLowerCase();
        if (!query) return currentSourceList;
        return currentSourceList.filter((m) =>
            (m.name || "").toLowerCase().includes(query) ||
            (m.initials || "").toLowerCase().includes(query) ||
            (m.department || "").toLowerCase().includes(query) ||
            (m.email || "").toLowerCase().includes(query) ||
            (m.role || "").toLowerCase().includes(query)
        );
    }, [currentSourceList, searchQuery]);

    const isMemberChecked = (member) => {
        const id = member.id;
        const empId = member.employee_id;
        return (id && selectedMemberIds.includes(id)) || (empId && selectedMemberIds.includes(empId));
    };

    const isAllSelected =
        filteredMembers.length > 0 &&
        filteredMembers.every((m) => isMemberChecked(m));

    return (
        <div className="rm-choose-employee-dropdown" onClick={(e) => e.stopPropagation()}>

            {/* SELECT ALL ROW */}
            {filteredMembers.length > 0 && (
                <div className="rm-employee-select-all-row" onClick={() => onSelectAll?.(filteredMembers)}>
                    <div className={`rm-custom-checkbox ${isAllSelected ? "checked" : ""}`}>
                        {isAllSelected && <span className="rm-checkmark">✓</span>}
                    </div>
                    <span className="rm-select-all-text">
                        Select all ({filteredMembers.length})
                    </span>
                </div>
            )}

            {/* EMPLOYEE LIST WITH SCROLLBAR */}
            <div className="rm-employee-list-scroll">
                {isLoading ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                        Loading employees...
                    </div>
                ) : filteredMembers.length === 0 ? (
                    <div className="rm-employee-empty-state">
                        <img src={openBookIcon} alt="" className="rm-employee-empty-icon" />
                        <span className="rm-employee-empty-text">
                            {searchQuery ? "No matching team members found." : "No team members available."}
                        </span>
                    </div>
                ) : (
                    filteredMembers.map((member) => {
                        const isSelected = isMemberChecked(member);
                        const memberKey = member.id || member.employee_id;
                        return (
                            <div
                                key={memberKey}
                                className="rm-employee-item-row"
                                onClick={() => onToggleMember(memberKey)}
                            >
                                <div className={`rm-custom-checkbox ${isSelected ? "checked" : ""}`}>
                                    {isSelected && <span className="rm-checkmark">✓</span>}
                                </div>

                                <div
                                    className="rm-employee-avatar-circle"
                                    style={{ backgroundColor: member.avatarBg || "#0284C7" }}
                                >
                                    {member.initials}
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                    <span className="rm-employee-item-name">
                                        {member.name}
                                    </span>
                                    {member.department && (
                                        <span style={{ fontSize: "10px", color: "#7f7f7f", lineHeight: 1.2 }}>
                                            {member.department}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChooseEmployeeDropdown;
