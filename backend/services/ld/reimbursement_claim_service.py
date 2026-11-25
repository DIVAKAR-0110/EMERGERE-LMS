"""
Reimbursement Claim Service.
Business logic and transaction management layer for claims:
Employee Claim -> RM / L&D Notified -> HR Approval -> Amount Reimbursed & Spent Logged.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status, UploadFile
from database.connection import connect_db
from repositories.ld import reimbursement_claim_repository
from repositories.ld import payment_record_repository
from repositories.common import notification_repository
from models.ld.reimbursement_claim import (
    ReimbursementClaimCreate,
    ReimbursementHRDecision,
    ReimbursementClaimStatusUpdate
)
from constants.course_metadata import resolve_provider_name
from repositories.common.course_metadata_repository import course_metadata_repository
from services.common.auth_service import employee_service

class ReimbursementClaimService:
    def _dispatch_notification(
        self,
        cursor,
        employee_id: Any,
        message: str,
        created_by: str = "SYSTEM"
    ):
        """Safely inserts a notification record into dbo.lms_notifications with varchar(7) protection."""
        if not employee_id:
            return
        emp_clean = str(employee_id).strip()[:7]
        creator_clean = str(created_by or "SYSTEM").strip()[:7]
        if not emp_clean:
            return
        try:
            notification_repository.insert_notification(
                cursor,
                employee_id=emp_clean,
                message=message,
                created_by=creator_clean
            )
        except Exception as e:
            print(f"[ReimbursementClaimService] Failed to insert notification for {emp_clean}: {e}")

    def _get_claim_stakeholders(self, employee_id: Any) -> Dict[str, Any]:
        """Dynamically resolves employee profile, reporting manager, L&D team, and HR team."""
        emp_str = str(employee_id or "").strip()
        requester = employee_service.get_employee_by_id(emp_str) if emp_str else None
        all_emps = employee_service.get_all_employees()

        emp_name = (requester.get("name") or requester.get("display_name") or emp_str) if requester else emp_str
        dept = (requester.get("department") if requester else None) or "Product Operations"
        reporting_manager_id = requester.get("reporting_manager_id") if requester else None

        # Fallback match by reporting_manager name
        if not reporting_manager_id and requester and requester.get("reporting_manager"):
            mgr_str = requester["reporting_manager"].strip().lower()
            for e in all_emps:
                e_name = e.get("name", "").strip().lower()
                if e_name and (e_name in mgr_str or mgr_str in e_name):
                    reporting_manager_id = e.get("employee_id")
                    break

        if not reporting_manager_id:
            reporting_manager_id = employee_service.get_reporting_manager_id(emp_str) if emp_str else None

        ld_ids = employee_service.get_employee_ids_by_role("L&D", "L&D Team")
        hr_ids = employee_service.get_employee_ids_by_role("HR", "HR Team")

        return {
            "requester_id": emp_str,
            "requester_name": emp_name,
            "department": dept,
            "reporting_manager_id": reporting_manager_id,
            "ld_team_ids": ld_ids,
            "hr_team_ids": hr_ids
        }

    def get_all(
        self,
        employee_id: Optional[Any] = None,
        status_filter: Optional[str] = None,
        processing_status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            claims = reimbursement_claim_repository.get_all_claims(
                cursor,
                employee_id=employee_id,
                status=status_filter,
                processing_status=processing_status
            )

            all_emps = employee_service.get_all_employees()
            emp_map = {e.get("employee_id", "").strip().upper(): e for e in all_emps}

            for c in claims:
                emp = emp_map.get(str(c.get("employee_id") or "").strip().upper())
                c["employee_name"] = emp.get("name") if emp else f"Employee {c.get('employee_id')}"
                c["employee_role"] = emp.get("role") if emp else "Employee"
                c["department"] = (emp.get("department") if emp else None) or "Product Operations"
                stages = reimbursement_claim_repository.get_claim_stages(
                    cursor,
                    c["id"],
                    employee_id=c.get("employee_id"),
                    certification_name=c.get("certification_name")
                )
                c["stages"] = stages

                # Check if upfront request was CEO bypassed
                cursor.execute("""
                    SELECT TOP 1 cr.id, cr.status, cr.is_ceo_bypassed
                    FROM dbo.lms_certification_requests cr
                    WHERE cr.employee_id = ?
                      AND LOWER(LTRIM(RTRIM(cr.certification_name))) = LOWER(LTRIM(RTRIM(?)))
                    ORDER BY CASE WHEN cr.status = 'Approved' THEN 0 ELSE 1 END, cr.id DESC
                """, (str(c.get("employee_id") or "").strip(), str(c.get("certification_name") or "").strip()))
                cr_row = cursor.fetchone()
                cr_id = cr_row[0] if cr_row else None
                cr_status = cr_row[1] if cr_row else None
                c["cr_id"] = cr_id
                c["cr_status"] = cr_status
                c["is_ceo_bypassed"] = bool(cr_row and cr_row[2])
                c["is_management_approved"] = True if (cr_status is None or cr_status == "Approved") else False

                hr_stage = next((s for s in stages if s.get("stage_name") in ("HR Approval", "HR Claim Approval")), None)
                if hr_stage and hr_stage.get("stage_date") and (c.get("status") == "Approved" or c.get("processing_status") == "Paid" or hr_stage.get("stage_status") == "Completed"):
                    c["approved_on"] = hr_stage.get("stage_date")
                else:
                    c["approved_on"] = None

            # Gating: Exclude claims where an upfront certification request exists but is not Approved (e.g. Pending CEO or Rejected)
            claims = [
                c for c in claims
                if c.get("is_management_approved") is not False and (c.get("cr_status") is None or c.get("cr_status") == "Approved")
            ]
            return claims
        finally:
            conn.close()

    def get_by_id(self, claim_id: int) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            claim = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
            if not claim:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reimbursement claim with ID {claim_id} not found"
                )
            emp = employee_service.get_employee_by_id(claim.get("employee_id"))
            claim["employee_name"] = emp.get("name") if emp else f"Employee {claim.get('employee_id')}"
            claim["employee_role"] = emp.get("role") if emp else "Employee"
            claim["department"] = (emp.get("department") if emp else None) or "Product Operations"
            stages = reimbursement_claim_repository.get_claim_stages(
                cursor,
                claim_id,
                employee_id=claim.get("employee_id"),
                certification_name=claim.get("certification_name")
            )
            claim["stages"] = stages

            cursor.execute("""
                SELECT TOP 1 cr.id, cr.status, cr.is_ceo_bypassed
                FROM dbo.lms_certification_requests cr
                WHERE cr.employee_id = ?
                  AND LOWER(LTRIM(RTRIM(cr.certification_name))) = LOWER(LTRIM(RTRIM(?)))
                ORDER BY CASE WHEN cr.status = 'Approved' THEN 0 ELSE 1 END, cr.id DESC
            """, (str(claim.get("employee_id") or "").strip(), str(claim.get("certification_name") or "").strip()))
            cr_row = cursor.fetchone()
            cr_id = cr_row[0] if cr_row else None
            cr_status = cr_row[1] if cr_row else None
            claim["cr_id"] = cr_id
            claim["cr_status"] = cr_status
            claim["is_ceo_bypassed"] = bool(cr_row and cr_row[2])
            claim["is_management_approved"] = True if (cr_status is None or cr_status == "Approved") else False

            hr_stage = next((s for s in stages if s.get("stage_name") in ("HR Approval", "HR Claim Approval")), None)
            if hr_stage and hr_stage.get("stage_date") and (claim.get("status") == "Approved" or claim.get("processing_status") == "Paid" or hr_stage.get("stage_status") == "Completed"):
                claim["approved_on"] = hr_stage.get("stage_date")
            else:
                claim["approved_on"] = None
            return claim
        finally:
            conn.close()

    def get_stages(self, claim_id: int) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            claim = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
            if not claim:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reimbursement claim with ID {claim_id} not found"
                )
            stages = reimbursement_claim_repository.get_claim_stages(
                cursor,
                claim_id,
                employee_id=claim.get("employee_id"),
                certification_name=claim.get("certification_name")
            )
            return stages
        finally:
            conn.close()

    def create(self, data: ReimbursementClaimCreate) -> Dict[str, Any]:
        if data.validity_from and data.validity_to:
            if data.validity_to < data.validity_from:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Validity expiration date cannot be before validity start date."
                )

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Resolve Amount and Dates
            if data.amount is None or int(data.amount) <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reimbursement amount must be greater than zero."
                )
            amount_val = int(data.amount)

            comp_date = data.completion_exam_date or data.purchase_date
            doc_path = data.supporting_document_path

            provider_val = course_metadata_repository.normalize_metadata_name(data.provider_name, "Udemy")

            clean_emp_id = str(data.employee_id).strip()
            if clean_emp_id.isdigit():
                clean_emp_id = f"EMP{int(clean_emp_id):03d}"

            from database.connection import is_sql_server
            clean_cert_name = (data.certification_name or "").strip()[:150]

            # Gating check: Upfront certification request must be Approved if one exists
            cursor.execute(
                """
                SELECT TOP 1 id, status, request_code, provider_id, category_id
                FROM dbo.lms_certification_requests
                WHERE LOWER(employee_id) = LOWER(?)
                  AND LOWER(LTRIM(RTRIM(certification_name))) = LOWER(?)
                ORDER BY CASE WHEN status = 'Approved' THEN 0 ELSE 1 END, id DESC
                """,
                (clean_emp_id, clean_cert_name),
            )
            cr_row = cursor.fetchone()
            if cr_row and cr_row[1] != "Approved":
                cr_stat = cr_row[1] or "Pending"
                cr_code = cr_row[2] or f"CR-{cr_row[0]}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot submit reimbursement claim: The certification request ({cr_code}) for '{clean_cert_name}' is currently {cr_stat}. Claims can only be submitted after management approves the request."
                )

            # Resolve provider_id and category_id
            final_provider_id = getattr(data, "provider_id", None)
            if not final_provider_id and cr_row and cr_row[3]:
                final_provider_id = cr_row[3]
            if not final_provider_id and provider_val:
                final_provider_id = course_metadata_repository.ensure_provider_exists(provider_val, cursor=cursor)

            final_category_id = getattr(data, "category_id", None)
            if not final_category_id and cr_row and cr_row[4]:
                final_category_id = cr_row[4]
            category_val = getattr(data, "category_name", None)
            if not final_category_id and category_val:
                final_category_id = course_metadata_repository.ensure_category_exists(category_val, cursor=cursor)
            if not final_category_id:
                final_category_id = course_metadata_repository.ensure_category_exists("Development", cursor=cursor)

            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
            cursor.execute(
                f"""
                SELECT TOP 1 id, claim_code
                FROM dbo.lms_reimbursement_claims{lock_hint}
                WHERE LOWER(employee_id) = LOWER(?)
                  AND LOWER(LTRIM(RTRIM(COALESCE(certification_name, '')))) = LOWER(?)
                  AND purchase_date = ?
                  AND amount = ?
                  AND COALESCE(status, 'Pending') <> 'Rejected'
                """,
                (clean_emp_id, clean_cert_name, data.purchase_date, amount_val),
            )
            dup_claim = cursor.fetchone()
            if dup_claim:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A reimbursement claim ({dup_claim[1]}) for '{clean_cert_name}' on {data.purchase_date} already exists."
                )

            # 2. Sequential Claim Code (CLM-YYYY-XXXX)
            claim_code = reimbursement_claim_repository.generate_next_claim_code(cursor)

            # 3. Insert Master Claim
            claim_id = reimbursement_claim_repository.insert_claim(
                cursor=cursor,
                claim_code=claim_code,
                employee_id=clean_emp_id,
                certification_name=data.certification_name,
                amount=amount_val,
                purchase_date=data.purchase_date,
                completion_exam_date=comp_date,
                provider_name=provider_val,
                provider_id=final_provider_id,
                category_id=final_category_id,
                validity_from=data.validity_from,
                validity_to=data.validity_to,
                supporting_document_path=doc_path,
                claim_type=data.claim_type or "Certification",
                status="Pending",
                processing_status="Submitted to HR",
                created_by=clean_emp_id
            )

            # 4. Insert 5 Approval Stages
            reimbursement_claim_repository.insert_claim_stages(
                cursor=cursor,
                claim_identifier=claim_code,
                created_by=clean_emp_id
            )

            # 5. Dispatch Notifications
            try:
                stakeholders = self._get_claim_stakeholders(clean_emp_id)
                emp_name = stakeholders["requester_name"]
                mgr_id = stakeholders["reporting_manager_id"]
                ld_ids = stakeholders["ld_team_ids"]
                hr_ids = stakeholders["hr_team_ids"]

                # 5a. Requester confirmation
                self._dispatch_notification(
                    cursor=cursor,
                    employee_id=clean_emp_id,
                    message=f"Your certification reimbursement claim {claim_code} for '{data.certification_name}' (₹{amount_val:,.0f}) was submitted to HR.",
                    created_by="SYSTEM"
                )

                # 5b. Reporting Manager notification
                if mgr_id and mgr_id != clean_emp_id:
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=mgr_id,
                        message=f"{emp_name} submitted a new certification reimbursement claim {claim_code} for '{data.certification_name}' (₹{amount_val:,.0f}).",
                        created_by=clean_emp_id
                    )

                # 5c. L&D Team notification
                for ld_id in ld_ids:
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=ld_id,
                        message=f"New certification reimbursement claim {claim_code} for '{data.certification_name}' submitted by {emp_name} (₹{amount_val:,.0f}).",
                        created_by=clean_emp_id
                    )

                # 5d. HR Team notification
                for hr_id in hr_ids:
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=hr_id,
                        message=f"New certification reimbursement claim {claim_code} from {emp_name} awaits HR review.",
                        created_by=clean_emp_id
                    )
            except Exception as notify_err:
                print(f"[ReimbursementClaimService] Non-fatal notification error on claim creation: {notify_err}")

            conn.commit()

            created = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
            if created:
                created["stages"] = reimbursement_claim_repository.get_claim_stages(cursor, claim_id)
            return created or {"id": claim_id, "claim_code": claim_code}
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create reimbursement claim: {str(e)}"
            )
        finally:
            conn.close()

    def hr_decision(self, claim_id: int, decision: ReimbursementHRDecision) -> Dict[str, Any]:
        """
        HR approves or rejects the reimbursement claim:
        - If Approved:
            * Claim status -> 'Approved'
            * Processing status -> 'Paid' (Amount is reimbursed)
            * Stages 4 & 5 marked 'Completed'
            * Financial record logged in dbo.lms_spend_category ('Certifications')
            * Audit log recorded in dbo.lms_hr_activity_feed
            * Notifies Employee, Reporting Manager, and L&D Team
        - If Rejected:
            * Claim status -> 'Rejected'
            * Processing status -> 'Rejected' (Amount is not paid)
            * Stages 4 & 5 marked 'Rejected'
            * Audit log recorded in dbo.lms_hr_activity_feed
            * Notifies Employee and L&D Team
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            claim = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
            if not claim:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reimbursement claim with ID {claim_id} not found"
                )

            raw_admin = str(decision.admin_id or "").strip()
            if not raw_admin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Authenticated admin employee_id is required.",
                )
            admin_actor = raw_admin[:7].upper()
            norm_status = decision.status.strip().capitalize()
            if norm_status not in ["Approved", "Rejected"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'Approved' or 'Rejected'"
                )

            current_claim_status = (claim.get("status") or "Pending").strip()
            if current_claim_status == norm_status and norm_status in ("Approved", "Rejected"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Reimbursement claim {claim.get('claim_code') or claim_id} has already been {current_claim_status.lower()}."
                )

            claim_code = claim.get("claim_code") or f"CLM-{claim_id}"
            cert_name = claim.get("certification_name") or "Certification"
            amount_val = float(claim.get("amount") or 0.0)
            emp_id = claim.get("employee_id")

            stakeholders = self._get_claim_stakeholders(emp_id)
            emp_name = stakeholders["requester_name"]
            dept = stakeholders["department"]
            mgr_id = stakeholders["reporting_manager_id"]
            ld_ids = stakeholders["ld_team_ids"]

            if norm_status == "Approved":
                # Verify that any linked upfront request was already approved by management (L&D and CEO)
                cursor.execute("""
                    SELECT TOP 1 cr.id, cr.status, cr.request_code
                    FROM dbo.lms_certification_requests cr
                    WHERE cr.employee_id = ?
                      AND LOWER(LTRIM(RTRIM(cr.certification_name))) = LOWER(LTRIM(RTRIM(?)))
                    ORDER BY CASE WHEN cr.status = 'Approved' THEN 0 ELSE 1 END, cr.id DESC
                """, (str(claim.get("employee_id") or "").strip(), str(claim.get("certification_name") or "").strip()))
                cr_check = cursor.fetchone()
                if cr_check and cr_check[1] != "Approved":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot approve reimbursement claim: Upfront certification request {cr_check[2]} is currently '{cr_check[1]}' and must be approved by management (L&D and CEO) first."
                    )

                course_metadata_repository.ensure_provider_exists(claim.get("provider"), cursor=cursor)
                # 1. Update Master Claim — marked Approved (Payment Pending)
                reimbursement_claim_repository.update_claim_status(
                    cursor=cursor,
                    claim_id=claim_id,
                    status="Approved",
                    processing_status="Approved",
                    comments=decision.comments,
                    updated_by=admin_actor
                )

                # 2. Update Timeline Stages (Stage 4 HR Approval -> Completed; Stage 5 Reimbursed stays Pending)
                reimbursement_claim_repository.update_stages_on_hr_decision(
                    cursor=cursor,
                    claim_identifier=claim_code,
                    status="Approved",
                    updated_by=admin_actor
                )

                # 3. Audit Trail in dbo.lms_hr_activity_feed
                try:
                    feed_msg = f"Reimbursement claim {claim_code} for '{cert_name}' (₹{amount_val:,.0f}) approved by HR. Pending payment."
                    reimbursement_claim_repository.insert_hr_activity(
                        cursor=cursor,
                        activity_type="CLAIM_APPROVED",
                        message=feed_msg,
                        created_by=admin_actor
                    )
                except Exception as feed_err:
                    print(f"[ReimbursementClaimService] Notice logging HR activity: {feed_err}")

                # 4. Dispatch Notifications
                try:
                    # To Requester
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=emp_id,
                        message=f"Your reimbursement claim {claim_code} for '{cert_name}' (₹{amount_val:,.0f}) was APPROVED by HR and is pending payment processing.",
                        created_by=admin_actor
                    )

                    # To Reporting Manager
                    if mgr_id and mgr_id != emp_id:
                        self._dispatch_notification(
                            cursor=cursor,
                            employee_id=mgr_id,
                            message=f"Reimbursement claim {claim_code} for '{cert_name}' ({emp_name}) was approved by HR and is pending payment.",
                            created_by=admin_actor
                        )

                    # To L&D Team
                    for ld_id in ld_ids:
                        self._dispatch_notification(
                            cursor=cursor,
                            employee_id=ld_id,
                            message=f"Reimbursement claim {claim_code} for '{cert_name}' ({emp_name}) was approved by HR and is pending payment.",
                            created_by=admin_actor
                        )
                except Exception as notify_err:
                    print(f"[ReimbursementClaimService] Non-fatal notification error: {notify_err}")
                    print(f"[ReimbursementClaimService] Non-fatal notification error: {notify_err}")

            else:
                # REJECTED FLOW
                reimbursement_claim_repository.update_claim_status(
                    cursor=cursor,
                    claim_id=claim_id,
                    status="Rejected",
                    processing_status=None,
                    comments=decision.comments,
                    updated_by=admin_actor
                )

                reimbursement_claim_repository.update_stages_on_hr_decision(
                    cursor=cursor,
                    claim_identifier=claim_code,
                    status="Rejected",
                    updated_by=admin_actor
                )

                try:
                    feed_msg = f"Reimbursement claim {claim_code} for '{cert_name}' was rejected by HR."
                    reimbursement_claim_repository.insert_hr_activity(
                        cursor=cursor,
                        activity_type="CLAIM_REJECTED",
                        message=feed_msg,
                        created_by=admin_actor
                    )
                except Exception as feed_err:
                    print(f"[ReimbursementClaimService] Notice logging HR activity: {feed_err}")

                try:
                    reason_suffix = f" Reason: {decision.comments}" if decision.comments else ""
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=emp_id,
                        message=f"Your reimbursement claim {claim_code} for '{cert_name}' was rejected by HR.{reason_suffix}",
                        created_by=admin_actor
                    )

                    for ld_id in ld_ids:
                        self._dispatch_notification(
                            cursor=cursor,
                            employee_id=ld_id,
                            message=f"Reimbursement claim {claim_code} for '{cert_name}' ({emp_name}) was rejected by HR.",
                            created_by=admin_actor
                        )
                except Exception as notify_err:
                    print(f"[ReimbursementClaimService] Non-fatal notification error: {notify_err}")

            conn.commit()

            updated = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
            if updated:
                stgs = reimbursement_claim_repository.get_claim_stages(cursor, claim_id)
                updated["stages"] = stgs
                hr_stg = next((s for s in stgs if s.get("stage_name") == "HR Approval"), None)
                if hr_stg and hr_stg.get("stage_date") and (updated.get("status") == "Approved" or updated.get("processing_status") == "Paid" or hr_stg.get("stage_status") == "Completed"):
                    updated["approved_on"] = hr_stg.get("stage_date")
                else:
                    updated["approved_on"] = None
            return updated or {"id": claim_id, "status": norm_status}
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process HR decision: {str(e)}"
            )
        finally:
            conn.close()

    def update_status(self, claim_id: int, status_update: ReimbursementClaimStatusUpdate, actor_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generic status update.
        - For 'Paid': directly marks processing_status = 'Paid' on an already-approved claim.
        - For 'Approved' / 'Rejected': routes through the full hr_decision workflow.
        """
        resolved_actor = str(actor_id or getattr(status_update, "updated_by", None) or "").strip()
        if not resolved_actor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authenticated actor employee_id is required.",
            )
        resolved_actor = resolved_actor[:7].upper()
        decision_status = (status_update.status or status_update.processing_status or "Approved").strip()

        # Direct "Paid" update — marks the disbursement happened without re-running HR decision
        if decision_status.lower() == "paid":
            conn = connect_db()
            cursor = conn.cursor()
            try:
                reimbursement_claim_repository.update_claim_status(
                    cursor=cursor,
                    claim_id=claim_id,
                    status="Approved",
                    processing_status="Paid",
                    comments=status_update.comments,
                    updated_by=resolved_actor
                )
                # Update the "Reimbursed" stage to Completed
                try:
                    cursor.execute(
                        """
                        UPDATE dbo.lms_reimbursement_claim_stages
                        SET stage_status = 'Completed',
                            stage_date = CAST(GETDATE() AS DATE),
                            updated_at = GETDATE(),
                            updated_by = ?
                        WHERE request_code = (SELECT claim_code FROM dbo.lms_reimbursement_claims WHERE id = ?)
                          AND stage_name = 'Reimbursed'
                        """,
                        (resolved_actor, claim_id)
                    )
                except Exception as stage_err:
                    print(f"[ReimbursementClaimService] Notice updating Reimbursed stage: {stage_err}")

                conn.commit()
                updated = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
                if updated:
                    updated["stages"] = reimbursement_claim_repository.get_claim_stages(cursor, claim_id)
                return updated or {"id": claim_id, "status": "Approved", "processing_status": "Paid"}
            except HTTPException:
                conn.rollback()
                raise
            except Exception as e:
                conn.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to mark claim as Paid: {str(e)}"
                )
            finally:
                conn.close()

        # For Approved / Rejected — route through full HR decision
        if decision_status.capitalize() not in ("Approved", "Rejected"):
            decision_status = "Approved"
        hr_decision = ReimbursementHRDecision(
            status=decision_status.capitalize(),
            comments=status_update.comments,
            admin_id=resolved_actor
        )
        return self.hr_decision(claim_id, hr_decision)

    async def pay_claim(
        self,
        claim_id: int,
        file: Optional[UploadFile],
        description: Optional[str],
        actor_id: str
    ) -> Dict[str, Any]:
        """
        HR uploads a payment slip and marks the claim as Paid.
        Steps:
          1. Validate claim exists and is Approved (not already Paid).
          2. Validate uploaded file type if provided (PDF, DOC, DOCX, JPG, JPEG, PNG).
          3. Save file to uploads/payment_slips/<claim_code>_<timestamp>.<ext> if provided.
          4. Update DB: payment_slip_path, payment_description, paid_on, paid_by,
             processing_status = 'Paid'.
          5. Mark stage 5 'Reimbursed' as Completed.
          6. Log HR activity feed entry.
          7. Notify employee and L&D team.
        """
        import os

        conn = connect_db()
        cursor = conn.cursor()
        try:
            claim = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
            if not claim:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Reimbursement claim with ID {claim_id} not found."
                )

            current_status = (claim.get("status") or "").strip()
            current_proc   = (claim.get("processing_status") or "").strip()

            if current_status != "Approved":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only Approved claims can be marked as Paid."
                )
            if current_proc == "Paid":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Claim {claim.get('claim_code', claim_id)} has already been marked as Paid."
                )

            # Ensure upfront certification request (if any) is Approved
            cursor.execute("""
                SELECT TOP 1 cr.id, cr.status, cr.request_code
                FROM dbo.lms_certification_requests cr
                WHERE cr.employee_id = ?
                  AND LOWER(LTRIM(RTRIM(cr.certification_name))) = LOWER(LTRIM(RTRIM(?)))
                ORDER BY CASE WHEN cr.status = 'Approved' THEN 0 ELSE 1 END, cr.id DESC
            """, (str(claim.get("employee_id") or "").strip(), str(claim.get("certification_name") or "").strip()))
            cr_check = cursor.fetchone()
            if cr_check and cr_check[1] != "Approved":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot disburse payment: Upfront certification request {cr_check[2]} is currently '{cr_check[1]}' and must be approved by management first."
                )

            relative_path = None
            original_name = None
            claim_code = claim.get("claim_code") or f"CLM-{claim_id}"

            if file and getattr(file, "filename", None):
                # Validate file type
                allowed_exts = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
                original_name = file.filename or ""
                _, ext = os.path.splitext(original_name)
                if ext.lower() not in allowed_exts:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Only PDF, DOC, DOCX, JPG, JPEG, or PNG files are allowed for payment slips."
                    )

                # Read and size-check (max 5MB)
                contents = await file.read()
                max_size = 5 * 1024 * 1024  # 5MB
                if len(contents) > max_size:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Payment slip file must not exceed 5MB."
                    )

                # Save file to disk
                upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "payment_slips")
                upload_dir = os.path.normpath(upload_dir)
                os.makedirs(upload_dir, exist_ok=True)

                timestamp_str  = datetime.now().strftime("%Y%m%d_%H%M%S")
                safe_code      = claim_code.replace("/", "-").replace("\\", "-")
                saved_filename = f"{safe_code}_{timestamp_str}{ext.lower()}"
                abs_file_path  = os.path.join(upload_dir, saved_filename)

                with open(abs_file_path, "wb") as f_out:
                    f_out.write(contents)

                # Relative path stored in DB (served via /uploads/payment_slips/<name>)
                relative_path = f"uploads/payment_slips/{saved_filename}"

            actor_clean = str(actor_id).strip()[:7].upper()
            cert_name  = claim.get("certification_name") or "Certification"
            amount_val = float(claim.get("amount") or 0)
            emp_id     = claim.get("employee_id")
            stakeholders = self._get_claim_stakeholders(emp_id)
            emp_name   = stakeholders.get("requester_name")
            dept       = stakeholders.get("department") or "Product Operations"

            # 1. Generate unique payment code (PAY-YYYY-XXXX) and insert into dedicated dbo.lms_payment_records
            payment_code = payment_record_repository.generate_next_payment_code(cursor)
            payment_record_id = payment_record_repository.insert_payment_record(
                cursor=cursor,
                payment_code=payment_code,
                request_code=claim_code,
                claim_type="Certification",
                employee_id=str(emp_id),
                title=cert_name,
                amount=int(amount_val),
                payment_slip_path=relative_path,
                payment_slip_name=original_name,
                payment_description=description,
                paid_by=actor_clean
            )

            # 2. Update claim row in DB
            reimbursement_claim_repository.update_claim_payment_slip(
                cursor=cursor,
                claim_id=claim_id
            )

            # 3. Mark 'Reimbursed' stage as Completed
            try:
                cursor.execute(
                    """
                    UPDATE dbo.lms_reimbursement_claim_stages
                    SET stage_status = 'Completed',
                        stage_date   = CAST(GETDATE() AS DATE),
                        updated_at   = GETDATE(),
                        updated_by   = ?
                    WHERE request_code = ? AND stage_name = 'Reimbursed'
                    """,
                    (actor_clean, claim_code)
                )
            except Exception as stage_err:
                print(f"[ReimbursementClaimService] Notice updating Reimbursed stage: {stage_err}")

            # 4. Log Financial Spend in dbo.lms_spend_category
            try:
                reimbursement_claim_repository.insert_spend_category(
                    cursor=cursor,
                    spend_category="Certifications",
                    department=dept,
                    amount=amount_val,
                    created_by=actor_clean
                )
            except Exception as spend_err:
                print(f"[ReimbursementClaimService] Notice logging spend on payout: {spend_err}")

            # 5. Audit log
            try:
                reimbursement_claim_repository.insert_hr_activity(
                    cursor=cursor,
                    activity_type="CLAIM_PAID",
                    message=f"Payment slip uploaded for claim {claim_code} ('{cert_name}', ₹{amount_val:,.0f}). Record #{payment_code} created.",
                    created_by=actor_clean
                )
            except Exception as feed_err:
                print(f"[ReimbursementClaimService] Notice logging HR activity: {feed_err}")

            # 6. Notifications
            try:
                self._dispatch_notification(
                    cursor=cursor,
                    employee_id=emp_id,
                    message=f"Congratulations! Your reimbursement claim {claim_code} for '{cert_name}' (₹{amount_val:,.0f}) has been Paid by HR. Payment record #{payment_code} recorded.",
                    created_by=actor_clean
                )

                for ld_id in stakeholders.get("ld_team_ids", []):
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=ld_id,
                        message=f"Reimbursement claim {claim_code} for '{cert_name}' has been marked as Paid by HR. Payment slip uploaded.",
                        created_by=actor_clean
                    )
            except Exception as notify_err:
                print(f"[ReimbursementClaimService] Non-fatal notification error on pay_claim: {notify_err}")

            conn.commit()

            updated = reimbursement_claim_repository.get_claim_by_id(cursor, claim_id)
            if updated:
                updated["stages"] = reimbursement_claim_repository.get_claim_stages(
                    cursor,
                    claim_id,
                    employee_id=updated.get("employee_id"),
                    certification_name=updated.get("certification_name")
                )
                updated["payment_code"] = payment_code
                updated["payment_record_id"] = payment_record_id
            return updated or {"id": claim_id, "processing_status": "Paid", "payment_code": payment_code}

        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process payment slip upload: {str(e)}"
            )
        finally:
            conn.close()

    async def pay_course(
        self,
        course_id: int,
        file: Optional[UploadFile],
        description: Optional[str],
        actor_id: str
    ) -> Dict[str, Any]:
        """
        HR uploads a payment slip and marks a Course request as Paid.
        Inserts record into dbo.lms_payment_records and updates course payment_status.
        """
        import os
        from database.connection import dictfetchone

        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT id, course_name, provider, price, hr_status, COALESCE(payment_status, 'Pending Payment') as payment_status,
                       request_id, claim_id, created_by
                FROM dbo.lms_courses
                WHERE id = ?
                """,
                (course_id,)
            )
            course = dictfetchone(cursor)
            if not course:
                raise HTTPException(status_code=404, detail=f"Course with ID {course_id} not found.")

            hr_status = (course.get("hr_status") or "").strip().capitalize()
            pay_status = (course.get("payment_status") or "").strip().capitalize()

            if hr_status != "Approved":
                raise HTTPException(status_code=400, detail="Only Approved courses can be marked as Paid.")
            if pay_status == "Paid":
                raise HTTPException(status_code=409, detail=f"Course {course_id} has already been marked as Paid.")

            relative_path = None
            original_name = None
            req_code = course.get("claim_id") or course.get("request_id") or f"CRS-{course_id}"

            if file and getattr(file, "filename", None):
                # Validate file type
                allowed_exts = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
                original_name = file.filename or ""
                _, ext = os.path.splitext(original_name)
                if ext.lower() not in allowed_exts:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Only PDF, DOC, DOCX, JPG, JPEG, or PNG files are allowed for payment slips."
                    )

                contents = await file.read()
                if len(contents) > 10 * 1024 * 1024:
                    raise HTTPException(status_code=400, detail="Payment slip file must not exceed 5MB.")

                upload_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "payment_slips"))
                os.makedirs(upload_dir, exist_ok=True)

                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                safe_code = str(req_code).replace("/", "-").replace("\\", "-")
                saved_filename = f"{safe_code}_{timestamp_str}{ext.lower()}"
                abs_file_path = os.path.join(upload_dir, saved_filename)

                with open(abs_file_path, "wb") as f_out:
                    f_out.write(contents)

                relative_path = f"uploads/payment_slips/{saved_filename}"
            actor_clean = str(actor_id).strip()[:7].upper()
            course_title = course.get("course_name") or "Course"
            price_val = float(course.get("price") or 0)
            emp_id = course.get("created_by") or "EMP001"
            stakeholders = self._get_claim_stakeholders(emp_id)
            emp_name = stakeholders.get("requester_name")
            dept = stakeholders.get("department") or "Product Operations"

            # 1. Insert into dbo.lms_payment_records
            payment_code = payment_record_repository.generate_next_payment_code(cursor)
            payment_record_id = payment_record_repository.insert_payment_record(
                cursor=cursor,
                payment_code=payment_code,
                request_code=str(req_code),
                claim_type="Course",
                employee_id=str(emp_id),
                title=course_title,
                amount=int(price_val),
                payment_slip_path=relative_path,
                payment_slip_name=original_name,
                payment_description=description,
                paid_by=actor_clean
            )

            # 2. Update dbo.lms_courses
            cursor.execute(
                """
                UPDATE dbo.lms_courses
                SET payment_status = 'Paid',
                    support_document = COALESCE(support_document, ?),
                    updated_at = GETDATE(),
                    updated_by = ?
                WHERE id = ?
                """,
                (relative_path, actor_clean, course_id)
            )

            # 3. Log Financial Spend in dbo.lms_spend_category
            try:
                reimbursement_claim_repository.insert_spend_category(
                    cursor=cursor,
                    spend_category="Courses",
                    department=dept,
                    amount=price_val,
                    created_by=actor_clean
                )
            except Exception as spend_err:
                print(f"[ReimbursementClaimService] Notice logging course spend: {spend_err}")

            # 4. Audit feed
            try:
                reimbursement_claim_repository.insert_hr_activity(
                    cursor=cursor,
                    activity_type="COURSE_PAID",
                    message=f"Course #{course_id} '{course_title}' (₹{price_val:,.0f}) paid. Payment record #{payment_code}.",
                    created_by=actor_clean
                )
            except Exception as feed_err:
                print(f"[ReimbursementClaimService] Notice logging HR course paid activity: {feed_err}")

            # 5. Dispatch notification ONLY to the respective L&D member who added the course to catalog
            try:
                ld_adder = course.get("created_by") or emp_id
                ld_targets = set()
                if ld_adder:
                    ld_targets.add(str(ld_adder).strip().upper()[:7])
                if not ld_targets:
                    for ld_emp in employee_service.get_employee_ids_by_role("L&D", "L&D Team"):
                        ld_targets.add(str(ld_emp).strip().upper()[:7])

                for target_ld in ld_targets:
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=target_ld,
                        message=f"Course reimbursement for '{course_title}' (₹{price_val:,.0f}) has been Paid by HR. Payment record #{payment_code} recorded.",
                        created_by=actor_clean
                    )
            except Exception as notify_err:
                print(f"[ReimbursementClaimService] Non-fatal notification error on pay_course: {notify_err}")

            conn.commit()

            return {
                "course_id": course_id,
                "payment_code": payment_code,
                "payment_record_id": payment_record_id,
                "payment_status": "Paid",
                "payment_slip_path": relative_path,
                "payment_slip_name": original_name,
                "payment_description": description,
                "paid_on": datetime.now().strftime("%Y-%m-%d"),
            }

        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process course payment slip upload: {str(e)}"
            )
        finally:
            conn.close()

reimbursement_claim_service = ReimbursementClaimService()
