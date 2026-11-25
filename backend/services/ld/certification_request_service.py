"""
Certification Request Service.
Business logic and transaction management layer for multi-stage certification workflows:
Employee Request -> L&D Approval -> CEO Approval -> Certificate Approved.
"""

from typing import List, Dict, Any, Optional, Tuple
from fastapi import HTTPException, status
from database.connection import connect_db, is_sql_server
from utils.idempotency import is_unique_violation
from repositories.ld import certification_request_repository
from repositories.common import notification_repository
from models.ld.certification_request import (
    CertificationRequestCreate,
    CertificationRequestStatusUpdate,
    CertificationApprovalDecision
)
from repositories.common.course_metadata_repository import course_metadata_repository
from services.common.auth_service import employee_service

class CertificationRequestService:
    def _dispatch_notification(
        self,
        cursor,
        employee_id: Any,
        message: str,
        created_by: str = "SYSTEM"
    ):
        """Safely inserts a notification record into dbo.lms_notifications with varchar(7) truncation safeguards."""
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
            print(f"[CertificationRequestService] Failed to insert notification for {emp_clean}: {e}")

    def _get_workflow_stakeholders(self, employee_id: Any) -> Dict[str, Any]:
        """
        Dynamically resolves requester name, reporting manager ID, L&D team member IDs, and CEO ID.
        """
        emp_str = str(employee_id or "").strip()
        requester = employee_service.get_employee_by_id(emp_str) if emp_str else None
        all_emps = employee_service.get_all_employees()

        emp_name = (requester.get("name") or requester.get("display_name") or emp_str) if requester else emp_str
        reporting_manager_id = requester.get("reporting_manager_id") if requester else None

        # Fallback match by reporting_manager display name if ID was missing
        if not reporting_manager_id and requester and requester.get("reporting_manager"):
            mgr_str = requester["reporting_manager"].strip().lower()
            for e in all_emps:
                e_name = e.get("name", "").strip().lower()
                if e_name and (e_name in mgr_str or mgr_str in e_name):
                    reporting_manager_id = e.get("employee_id")
                    break

        # Collect L&D team member IDs dynamically from live directory
        ld_ids = employee_service.get_employee_ids_by_role("L&D", "L&D Team")

        # Collect CEO ID dynamically from live directory
        ceo_ids = employee_service.get_employee_ids_by_role("CEO")
        ceo_id = ceo_ids[0] if ceo_ids else None

        return {
            "requester_id": emp_str,
            "requester_name": emp_name,
            "reporting_manager_id": reporting_manager_id,
            "ld_team_ids": ld_ids,
            "ceo_id": ceo_id
        }

    def get_all(
        self,
        employee_id: Optional[Any] = None,
        status_filter: Optional[str] = None,
        stage: Optional[str] = None,
        exclude_active_claims: bool = False
    ) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return certification_request_repository.get_all_requests(
                cursor,
                employee_id=employee_id,
                status=status_filter,
                stage=stage,
                exclude_active_claims=exclude_active_claims
            )
        finally:
            conn.close()

    def _resolve_request(self, cursor, request_id: Any) -> Tuple[int, Dict[str, Any]]:
        """Resolves request_id whether provided as an integer ID or formatted request code (e.g. CLM-2026-0014)."""
        req_str = str(request_id).strip()
        num_id = int(req_str) if req_str.isdigit() else None
        req = None
        if num_id is not None:
            req = certification_request_repository.get_request_by_id(cursor, num_id)
        if not req:
            req = certification_request_repository.get_request_by_code(cursor, req_str)
            if req and req.get("id"):
                num_id = int(req["id"])

        if not req or num_id is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Certification request with ID or code '{request_id}' not found"
            )
        return num_id, req

    def get_by_id(self, request_id: Any) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            _, req = self._resolve_request(cursor, request_id)
            return req
        finally:
            conn.close()

    def get_stages(self, request_id: Any) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            num_id, _ = self._resolve_request(cursor, request_id)
            stages = certification_request_repository.get_request_stages(cursor, num_id)
            return stages
        finally:
            conn.close()

    def create(self, data: CertificationRequestCreate) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            provider_name = course_metadata_repository.normalize_metadata_name(data.provider_name, "Udemy")
            category_name = course_metadata_repository.normalize_metadata_name(data.category_name, "Development")
            provider_id = getattr(data, "provider_id", None) or course_metadata_repository.resolve_provider_id(data.provider_name, cursor=cursor)
            category_id = getattr(data, "category_id", None) or course_metadata_repository.resolve_category_id(data.category_name, cursor=cursor)

            from repositories.common.certification_domain_repository import certification_domain_repository
            domain_id = getattr(data, "domain_id", None) or certification_domain_repository.resolve_domain_id(data.category_name, cursor=cursor)

            clean_emp_id = str(data.employee_id).strip()
            clean_cert_name = (data.certification_name or "").strip()[:150]
            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
            cursor.execute(
                f"""
                SELECT TOP 1 id, request_code
                FROM dbo.lms_certification_requests{lock_hint}
                WHERE LOWER(employee_id) = LOWER(?)
                  AND LOWER(LTRIM(RTRIM(certification_name))) = LOWER(?)
                  AND ((? IS NOT NULL AND provider_id = ?) OR (? IS NULL AND provider_id IS NULL))
                  AND COALESCE(status, 'Pending') <> 'Rejected'
                """,
                (clean_emp_id, clean_cert_name, provider_id, provider_id, provider_id),
            )
            dup_cert_req = cursor.fetchone()
            if dup_cert_req:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"You already have an active certification request ({dup_cert_req[1]}) for '{clean_cert_name}'."
                )

            # Generate sequential request_code (CLM-YYYY-XXXX)
            request_code = certification_request_repository.generate_next_request_code(cursor)

            scheduled_date = (
                data.scheduled_exam_date.strip()
                if data.scheduled_exam_date and str(data.scheduled_exam_date).strip()
                else None
            )

            import re
            clean_purpose = re.sub(
                r"\n{2,}",
                "\n",
                re.sub(
                    r" *\n *",
                    "\n",
                    re.sub(r" {2,}", " ", str(data.purpose or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")),
                ),
            ).strip()[:500]
            request_id = certification_request_repository.insert_request(
                cursor=cursor,
                request_code=request_code,
                employee_id=clean_emp_id,
                certification_name=data.certification_name,
                provider_name=provider_name,
                category_name=category_name,
                provider_id=provider_id,
                category_id=category_id,
                domain_id=domain_id,
                estimated_cost_inr=int(data.estimated_cost_inr),
                purpose=clean_purpose,
                scheduled_exam_date=scheduled_date,
                supporting_document=data.supporting_document,
                supporting_document_name=data.supporting_document_name,
                supporting_document_size=data.supporting_document_size,
                request_status="Pending"
            )

            # Stage 1 Notifications:
            # 1. Requester confirmation
            # 2. Reporting Manager notification
            # 3. L&D Team notification
            try:
                stakeholders = self._get_workflow_stakeholders(data.employee_id)
                emp_id = stakeholders["requester_id"]
                emp_name = stakeholders["requester_name"]
                manager_id = stakeholders["reporting_manager_id"]
                ld_ids = stakeholders["ld_team_ids"]

                # 1. To Requester
                self._dispatch_notification(
                    cursor=cursor,
                    employee_id=emp_id,
                    message=f"Your certification request {request_code} for '{data.certification_name}' was submitted successfully and is pending L&D review.",
                    created_by=emp_id
                )

                # 2. To Reporting Manager
                if manager_id and manager_id != emp_id:
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=manager_id,
                        message=f"{emp_name} submitted a new certification request {request_code} for '{data.certification_name}'.",
                        created_by=emp_id
                    )

                # 3. To L&D Team
                for ld_id in ld_ids:
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=ld_id,
                        message=f"New certification request {request_code} for '{data.certification_name}' from {emp_name} requires your approval.",
                        created_by=emp_id
                    )
            except Exception as e:
                print(f"[CertificationRequestService] Non-fatal notification error on create: {e}")

            conn.commit()

            created = certification_request_repository.get_request_by_id(cursor, request_id)
            return created or {"request_id": request_id, "request_code": request_code}
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            if is_unique_violation(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"You already have an active certification request for '{(data.certification_name or '').strip()}'."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create certification request: {str(e)}"
            )
        finally:
            conn.close()

    def ld_approval(self, request_id: Any, decision: CertificationApprovalDecision) -> Dict[str, Any]:
        """Process L&D approval or rejection."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            num_id, req = self._resolve_request(cursor, request_id)

            # Enforce Separation of Duties: L&D user cannot approve or reject their own certification request
            admin_code = str(decision.admin_id or "").strip().upper()
            req_emp_id = str(req.get("employee_id") or "").strip().upper()
            if admin_code and req_emp_id and (admin_code == req_emp_id or (admin_code.isdigit() and req_emp_id == f"EMP{int(admin_code):03d}")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Self-approval is not permitted. Another L&D team member must review and approve this request."
                )

            import re
            clean_comments = (
                re.sub(
                    r"\n{2,}",
                    "\n",
                    re.sub(
                        r" *\n *",
                        "\n",
                        re.sub(
                            r" {2,}",
                            " ",
                            str(decision.comments or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " "),
                        ),
                    ),
                ).strip()
                if decision.comments is not None
                else None
            )

            bypass_ceo = bool(getattr(decision, "bypass_ceo", False)) and decision.status == "Approved"
            if decision.status == "Approved":
                course_metadata_repository.ensure_provider_exists(req.get("provider"), cursor=cursor)
                course_metadata_repository.ensure_category_exists(req.get("category"), cursor=cursor)
            certification_request_repository.update_ld_approval(
                cursor=cursor,
                request_id=num_id,
                status=decision.status,
                admin_id=decision.admin_id or 1,
                comments=clean_comments,
                bypass_ceo=bypass_ceo
            )

            # Stage 2 Notifications:
            # - If Approved & Bypassed: Notify Employee only (CEO skipped)
            # - If Approved & Not Bypassed: Notify Employee + Notify CEO (EMP001)
            # - If Rejected: Notify Employee with comments
            try:
                stakeholders = self._get_workflow_stakeholders(req.get("employee_id"))
                emp_id = stakeholders["requester_id"]
                emp_name = stakeholders["requester_name"]
                ceo_id = stakeholders["ceo_id"]
                req_code = req.get("request_code") or f"REQ-{num_id}"
                cert_name = req.get("certification_name") or "Certification"

                admin_actor = str(decision.admin_id).strip()[:7] if decision.admin_id else None

                if decision.status == "Approved":
                    if bypass_ceo:
                        # Notify Requester of final bypassed approval
                        self._dispatch_notification(
                            cursor=cursor,
                            employee_id=emp_id,
                            message=f"Congratulations! Your certification request {req_code} for '{cert_name}' was approved by L&D (CEO approval bypassed) and is approved for reimbursement/tracking.",
                            created_by=admin_actor
                        )
                    else:
                        # Notify Requester
                        self._dispatch_notification(
                            cursor=cursor,
                            employee_id=emp_id,
                            message=f"Your certification request {req_code} for '{cert_name}' was approved by L&D and forwarded to the CEO for final approval.",
                            created_by=admin_actor
                        )
                        # Notify CEO
                        if ceo_id:
                            self._dispatch_notification(
                                cursor=cursor,
                                employee_id=ceo_id,
                                message=f"Certification request {req_code} for '{cert_name}' ({emp_name}) was approved by L&D and awaits your approval.",
                                created_by=admin_actor
                            )
                elif decision.status == "Pending":
                    # Notify Requester of Reopened request
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=emp_id,
                        message=f"Your certification request for '{cert_name}' was reopened by the L&D Team and returned to Pending.",
                        created_by=admin_actor
                    )
                else:
                    # Notify Requester of Rejection
                    reason_suffix = f" Reason: {decision.comments}" if decision.comments else ""
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=emp_id,
                        message=f"Your certification request for '{cert_name}' was rejected by the L&D Team.{reason_suffix}",
                        created_by=admin_actor
                    )
            except Exception as e:
                print(f"[CertificationRequestService] Non-fatal notification error on L&D approval: {e}")

            conn.commit()
            return certification_request_repository.get_request_by_id(cursor, num_id)
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process L&D decision: {str(e)}"
            )
        finally:
            conn.close()

    def ceo_approval(self, request_id: Any, decision: CertificationApprovalDecision) -> Dict[str, Any]:
        """Process CEO approval or rejection."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            num_id, req = self._resolve_request(cursor, request_id)

            # Enforce Separation of Duties: CEO cannot self-approve
            admin_code = str(decision.admin_id or "").strip().upper()
            req_emp_id = str(req.get("employee_id") or "").strip().upper()
            if admin_code and req_emp_id and (admin_code == req_emp_id or (admin_code.isdigit() and req_emp_id == f"EMP{int(admin_code):03d}")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Self-approval is not permitted."
                )

            certification_request_repository.update_ceo_approval(
                cursor=cursor,
                request_id=num_id,
                status=decision.status,
                admin_id=decision.admin_id or 1,
                comments=decision.comments
            )

            # Stage 3 Notifications:
            # - If Approved: Notify Employee + Notify L&D Team (EMP010, EMP008)
            # - If Rejected: Notify Employee + Notify L&D Team
            try:
                stakeholders = self._get_workflow_stakeholders(req.get("employee_id"))
                emp_id = stakeholders["requester_id"]
                emp_name = stakeholders["requester_name"]
                ld_ids = stakeholders["ld_team_ids"]
                req_code = req.get("request_code") or f"REQ-{num_id}"
                cert_name = req.get("certification_name") or "Certification"

                admin_actor = str(decision.admin_id).strip()[:7] if decision.admin_id else None

                if decision.status == "Approved":
                    # Notify Requester
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=emp_id,
                        message=f"Congratulations! Your certification request {req_code} for '{cert_name}' was approved by the CEO and is approved for reimbursement/tracking.",
                        created_by=admin_actor
                    )
                    # Notify L&D Team
                    for ld_id in ld_ids:
                        self._dispatch_notification(
                            cursor=cursor,
                            employee_id=ld_id,
                            message=f"Certification request {req_code} for '{cert_name}' ({emp_name}) was approved by the CEO and added to Certificate Management.",
                            created_by=admin_actor
                        )
                else:
                    # Notify Requester of Rejection
                    reason_suffix = f" Reason: {decision.comments}" if decision.comments else ""
                    self._dispatch_notification(
                        cursor=cursor,
                        employee_id=emp_id,
                        message=f"Your certification request {req_code} for '{cert_name}' was rejected by the CEO.{reason_suffix}",
                        created_by=admin_actor
                    )
                    # Notify L&D Team of Rejection
                    for ld_id in ld_ids:
                        self._dispatch_notification(
                            cursor=cursor,
                            employee_id=ld_id,
                            message=f"Certification request {req_code} for '{cert_name}' ({emp_name}) was rejected by the CEO.",
                            created_by=admin_actor
                        )
            except Exception as e:
                print(f"[CertificationRequestService] Non-fatal notification error on CEO approval: {e}")

            conn.commit()
            return certification_request_repository.get_request_by_id(cursor, num_id)
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process CEO decision: {str(e)}"
            )
        finally:
            conn.close()

    def update_status(self, request_id: Any, status_update: CertificationRequestStatusUpdate) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            num_id, req = self._resolve_request(cursor, request_id)

            updated_by = getattr(status_update, "updated_by", None) or "SYSTEM"
            certification_request_repository.update_request_status(
                cursor, num_id, status_update.request_status, updated_by=updated_by
            )
            conn.commit()
            return certification_request_repository.get_request_by_id(cursor, num_id)
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update certification request status: {str(e)}"
            )
        finally:
            conn.close()

    def delete(self, request_id: Any) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            num_id, req = self._resolve_request(cursor, request_id)

            deleted = certification_request_repository.delete_request(cursor, num_id)
            conn.commit()
            return {"success": True, "message": f"Certification request {request_id} deleted successfully"}
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete certification request: {str(e)}"
            )
        finally:
            conn.close()

certification_request_service = CertificationRequestService()
