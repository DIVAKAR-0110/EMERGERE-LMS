import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Check, ChevronUp, ChevronDown, Search } from "lucide-react";
import {
    applySingleSpaceTextChange,
    handleSingleSpaceKeyDown,
    handleSingleSpacePaste,
    normalizeSingleSpacing,
} from "../../utils/validationUtils";
import "../../styles/Profile.css";

/* ── Predefined options for Area of Expertise ──────────────────────── */
const PREDEFINED_AREAS = [
    "Web Development",
    "Data Analytics",
    "Cloud Computing",
    "Mobile Development",
    "DevOps & CI/CD",
    "Artificial Intelligence",
    "Machine Learning",
    "UI/UX Design",
    "Cybersecurity",
    "Project Management",
    "Other",
];

/* ── Capitalization & Single-Space Helpers ───────────────────────────── */
const normalizeWhitespace = (text) => {
    if (!text) return "";
    return text.replace(/[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, " ");
};

const formatSkillInputTyping = (str) => {
    if (!str) return "";
    const normalized = normalizeWhitespace(str)
        .replace(/^\s+/, "")
        .replace(/\s{2,}/g, " ");
    if (!normalized) return "";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatSkillFinal = (str) => {
    if (!str) return "";
    const collapsed = normalizeWhitespace(str).replace(/\s+/g, " ").trim();
    if (!collapsed) return "";
    return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
};

const capitalizeFirstLetter = formatSkillFinal;

export const MAX_SUMMARY_LENGTH = 250;


/* ── Editable Chip Component ────────────────────────────────────────── */
function EditableChip({ value, onUpdate, onRemove }) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef(null);

    const startEdit = (e) => {
        e.stopPropagation();
        setDraft(value);
        setIsEditing(true);
    };

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const commitEdit = () => {
        const formatted = capitalizeFirstLetter(draft);
        if (formatted && formatted !== value) {
            onUpdate(formatted);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            commitEdit();
        } else if (e.key === "Escape") {
            setIsEditing(false);
            setDraft(value);
        }
    };

    if (isEditing) {
        return (
            <span className="skill-chip-editing" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    className="skill-chip-edit-input"
                    value={draft}
                    onChange={(e) => setDraft(formatSkillInputTyping(e.target.value))}
                    onKeyDown={handleKeyDown}
                    onBlur={commitEdit}
                    maxLength={60}
                />
            </span>
        );
    }

    return (
        <span
            className="skill-tag-chip"
            title={`${value} (Double-click to edit)`}
            onDoubleClick={startEdit}
            onClick={(e) => e.stopPropagation()}
        >
            <span className="chip-text" title={value}>{value}</span>
            <button
                type="button"
                className="skill-tag-remove-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                title="Remove"
                aria-label={`Remove ${value}`}
            >
                <X size={12} color="#EF4444" strokeWidth={2.5} />
            </button>
        </span>
    );
}

/* ── Main EditSkillsExpertise Component ─────────────────────────────── */
export default function EditSkillsExpertise({
    skillsExpertise,
    onChange,
    errors = {},
}) {
    /* -- Tech skills state ------------------------------------------- */
    const [isAddingTech, setIsAddingTech] = useState(false);
    const [techInput, setTechInput] = useState("");
    const techInputRef = useRef(null);
    const techContainerRef = useRef(null);

    /* -- Workplace skills state --------------------------------------- */
    const [isAddingProf, setIsAddingProf] = useState(false);
    const [profInput, setProfInput] = useState("");
    const profInputRef = useRef(null);
    const profContainerRef = useRef(null);

    /* -- Area of expertise dropdown state ----------------------------- */
    const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
    const [isAddingCustomArea, setIsAddingCustomArea] = useState(false);
    const [customAreaInput, setCustomAreaInput] = useState("");
    const [areaSearchQuery, setAreaSearchQuery] = useState("");
    const areaDropdownRef = useRef(null);
    const customAreaInputRef = useRef(null);

    /* -- Click outside and Escape key listeners ----------------------- */
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isAddingTech && techContainerRef.current && !techContainerRef.current.contains(e.target)) {
                setIsAddingTech(false);
                setTechInput("");
            }
            if (isAddingProf && profContainerRef.current && !profContainerRef.current.contains(e.target)) {
                setIsAddingProf(false);
                setProfInput("");
            }
            if (
                areaDropdownRef.current &&
                !areaDropdownRef.current.contains(e.target)
            ) {
                setIsAreaDropdownOpen(false);
                setIsAddingCustomArea(false);
                setCustomAreaInput("");
                setAreaSearchQuery("");
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isAreaDropdownOpen) {
                setIsAreaDropdownOpen(false);
                setIsAddingCustomArea(false);
                setCustomAreaInput("");
                setAreaSearchQuery("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isAreaDropdownOpen, isAddingTech, isAddingProf]);

    /* -- Auto-focus inputs -------------------------------------------- */
    useEffect(() => {
        if (isAddingTech && techInputRef.current) techInputRef.current.focus();
    }, [isAddingTech]);

    useEffect(() => {
        if (isAddingProf && profInputRef.current) profInputRef.current.focus();
    }, [isAddingProf]);

    useEffect(() => {
        if (isAddingCustomArea && customAreaInputRef.current) {
            customAreaInputRef.current.focus();
        }
    }, [isAddingCustomArea]);

    /* -- Character count & typing restriction for Professional summary ----- */
    const charCount = (skillsExpertise.aboutMe || "").length;

    const handleSummaryChange = (e) => {
        const val = applySingleSpaceTextChange(e, MAX_SUMMARY_LENGTH);
        onChange({ ...skillsExpertise, aboutMe: val });
    };

    const handleSummaryPaste = (e) => {
        handleSingleSpacePaste(e, MAX_SUMMARY_LENGTH, (combined) => {
            onChange({ ...skillsExpertise, aboutMe: combined });
        });
    };

    const handleSummaryBlur = () => {
        const raw = skillsExpertise.aboutMe || "";
        const cleaned = normalizeSingleSpacing(raw, { trimEdges: true }).slice(0, MAX_SUMMARY_LENGTH);
        if (cleaned !== raw) {
            onChange({ ...skillsExpertise, aboutMe: cleaned });
        }
    };

    /* -- Technical skills handlers ------------------------------------ */
    const handleUpdateTechSkill = (oldSkill, newSkill) => {
        const formatted = capitalizeFirstLetter(newSkill);
        const updated = (skillsExpertise.technicalSkills || []).map((s) =>
            s === oldSkill ? formatted : s
        );
        onChange({ ...skillsExpertise, technicalSkills: updated });
    };

    const handleRemoveTechSkill = (skill) => {
        onChange({
            ...skillsExpertise,
            technicalSkills: (skillsExpertise.technicalSkills || []).filter(
                (s) => s !== skill
            ),
        });
    };

    const handleAddTechSkill = () => {
        const formatted = capitalizeFirstLetter(techInput);
        if (
            formatted &&
            !(skillsExpertise.technicalSkills || []).includes(formatted)
        ) {
            onChange({
                ...skillsExpertise,
                technicalSkills: [
                    ...(skillsExpertise.technicalSkills || []),
                    formatted,
                ],
            });
        }
        setTechInput("");
        setIsAddingTech(false);
    };

    /* -- Workplace skills handlers ------------------------------------ */
    const handleUpdateProfSkill = (oldSkill, newSkill) => {
        const formatted = capitalizeFirstLetter(newSkill);
        const updated = (skillsExpertise.professionalSkills || []).map((s) =>
            s === oldSkill ? formatted : s
        );
        onChange({ ...skillsExpertise, professionalSkills: updated });
    };

    const handleRemoveProfSkill = (skill) => {
        onChange({
            ...skillsExpertise,
            professionalSkills: (skillsExpertise.professionalSkills || []).filter(
                (s) => s !== skill
            ),
        });
    };

    const handleAddProfSkill = () => {
        const formatted = capitalizeFirstLetter(profInput);
        if (
            formatted &&
            !(skillsExpertise.professionalSkills || []).includes(formatted)
        ) {
            onChange({
                ...skillsExpertise,
                professionalSkills: [
                    ...(skillsExpertise.professionalSkills || []),
                    formatted,
                ],
            });
        }
        setProfInput("");
        setIsAddingProf(false);
    };

    /* -- Area of expertise handlers ----------------------------------- */
    const selectedAreas = skillsExpertise.areaOfExpertise || [];

    const handleToggleArea = (area) => {
        if (selectedAreas.includes(area)) {
            onChange({
                ...skillsExpertise,
                areaOfExpertise: selectedAreas.filter((a) => a !== area),
            });
        } else {
            onChange({
                ...skillsExpertise,
                areaOfExpertise: [...selectedAreas, area],
            });
        }
    };

    const handleRemoveArea = (areaToRemove) => {
        onChange({
            ...skillsExpertise,
            areaOfExpertise: selectedAreas.filter((a) => a !== areaToRemove),
        });
    };

    const handleAddCustomArea = () => {
        const formatted = capitalizeFirstLetter(customAreaInput);
        if (formatted && !selectedAreas.includes(formatted)) {
            onChange({
                ...skillsExpertise,
                areaOfExpertise: [...selectedAreas, formatted],
            });
        }
        setCustomAreaInput("");
        setIsAddingCustomArea(false);
    };

    // Predefined areas filtered by search query
    const filteredPredefinedAreas = PREDEFINED_AREAS.filter((a) => a !== "Other").filter((a) =>
        a.toLowerCase().includes(areaSearchQuery.trim().toLowerCase())
    );

    return (
        <div className="edit-step-container">
            <h3 className="step-section-heading">Professional Profile</h3>

            {/* Professional summary */}
            <div className="edit-form-field">
                <label className="edit-form-label">
                    Professional summary<span className="req">*</span>
                </label>
                <div className="edit-textarea-wrapper">
                    <textarea
                        className={`edit-form-textarea ${errors.aboutMe ? "input-error" : ""}`}
                        placeholder="Tell me about yourself"
                        value={skillsExpertise.aboutMe || ""}
                        onChange={handleSummaryChange}
                        onKeyDown={handleSingleSpaceKeyDown}
                        onPaste={handleSummaryPaste}
                        onBlur={handleSummaryBlur}
                        maxLength={MAX_SUMMARY_LENGTH}
                    />

                    <span
                        className={`edit-textarea-char-count ${charCount >= MAX_SUMMARY_LENGTH ? "count-limit" : ""}`}
                    >
                        {charCount}/{MAX_SUMMARY_LENGTH}
                    </span>
                </div>
                {errors.aboutMe && (
                    <span className="edit-form-error">
                        {errors.aboutMe}
                    </span>
                )}
            </div>

            <div className="edit-step-divider" />

            {/* Technical Skills & Workplace Skills 2-Column Grid */}
            <div className="edit-skills-grid">
                {/* Technical Skills */}
                <div className="edit-form-field">
                    <label className="edit-form-label">
                        Technical Skills<span className="req">*</span>
                    </label>
                    <div className={`skills-interactive-box ${errors.technicalSkills ? "input-error" : ""}`}>
                        <div className="skills-tags-scrollable">
                            {(skillsExpertise.technicalSkills || []).map((skill) => (
                                <EditableChip
                                    key={skill}
                                    value={skill}
                                    onUpdate={(newVal) => handleUpdateTechSkill(skill, newVal)}
                                    onRemove={() => handleRemoveTechSkill(skill)}
                                />
                            ))}

                            {isAddingTech ? (
                                <div
                                    ref={techContainerRef}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                                    onBlur={(e) => {
                                        if (!techContainerRef.current?.contains(e.relatedTarget)) {
                                            setIsAddingTech(false);
                                            setTechInput("");
                                        }
                                    }}
                                >
                                    <input
                                        ref={techInputRef}
                                        type="text"
                                        className="skill-inline-input"
                                        placeholder="Skill name"
                                        value={techInput}
                                        maxLength={50}
                                        onChange={(e) => setTechInput(formatSkillInputTyping(e.target.value))}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddTechSkill();
                                            } else if (e.key === "Escape") {
                                                setIsAddingTech(false);
                                                setTechInput("");
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-add-skill-inline"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={handleAddTechSkill}
                                    >
                                        Add
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn-add-skill-inline"
                                    onClick={() => setIsAddingTech(true)}
                                >
                                    <span className="add-skill-text">+ Add Skill</span>
                                </button>
                            )}
                        </div>
                        <p className="skills-box-hint">
                            Type and press Enter to add skills (e.g., React, Python, AWS)
                        </p>
                    </div>
                    {errors.technicalSkills && (
                        <span className="edit-form-error">{errors.technicalSkills}</span>
                    )}
                </div>

                {/* Workplace Skills */}
                <div className="edit-form-field">
                    <label className="edit-form-label">
                        Professional Skills<span className="req">*</span>
                    </label>
                    <div className={`skills-interactive-box ${errors.professionalSkills ? "input-error" : ""}`}>
                        <div className="skills-tags-scrollable">
                            {(skillsExpertise.professionalSkills || []).map((skill) => (
                                <EditableChip
                                    key={skill}
                                    value={skill}
                                    onUpdate={(newVal) => handleUpdateProfSkill(skill, newVal)}
                                    onRemove={() => handleRemoveProfSkill(skill)}
                                />
                            ))}

                            {isAddingProf ? (
                                <div
                                    ref={profContainerRef}
                                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                                    onBlur={(e) => {
                                        if (!profContainerRef.current?.contains(e.relatedTarget)) {
                                            setIsAddingProf(false);
                                            setProfInput("");
                                        }
                                    }}
                                >
                                    <input
                                        ref={profInputRef}
                                        type="text"
                                        className="skill-inline-input"
                                        placeholder="Skill name"
                                        value={profInput}
                                        maxLength={50}
                                        onChange={(e) => setProfInput(formatSkillInputTyping(e.target.value))}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddProfSkill();
                                            } else if (e.key === "Escape") {
                                                setIsAddingProf(false);
                                                setProfInput("");
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-add-skill-inline"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={handleAddProfSkill}
                                    >
                                        Add
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn-add-skill-inline"
                                    onClick={() => setIsAddingProf(true)}
                                >
                                    <span className="add-skill-text">+ Add Skill</span>
                                </button>
                            )}
                        </div>
                        <p className="skills-box-hint">Type and press Enter to add skills</p>
                    </div>
                    {errors.professionalSkills && (
                        <span className="edit-form-error">{errors.professionalSkills}</span>
                    )}
                </div>
            </div>

            <div className="edit-step-divider" />

            {/* ── Area of Expertise ──────── */}
            <div className="edit-form-field area-field-container" ref={areaDropdownRef}>
                <div className="area-field-header">
                    <label className="edit-form-label">
                        Area of Expertise<span className="req">*</span>
                    </label>
                </div>

                {/* Select Box Trigger & Dropdown Menu */}
                <div className="learning-areas-select-wrapper">
                    <div
                        className={`learning-areas-select-box ${isAreaDropdownOpen ? "open" : ""} ${errors.areaOfExpertise ? "input-error" : ""}`}
                        onClick={() => {
                            setIsAddingTech(false);
                            setTechInput("");
                            setIsAddingProf(false);
                            setProfInput("");
                            setIsAreaDropdownOpen((prev) => !prev);
                            setIsAddingCustomArea(false);
                        }}
                    >
                        {selectedAreas.length === 0 ? (
                            <span className="placeholder-text">Select areas</span>
                        ) : (
                            <div className="learning-areas-select-content">
                                {selectedAreas.map((area) => (
                                    <span
                                        key={area}
                                        className="skill-tag-chip"
                                        title={area}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="chip-text" title={area}>{area}</span>
                                        <button
                                            type="button"
                                            className="skill-tag-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveArea(area);
                                            }}
                                            title={`Remove ${area}`}
                                            aria-label={`Remove ${area}`}
                                        >
                                            <X size={12} strokeWidth={2.5} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <ChevronDown
                            size={16}
                            className="learning-areas-select-chevron"
                            style={{
                                transform: isAreaDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                        />
                    </div>

                    {/* Dropdown popup menu with clean header, close button, search, and toggle items */}
                    {isAreaDropdownOpen && (
                        <div className="area-popup-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                            {/* Header with Title and Close (X) button */}
                            <div className="area-popup-header">
                                <div className="area-popup-header-title">
                                    <span>Select Areas of Expertise</span>
                                    {selectedAreas.length > 0 && (
                                        <span className="area-popup-count-badge">
                                            {selectedAreas.length} selected
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="area-popup-close-btn"
                                    onClick={() => {
                                        setIsAreaDropdownOpen(false);
                                        setIsAddingCustomArea(false);
                                        setAreaSearchQuery("");
                                    }}
                                    title="Close"
                                    aria-label="Close dropdown"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Options List */}
                            <div className="area-popup-options-list">
                                {filteredPredefinedAreas.length === 0 ? (
                                    <div className="area-popup-empty">
                                        No matching predefined areas. Add custom area below!
                                    </div>
                                ) : (
                                    filteredPredefinedAreas.map((opt) => {
                                        const isSelected = selectedAreas.includes(opt);
                                        return (
                                            <div
                                                key={opt}
                                                className={`area-popup-option-item ${isSelected ? "selected" : ""}`}
                                                onClick={() => handleToggleArea(opt)}
                                            >
                                                <div className="area-popup-option-left">
                                                    <div className={`area-popup-checkbox ${isSelected ? "checked" : ""}`}>
                                                        {isSelected && <Check size={11} strokeWidth={3} />}
                                                    </div>
                                                    <span className="area-popup-option-text">{opt}</span>
                                                </div>
                                                {isSelected && (
                                                    <span className="area-popup-selected-tag">Added ✓</span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}

                                {/* Other custom area toggle */}
                                {!isAddingCustomArea && (
                                    <div
                                        className="area-popup-option-item area-popup-other-item"
                                        onClick={() => setIsAddingCustomArea(true)}
                                    >
                                        <div className="area-popup-option-left">
                                            <Plus size={13} color="#215EF8" />
                                            <span>Other (Type custom area)</span>
                                        </div>
                                    </div>
                                )}

                                {/* Custom area input row */}
                                {isAddingCustomArea && (
                                    <div
                                        className="area-other-dropdown-input-row"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            ref={customAreaInputRef}
                                            type="text"
                                            className="area-other-dropdown-input"
                                            placeholder="Type custom area…"
                                            value={customAreaInput}
                                            maxLength={50}
                                            onChange={(e) =>
                                                setCustomAreaInput(formatSkillInputTyping(e.target.value))
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddCustomArea();
                                                } else if (e.key === "Escape") {
                                                    setIsAddingCustomArea(false);
                                                    setCustomAreaInput("");
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className="btn-add-skill-inline"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={handleAddCustomArea}
                                        >
                                            Add
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer with Search input and Done button */}
                            <div className="area-popup-footer">
                                <div className="area-footer-search-wrapper">
                                    <Search size={13} color="#94A3B8" />
                                    <input
                                        type="text"
                                        className="area-footer-search-input"
                                        placeholder="Search areas..."
                                        value={areaSearchQuery}
                                        onChange={(e) => setAreaSearchQuery(e.target.value)}
                                    />
                                    {areaSearchQuery && (
                                        <button
                                            type="button"
                                            className="area-popup-search-clear"
                                            onClick={() => setAreaSearchQuery("")}
                                            title="Clear search"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="area-popup-done-btn"
                                    onClick={() => {
                                        setIsAreaDropdownOpen(false);
                                        setIsAddingCustomArea(false);
                                        setAreaSearchQuery("");
                                    }}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {errors.areaOfExpertise && (
                    <span className="edit-form-error">{errors.areaOfExpertise}</span>
                )}
                <p className="skills-box-hint">Choose one or more areas</p>
            </div>
        </div>
    );
}
