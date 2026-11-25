/**
 * Report Export Utility
 * Generates and downloads Employee Learning & Financial Reports in CSV, Excel (.xls), and PDF formats.
 * Includes learning analytics, department summaries, reimbursement claims, and expenditure history.
 */
import emergereLogo from "../assets/emergere_logo3.png";

// Format date helper
export const formatCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatCurrentDateTime = () => {
  const now = new Date();
  return now.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Escapes CSV cell values
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Escapes XML strings for SpreadsheetML and HTML
 */
export function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Triggers browser download of a Blob
 */
function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Export to CSV with UTF-8 BOM
 */
export function exportToCSV({
  title = "Overall Employee Learning & Financial Report",
  dateRange = "All Time",
  overview = {},
  financials = {},
  employees = [],
  departmentSummary = [],
  reimbursementClaims = [],
  courseRequests = [],
  includes = {},
}) {
  const lines = [];

  // Title & Metadata
  lines.push(`"EMERGERE COMPUTING SOLUTIONS PRIVATE LIMITED"`);
  lines.push(escapeCSV(title));
  lines.push(`"Generated On: ${formatCurrentDateTime()}"`);
  lines.push(`"Date Range: ${dateRange}"`);
  lines.push("");

  // Executive Summary KPIs
  lines.push(`"--- EXECUTIVE SUMMARY ---"`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Total Employees",${overview.totalEmployees ?? employees.length ?? 0}`);
  lines.push(`"Active Learners",${overview.activeLearners ?? 0}`);
  lines.push(`"Total Learning Hours",${escapeCSV(overview.learningHours ?? "0h")}`);
  lines.push(`"Certificates Earned",${overview.certificatesEarned ?? 0}`);
  if (includes.reimbursements !== false) {
    lines.push(`"Total Training Budget",${escapeCSV(financials.totalInvestment || "₹ 1,500,000")}`);
    lines.push(`"Total Amount Spent (YTD)",${escapeCSV(financials.totalSpentFormatted || "₹ 0")}`);
    lines.push(`"Pending Claim Liability",${escapeCSV(financials.pendingAmountFormatted || "₹ 0")}`);
    lines.push(`"Claims Approved / Paid",${financials.approvedClaimsCount ?? 0}`);
    lines.push(`"Pending Claims",${financials.pendingClaimsCount ?? 0}`);
    lines.push(`"Course Spend",${escapeCSV(financials.courseSpendFormatted || "₹ 0")}`);
    lines.push(`"Certification Spend",${escapeCSV(financials.certificationSpendFormatted || "₹ 0")}`);
  }
  lines.push("");

  // Department Performance & Expenditure Summary
  if (includes.departmentSummary !== false && departmentSummary.length > 0) {
    lines.push(`"--- DEPARTMENT PERFORMANCE & EXPENDITURE SUMMARY ---"`);
    lines.push(`"Department","Team Size","Active Learners","Total Hours","Courses Done","Certificates","Reimbursed Spend"`);
    departmentSummary.forEach((d) => {
      lines.push([
        escapeCSV(d.department),
        d.teamSize,
        d.activeLearners,
        `${d.hours}h`,
        d.coursesDone,
        d.certs,
        escapeCSV(`₹ ${d.spend.toLocaleString("en-IN")}`),
      ].join(","));
    });
    lines.push("");
  }

  // Employee Learning Records
  lines.push(`"--- EMPLOYEE LEARNING RECORDS ---"`);
  const headers = ["Employee ID", "Employee Name", "Department", "Role / Job Title"];
  if (includes.courseProgress !== false) headers.push("Courses Enrolled", "Learning Progress (%)");
  if (includes.learningHours !== false) headers.push("Learning Hours");
  if (includes.certificates !== false) headers.push("Certificates");
  headers.push("Status");
  lines.push(headers.map(escapeCSV).join(","));

  employees.forEach((emp) => {
    const id = emp.employee_id || emp.id || "—";
    const name = emp.name || emp.full_name || "—";
    const dept = emp.department || "—";
    const role = emp.job_title || emp.role || "—";
    const courses = emp.courses ?? emp.courses_count ?? 0;
    const progress = `${emp.progress ?? emp.avg_progress ?? 0}%`;
    const hours = emp.hours || `${emp.total_learning_hours ?? 0}h`;
    const certs = emp.certificates ?? emp.certificates_count ?? emp.certifications ?? 0;
    const status = emp.learning_status || emp.learningStatus || "Inactive";

    const row = [id, name, dept, role];
    if (includes.courseProgress !== false) row.push(courses, progress);
    if (includes.learningHours !== false) row.push(hours);
    if (includes.certificates !== false) row.push(certs);
    row.push(status);
    lines.push(row.map(escapeCSV).join(","));
  });
  lines.push("");

  // Certification Reimbursement Claims
  if (includes.reimbursements !== false && reimbursementClaims.length > 0) {
    lines.push(`"--- CERTIFICATION REIMBURSEMENT CLAIMS ---"`);
    lines.push(`"Claim Code","Employee ID","Employee Name","Department","Certificate Name","Provider","Claim Amount (₹)","Status","Processing Status","Submitted Date"`);
    reimbursementClaims.forEach((c) => {
      lines.push([
        escapeCSV(c.claim_code || `CLM-${c.id}`),
        escapeCSV(c.employee_id || "—"),
        escapeCSV(c.employee_name || "—"),
        escapeCSV(c.department || "—"),
        escapeCSV(c.certification_name || "—"),
        escapeCSV(c.provider || c.provider_name || "—"),
        parseFloat(c.amount) || 0,
        escapeCSV(c.status || "—"),
        escapeCSV(c.processing_status || "—"),
        escapeCSV(c.submitted_on || (c.created_at ? String(c.created_at).slice(0, 10) : "—")),
      ].join(","));
    });
    lines.push("");
  }

  // Course Purchase & Reimbursement Requests
  if (includes.courseRequests !== false && courseRequests.length > 0) {
    lines.push(`"--- COURSE PURCHASE & REIMBURSEMENT REQUEST HISTORY ---"`);
    lines.push(`"Request Code","Employee ID","Employee Name","Department","Course Name","Provider","Estimated Cost (₹)","L&D Status","CEO Status","Purchase Status","Request Date"`);
    courseRequests.forEach((r) => {
      lines.push([
        escapeCSV(r.request_code || r.course_request_id || `EMP-${r.id}`),
        escapeCSV(r.employee_id || "—"),
        escapeCSV(r.employee_name || "—"),
        escapeCSV(r.department || "—"),
        escapeCSV(r.course_name || "—"),
        escapeCSV(r.provider || "—"),
        parseFloat(r.estimated_cost ?? r.price) || 0,
        escapeCSV(r.ld_status || "—"),
        escapeCSV(r.ceo_status || "—"),
        escapeCSV(r.purchase_status || "—"),
        escapeCSV(r.created_at ? String(r.created_at).slice(0, 10) : "—"),
      ].join(","));
    });
    lines.push("");
  }

  // UTF-8 BOM + content
  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `Employee_Learning_Report_${formatCurrentDate()}.csv`;
  triggerDownload(blob, filename);
}

/**
 * Export to Excel (Multi-Worksheet SpreadsheetML XML format with styling)
 */
export function exportToExcel({
  title = "Overall Employee Learning & Financial Report",
  dateRange = "All Time",
  overview = {},
  financials = {},
  employees = [],
  departmentSummary = [],
  reimbursementClaims = [],
  courseRequests = [],
  includes = {},
}) {
  const totalEmployees = overview.totalEmployees ?? employees.length ?? 0;
  const activeLearners = overview.activeLearners ?? 0;
  const learningHours = overview.learningHours ?? "0h";
  const certificatesEarned = overview.certificatesEarned ?? 0;

  // Build Employee Headers
  const empHeaders = ["Employee ID", "Employee Name", "Department", "Role / Job Title"];
  if (includes.courseProgress !== false) empHeaders.push("Courses Enrolled", "Learning Progress (%)");
  if (includes.learningHours !== false) empHeaders.push("Learning Hours");
  if (includes.certificates !== false) empHeaders.push("Certificates");
  empHeaders.push("Status");

  const empRowsXml = employees
    .map((emp, index) => {
      const id = emp.employee_id || emp.id || "—";
      const name = emp.name || emp.full_name || "—";
      const dept = emp.department || "—";
      const role = emp.job_title || emp.role || "—";
      const courses = emp.courses ?? emp.courses_count ?? 0;
      const progress = `${emp.progress ?? emp.avg_progress ?? 0}%`;
      const hours = emp.hours || `${emp.total_learning_hours ?? 0}h`;
      const certs = emp.certificates ?? emp.certificates_count ?? emp.certifications ?? 0;
      const status = emp.learning_status || emp.learningStatus || "Inactive";
      const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";

      const cells = [
        `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(id)}</Data></Cell>`,
        `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(name)}</Data></Cell>`,
        `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(dept)}</Data></Cell>`,
        `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(role)}</Data></Cell>`,
      ];
      if (includes.courseProgress !== false) {
        cells.push(
          `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${courses}</Data></Cell>`,
          `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(progress)}</Data></Cell>`
        );
      }
      if (includes.learningHours !== false) {
        cells.push(`<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(hours)}</Data></Cell>`);
      }
      if (includes.certificates !== false) {
        cells.push(`<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${certs}</Data></Cell>`);
      }
      cells.push(`<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(status)}</Data></Cell>`);
      return `<Row>${cells.join("")}</Row>`;
    })
    .join("\n");

  // Build Department Summary Rows XML
  let deptWorksheetXml = "";
  if (includes.departmentSummary !== false && departmentSummary.length > 0) {
    const deptRowsXml = departmentSummary
      .map((d, index) => {
        const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";
        return `<Row>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(d.department)}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${d.teamSize}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${d.activeLearners}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(`${d.hours}h`)}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${d.coursesDone}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${d.certs}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${d.spend}</Data></Cell>
        </Row>`;
      })
      .join("\n");

    deptWorksheetXml = `
  <Worksheet ss:Name="Department Summary">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="160"/>
      <Column ss:Width="90"/>
      <Column ss:Width="110"/>
      <Column ss:Width="120"/>
      <Column ss:Width="110"/>
      <Column ss:Width="90"/>
      <Column ss:Width="140"/>
      <Row ss:Height="24">
        <Cell ss:StyleID="Title"><Data ss:Type="String">Department Performance &amp; Expenditure Summary</Data></Cell>
      </Row>
      <Row></Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Team Size</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Active Learners</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Total Hours</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Courses Done</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Certificates</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Reimbursed Spend (₹)</Data></Cell>
      </Row>
      ${deptRowsXml}
    </Table>
  </Worksheet>`;
  }

  // Build Reimbursement Claims Worksheet XML
  let claimsWorksheetXml = "";
  if (includes.reimbursements !== false && reimbursementClaims.length > 0) {
    const claimsRowsXml = reimbursementClaims
      .map((c, index) => {
        const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";
        return `<Row>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.claim_code || `CLM-${c.id}`)}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.employee_id || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.employee_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.department || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.certification_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.provider || c.provider_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${parseFloat(c.amount) || 0}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.status || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.processing_status || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(c.submitted_on || (c.created_at ? String(c.created_at).slice(0, 10) : "—"))}</Data></Cell>
        </Row>`;
      })
      .join("\n");

    claimsWorksheetXml = `
  <Worksheet ss:Name="Reimbursement Claims">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="110"/>
      <Column ss:Width="90"/>
      <Column ss:Width="140"/>
      <Column ss:Width="140"/>
      <Column ss:Width="180"/>
      <Column ss:Width="130"/>
      <Column ss:Width="110"/>
      <Column ss:Width="90"/>
      <Column ss:Width="110"/>
      <Column ss:Width="100"/>
      <Row ss:Height="24">
        <Cell ss:StyleID="Title"><Data ss:Type="String">Certification Reimbursement Claims History</Data></Cell>
      </Row>
      <Row></Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Claim Code</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Employee ID</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Employee Name</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Department</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Certificate Name</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Provider</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Amount (₹)</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Processing</Data></Cell>
        <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Submitted Date</Data></Cell>
      </Row>
      ${claimsRowsXml}
    </Table>
  </Worksheet>`;
  }

  // Build Course Requests Worksheet XML
  let courseReqsWorksheetXml = "";
  if (includes.courseRequests !== false && courseRequests.length > 0) {
    const courseReqsRowsXml = courseRequests
      .map((r, index) => {
        const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";
        return `<Row>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.request_code || r.course_request_id || `EMP-${r.id}`)}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.employee_id || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.employee_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.department || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.course_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.provider || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${parseFloat(r.estimated_cost ?? r.price) || 0}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.ld_status || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.ceo_status || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.purchase_status || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.created_at ? String(r.created_at).slice(0, 10) : "—")}</Data></Cell>
        </Row>`;
      })
      .join("\n");

    courseReqsWorksheetXml = `
  <Worksheet ss:Name="Course Requests">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="110"/>
      <Column ss:Width="90"/>
      <Column ss:Width="140"/>
      <Column ss:Width="140"/>
      <Column ss:Width="180"/>
      <Column ss:Width="130"/>
      <Column ss:Width="110"/>
      <Column ss:Width="90"/>
      <Column ss:Width="90"/>
      <Column ss:Width="110"/>
      <Column ss:Width="100"/>
      <Row ss:Height="24">
        <Cell ss:StyleID="Title"><Data ss:Type="String">Course Purchase &amp; Reimbursement Requests</Data></Cell>
      </Row>
      <Row></Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Request Code</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Employee ID</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Employee Name</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Department</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Course Name</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Provider</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Cost (₹)</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">L&amp;D Status</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">CEO Status</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Purchase Status</Data></Cell>
        <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Request Date</Data></Cell>
      </Row>
      ${courseReqsRowsXml}
    </Table>
  </Worksheet>`;
  }

  const empHeaderCellsXml = empHeaders
    .map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="KpiLabel">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValue">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#215EF8"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValueGreen">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0EAB62"/>
   <Interior ss:Color="#EEFBF5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#215EF8" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderGreen">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0EAB62" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderPurple">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#8B5CF6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="EvenRow">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="OddRow">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Employee Learning Records">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">EMERGERE COMPUTING SOLUTIONS — ${escapeXml(title)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Subtitle"><Data ss:Type="String">Generated on: ${formatCurrentDateTime()} | Date Range: ${escapeXml(dateRange)}</Data></Cell>
   </Row>
   <Row></Row>
   <Row>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Total Employees</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="Number">${totalEmployees}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Active Learners</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="Number">${activeLearners}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Learning Hours</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="String">${escapeXml(learningHours)}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Certificates Earned</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="Number">${certificatesEarned}</Data></Cell>
   </Row>
   ${includes.reimbursements !== false
      ? `<Row>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Training Budget</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="String">${escapeXml(financials.totalInvestment || "₹ 1,500,000")}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Total Amount Spent</Data></Cell>
    <Cell ss:StyleID="KpiValueGreen"><Data ss:Type="String">${escapeXml(financials.totalSpentFormatted || "₹ 0")}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Pending Liability</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="String">${escapeXml(financials.pendingAmountFormatted || "₹ 0")}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Claims Approved</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="Number">${financials.approvedClaimsCount ?? 0}</Data></Cell>
   </Row>`
      : ""
    }
   <Row></Row>
   <Row ss:Height="22">
    ${empHeaderCellsXml}
   </Row>
   ${empRowsXml}
  </Table>
 </Worksheet>
 ${deptWorksheetXml}
 ${claimsWorksheetXml}
 ${courseReqsWorksheetXml}
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const filename = `Employee_Learning_Report_${formatCurrentDate()}.xls`;
  triggerDownload(blob, filename);
}

/**
 * Export to PDF by opening a formatted, print-optimized document preview in the browser
 */
export function exportToPDF({
  title = "Overall Employee Learning & Financial Report",
  dateRange = "All Time",
  overview = {},
  financials = {},
  employees = [],
  departmentSummary = [],
  reimbursementClaims = [],
  courseRequests = [],
  includes = {},
}) {
  const totalEmployees = overview.totalEmployees ?? employees.length ?? 0;
  const activeLearners = overview.activeLearners ?? 0;
  const learningHours = overview.learningHours ?? "0h";
  const certificatesEarned = overview.certificatesEarned ?? 0;

  // Build Employee Rows HTML
  const empHeaders = ["ID", "Employee Name", "Department", "Role"];
  if (includes.courseProgress !== false) empHeaders.push("Courses", "Progress");
  if (includes.learningHours !== false) empHeaders.push("Hours");
  if (includes.certificates !== false) empHeaders.push("Certificates");
  empHeaders.push("Status");

  const empRowsHtml = employees
    .map((emp) => {
      const id = emp.employee_id || emp.id || "—";
      const name = emp.name || emp.full_name || "—";
      const dept = emp.department || "—";
      const role = emp.job_title || emp.role || "—";
      const courses = emp.courses ?? emp.courses_count ?? 0;
      const progress = `${emp.progress ?? emp.avg_progress ?? 0}%`;
      const hours = emp.hours || `${emp.total_learning_hours ?? 0}h`;
      const certs = emp.certificates ?? emp.certificates_count ?? emp.certifications ?? 0;
      const status = emp.learning_status || emp.learningStatus || "Inactive";
      const statusColor = status === "Active" ? "#0EAB62" : "#64748B";
      const statusBg = status === "Active" ? "#EEFBF5" : "#F1F5F9";

      let cells = `
        <td style="font-weight:600; color:#215EF8;">${escapeXml(id)}</td>
        <td style="font-weight:600;">${escapeXml(name)}</td>
        <td>${escapeXml(dept)}</td>
        <td>${escapeXml(role)}</td>
      `;

      if (includes.courseProgress !== false) {
        cells += `
          <td style="text-align:center;">${courses}</td>
          <td style="text-align:center;">
            <div style="display:inline-block; width:60px; background:#E2E8F0; border-radius:4px; height:6px; vertical-align:middle; margin-right:4px;">
              <div style="width:${Math.min(100, Math.max(0, parseInt(progress, 10) || 0))}%; background:#215EF8; height:6px; border-radius:4px;"></div>
            </div>
            <span style="font-size:10px;">${progress}</span>
          </td>
        `;
      }
      if (includes.learningHours !== false) {
        cells += `<td style="text-align:center;">${escapeXml(hours)}</td>`;
      }
      if (includes.certificates !== false) {
        cells += `<td style="text-align:center; font-weight:600;">${certs}</td>`;
      }
      cells += `
        <td style="text-align:center;">
          <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:600; background:${statusBg}; color:${statusColor};">
            ${status}
          </span>
        </td>
      `;

      return `<tr>${cells}</tr>`;
    })
    .join("");

  // Build Department Summary Table HTML
  let deptSectionHtml = "";
  if (includes.departmentSummary !== false && departmentSummary.length > 0) {
    const deptRowsHtml = departmentSummary
      .map(
        (d) => `
        <tr>
          <td style="font-weight:600; color:#0F172A;">${escapeXml(d.department)}</td>
          <td style="text-align:center;">${d.teamSize}</td>
          <td style="text-align:center; font-weight:600; color:#0EAB62;">${d.activeLearners}</td>
          <td style="text-align:center;">${escapeXml(`${d.hours}h`)}</td>
          <td style="text-align:center;">${d.coursesDone}</td>
          <td style="text-align:center; font-weight:600;">${d.certs}</td>
          <td style="text-align:right; font-weight:600; color:#215EF8;">₹ ${d.spend.toLocaleString("en-IN")}</td>
        </tr>
      `
      )
      .join("");

    deptSectionHtml = `
      <div class="section-title">Department Performance &amp; Expenditure Summary</div>
      <table>
        <thead>
          <tr>
            <th>Department</th>
            <th style="text-align:center;">Team Size</th>
            <th style="text-align:center;">Active Learners</th>
            <th style="text-align:center;">Total Learning Hours</th>
            <th style="text-align:center;">Courses Completed</th>
            <th style="text-align:center;">Certificates</th>
            <th style="text-align:right;">Reimbursed Spend</th>
          </tr>
        </thead>
        <tbody>
          ${deptRowsHtml}
        </tbody>
      </table>
    `;
  }

  // Build Certification Claims Table HTML
  let claimsSectionHtml = "";
  if (includes.reimbursements !== false && reimbursementClaims.length > 0) {
    const claimsRowsHtml = reimbursementClaims
      .map((c) => {
        const amt = parseFloat(c.amount) || 0;
        const status = c.status || "—";
        const isApproved = status === "Approved" || c.processing_status === "Paid";
        const statusColor = isApproved ? "#0EAB62" : status === "Rejected" ? "#EF4444" : "#D97706";
        const statusBg = isApproved ? "#EEFBF5" : status === "Rejected" ? "#FEF2F2" : "#FFFBEB";

        return `
          <tr>
            <td style="font-weight:600; color:#215EF8;">${escapeXml(c.claim_code || `CLM-${c.id}`)}</td>
            <td style="font-weight:600;">${escapeXml(c.employee_name || "—")}</td>
            <td>${escapeXml(c.department || "—")}</td>
            <td>${escapeXml(c.certification_name || "—")}</td>
            <td>${escapeXml(c.provider || c.provider_name || "—")}</td>
            <td style="text-align:right; font-weight:600;">₹ ${amt.toLocaleString("en-IN")}</td>
            <td style="text-align:center;">
              <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:9.5px; font-weight:600; background:${statusBg}; color:${statusColor};">
                ${status}
              </span>
            </td>
            <td style="text-align:center;">
              <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:9.5px; font-weight:600; background:#F1F5F9; color:#475569;">
                ${escapeXml(c.processing_status || "—")}
              </span>
            </td>
            <td style="text-align:center; color:#64748B;">${escapeXml(c.submitted_on || (c.created_at ? String(c.created_at).slice(0, 10) : "—"))}</td>
          </tr>
        `;
      })
      .join("");

    claimsSectionHtml = `
      <div class="section-title">Certification Reimbursement Claims History (${reimbursementClaims.length})</div>
      <table>
        <thead>
          <tr>
            <th>Claim Code</th>
            <th>Employee Name</th>
            <th>Department</th>
            <th>Certificate Name</th>
            <th>Provider</th>
            <th style="text-align:right;">Claim Amount</th>
            <th style="text-align:center;">Claim Status</th>
            <th style="text-align:center;">Processing Status</th>
            <th style="text-align:center;">Submitted Date</th>
          </tr>
        </thead>
        <tbody>
          ${claimsRowsHtml}
        </tbody>
      </table>
    `;
  }

  // Build Course Requests Table HTML
  let courseReqsSectionHtml = "";
  if (includes.courseRequests !== false && courseRequests.length > 0) {
    const courseReqsRowsHtml = courseRequests
      .map((r) => {
        const cost = parseFloat(r.estimated_cost ?? r.price) || 0;
        const purchaseStatus = r.purchase_status || "—";
        const isPurchased = purchaseStatus === "Purchased";
        const statusColor = isPurchased ? "#0EAB62" : purchaseStatus === "Rejected" ? "#EF4444" : "#D97706";
        const statusBg = isPurchased ? "#EEFBF5" : purchaseStatus === "Rejected" ? "#FEF2F2" : "#FFFBEB";

        return `
          <tr>
            <td style="font-weight:600; color:#8B5CF6;">${escapeXml(r.request_code || r.course_request_id || `EMP-${r.id}`)}</td>
            <td style="font-weight:600;">${escapeXml(r.employee_name || "—")}</td>
            <td>${escapeXml(r.department || "—")}</td>
            <td>${escapeXml(r.course_name || "—")}</td>
            <td>${escapeXml(r.provider || "—")}</td>
            <td style="text-align:right; font-weight:600;">₹ ${cost.toLocaleString("en-IN")}</td>
            <td style="text-align:center;">${escapeXml(r.ld_status || "—")}</td>
            <td style="text-align:center;">${escapeXml(r.ceo_status || "—")}</td>
            <td style="text-align:center;">
              <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:9.5px; font-weight:600; background:${statusBg}; color:${statusColor};">
                ${purchaseStatus}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");

    courseReqsSectionHtml = `
      <div class="section-title">Course Purchase &amp; Reimbursement Request History (${courseRequests.length})</div>
      <table>
        <thead>
          <tr>
            <th>Request Code</th>
            <th>Employee Name</th>
            <th>Department</th>
            <th>Course Name</th>
            <th>Provider</th>
            <th style="text-align:right;">Estimated Cost</th>
            <th style="text-align:center;">L&amp;D Approval</th>
            <th style="text-align:center;">CEO Approval</th>
            <th style="text-align:center;">Purchase Status</th>
          </tr>
        </thead>
        <tbody>
          ${courseReqsRowsHtml}
        </tbody>
      </table>
    `;
  }

  const logoUrl =
    typeof emergereLogo === "string" &&
      (emergereLogo.startsWith("http") || emergereLogo.startsWith("data:"))
      ? emergereLogo
      : `${window.location.origin}${emergereLogo.startsWith("/") ? "" : "/"}${emergereLogo}`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Popup blocked, fallback to CSV export
    exportToCSV({
      title,
      dateRange,
      overview,
      financials,
      employees,
      departmentSummary,
      reimbursementClaims,
      courseRequests,
      includes,
    });
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <base href="${window.location.origin}/" />
        <title>${escapeXml(title)} - Emergere</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm 10mm;
          }
          * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          body {
            margin: 0;
            padding: 16px 20px;
            color: #1E293B;
            background: #FFFFFF;
            font-size: 11px;
          }
          .report-header {
            border-bottom: 2px solid #215EF8;
            padding-bottom: 12px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .company-name {
            font-size: 15px;
            font-weight: 700;
            color: #0F172A;
            letter-spacing: 0.3px;
          }
          .report-title {
            font-size: 13px;
            color: #215EF8;
            font-weight: 600;
            margin-top: 2px;
          }
          .meta-info {
            text-align: right;
            font-size: 10px;
            color: #64748B;
            line-height: 1.5;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 12px;
          }
          .kpi-card {
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 8px 12px;
            background: #F8FAFC;
          }
          .kpi-label {
            font-size: 9px;
            text-transform: uppercase;
            font-weight: 600;
            color: #64748B;
            letter-spacing: 0.5px;
          }
          .kpi-val {
            font-size: 17px;
            font-weight: 700;
            color: #215EF8;
            margin-top: 2px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 700;
            color: #0F172A;
            margin-top: 18px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #E2E8F0;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 16px;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th {
            background: #215EF8;
            color: #FFFFFF;
            font-weight: 600;
            text-align: left;
            padding: 6px 8px;
            font-size: 9.5px;
            letter-spacing: 0.3px;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid #E2E8F0;
            vertical-align: middle;
          }
          tr:nth-child(even) td {
            background: #F8FAFC;
          }
          .footer {
            margin-top: 16px;
            font-size: 9px;
            color: #94A3B8;
            text-align: center;
            border-top: 1px solid #E2E8F0;
            padding-top: 8px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div style="display:flex; align-items:center; gap:16px;">
            <img
              id="report-logo"
              src="${logoUrl}"
              alt="Emergere Technologies"
              style="height:38px; width:auto; max-width:190px; object-fit:contain; display:block;"
            />
            <div style="border-left:2px solid #CBD5E1; padding-left:14px;">
              <div class="company-name">EMERGERE COMPUTING SOLUTIONS</div>
              <div class="report-title">${escapeXml(title)}</div>
            </div>
          </div>
          <div class="meta-info">
            <div><strong>Generated:</strong> ${formatCurrentDateTime()}</div>
            <div><strong>Date Range:</strong> ${escapeXml(dateRange)}</div>
            <div><strong>Total Employees:</strong> ${employees.length}</div>
          </div>
        </div>

        <!-- Learning Metrics KPIs -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Employees</div>
            <div class="kpi-val">${totalEmployees}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Active Learners</div>
            <div class="kpi-val" style="color:#0EAB62;">${activeLearners}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Learning Hours</div>
            <div class="kpi-val" style="color:#8B5CF6;">${escapeXml(learningHours)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Certificates Earned</div>
            <div class="kpi-val" style="color:#FE7356;">${certificatesEarned}</div>
          </div>
        </div>

        ${includes.reimbursements !== false
      ? `
        <!-- Financial & Governance KPIs -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Training Budget / Investment</div>
            <div class="kpi-val" style="color:#0F172A;">${escapeXml(financials.totalInvestment || "₹ 1,500,000")}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Amount Spent (YTD)</div>
            <div class="kpi-val" style="color:#0EAB62;">${escapeXml(financials.totalSpentFormatted || "₹ 0")}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Pending Claim Liability</div>
            <div class="kpi-val" style="color:#D97706;">${escapeXml(financials.pendingAmountFormatted || "₹ 0")}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Claims Approved / Paid</div>
            <div class="kpi-val" style="color:#215EF8;">${financials.approvedClaimsCount ?? 0} <span style="font-size:10px; font-weight:normal; color:#64748B;">/ ${(financials.approvedClaimsCount ?? 0) + (financials.pendingClaimsCount ?? 0) + (financials.rejectedClaimsCount ?? 0)}</span></div>
          </div>
        </div>
        `
      : ""
    }

        ${deptSectionHtml}

        <div class="section-title">Employee Learning &amp; Certificate Records (${employees.length})</div>
        <table>
          <thead>
            <tr>
              ${empHeaders.map((h) => `<th>${escapeXml(h)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${empRowsHtml}
          </tbody>
        </table>

        ${claimsSectionHtml}
        ${courseReqsSectionHtml}

        <div class="footer">
          Confidential - Internal L&amp;D Analytics &amp; Financial Audit Report | Emergere Computing Solutions Pvt Ltd
        </div>

        <script>
          window.onload = function() {
            var logo = document.getElementById('report-logo');
            function triggerPrint() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
            if (logo && !logo.complete) {
              logo.onload = triggerPrint;
              logo.onerror = triggerPrint;
            } else {
              triggerPrint();
            }
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REPORTING MANAGER: TEAM LEARNING & ANALYTICS REPORT EXPORT
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Export Team Learning Report to CSV
 */
export function exportTeamToCSV({
  title = "Team Learning & Analytics Report",
  managerName = "Suresh Menon",
  managerId = "EMP004",
  dateRange = "This Month",
  overview = {},
  courseProgress = [],
  learningHours = [],
  certifications = [],
  leaderboard = [],
  includes = {},
}) {
  const lines = [];
  const teamSize = overview.team_members ?? overview.teamSize ?? courseProgress.length ?? 0;
  const activeLearners = overview.active_learners ?? overview.activeLearners ?? 0;
  const totalHours = overview.learning_hours ?? overview.learningHours ?? "0h";
  const certsEarned = overview.certificates_earned ?? overview.certificatesEarned ?? certifications.length ?? 0;

  // Title & Metadata
  lines.push(`"EMERGERE COMPUTING SOLUTIONS PRIVATE LIMITED"`);
  lines.push(escapeCSV(title));
  lines.push(`"Reporting Manager: ${managerName} (${managerId})"`);
  lines.push(`"Generated On: ${formatCurrentDateTime()}"`);
  lines.push(`"Date Range: ${dateRange}"`);
  lines.push(`"Total Direct Reports: ${teamSize}"`);
  lines.push("");

  // Executive Summary KPIs
  lines.push(`"--- TEAM OVERVIEW SUMMARY ---"`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Direct Reports",${teamSize}`);
  lines.push(`"Active Learners",${activeLearners}`);
  lines.push(`"Total Learning Hours",${escapeCSV(totalHours)}`);
  lines.push(`"Certificates Earned",${certsEarned}`);
  lines.push("");

  // Section 1: Course Progress
  if (includes.courseProgress !== false && courseProgress.length > 0) {
    lines.push(`"--- SECTION 1: TEAM COURSE PROGRESS ---"`);
    lines.push(`"Employee ID","Employee Name","Designation","Course Title","Provider","Category","Progress","Status","Last Accessed"`);
    courseProgress.forEach((r) => {
      lines.push([
        escapeCSV(r.employee_id || "—"),
        escapeCSV(r.name || r.employee_name || "—"),
        escapeCSV(r.designation || r.role || "—"),
        escapeCSV(r.course_name || r.course_title || "—"),
        escapeCSV(r.provider || "—"),
        escapeCSV(r.category || "General"),
        escapeCSV(r.progress || "0%"),
        escapeCSV(r.status || "Assigned"),
        escapeCSV(r.last_accessed || "—"),
      ].join(","));
    });
    lines.push("");
  }

  // Section 2: Learning Hours
  if (includes.learningHours !== false && learningHours.length > 0) {
    lines.push(`"--- SECTION 2: LEARNING HOURS & ENGAGEMENT ---"`);
    lines.push(`"Employee ID","Employee Name","Designation","Total Hours","Video Hours","Practice / Labs","Active Days"`);
    learningHours.forEach((r) => {
      lines.push([
        escapeCSV(r.employee_id || "—"),
        escapeCSV(r.name || r.employee_name || "—"),
        escapeCSV(r.designation || r.role || "—"),
        escapeCSV(r.total_hours || "0h"),
        escapeCSV(r.video_hours || "0h"),
        escapeCSV(r.practice_hours || "0h"),
        escapeCSV(r.active_days || "0 days"),
      ].join(","));
    });
    lines.push("");
  }

  // Section 3: Professional Certification
  if (includes.certifications !== false && certifications.length > 0) {
    lines.push(`"--- SECTION 3: PROFESSIONAL CERTIFICATION ---"`);
    lines.push(`"Employee ID","Employee Name","Certification Title","Provider / Type","Issue Date","Expiry Date","Status"`);
    certifications.forEach((r) => {
      lines.push([
        escapeCSV(r.employee_id || "—"),
        escapeCSV(r.name || r.employee_name || "—"),
        escapeCSV(r.certification_name || "—"),
        escapeCSV(r.certificate_type || r.provider || "Professional"),
        escapeCSV(r.issue_date || "—"),
        escapeCSV(r.expiry_date || "Lifetime"),
        escapeCSV(r.status || "—"),
      ].join(","));
    });
    lines.push("");
  }

  // Section 4: Leaderboard
  if (includes.leaderboardRankings !== false && leaderboard.length > 0) {
    lines.push(`"--- SECTION 4: TEAM LEADERBOARD RANKINGS ---"`);
    lines.push(`"Rank","Employee ID","Employee Name","Points"`);
    leaderboard.forEach((r) => {
      lines.push([
        escapeCSV(r.rank || "—"),
        escapeCSV(r.employee_id || "—"),
        escapeCSV(r.name || r.employee_name || "—"),
        escapeCSV(r.points || "0 pts"),
      ].join(","));
    });
    lines.push("");
  }

  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `Team_Learning_Report_${formatCurrentDate()}.csv`;
  triggerDownload(blob, filename);
}

/**
 * Export Team Learning Report to Excel (.xls SpreadsheetML)
 */
export function exportTeamToExcel({
  title = "Team Learning & Analytics Report",
  managerName = "Suresh Menon",
  managerId = "EMP004",
  dateRange = "This Month",
  overview = {},
  courseProgress = [],
  learningHours = [],
  certifications = [],
  leaderboard = [],
  includes = {},
}) {
  const teamSize = overview.team_members ?? overview.teamSize ?? courseProgress.length ?? 0;
  const activeLearners = overview.active_learners ?? overview.activeLearners ?? 0;
  const totalHours = overview.learning_hours ?? overview.learningHours ?? "0h";
  const certsEarned = overview.certificates_earned ?? overview.certificatesEarned ?? certifications.length ?? 0;

  // 1. Course Progress Rows XML
  let courseProgressRowsXml = "";
  if (includes.courseProgress !== false && courseProgress.length > 0) {
    courseProgressRowsXml = courseProgress
      .map((r, index) => {
        const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";
        return `<Row>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.employee_id || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.name || r.employee_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.designation || r.role || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.course_name || r.course_title || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.provider || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.category || "General")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.progress || "0%")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.status || "Assigned")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.last_accessed || "—")}</Data></Cell>
        </Row>`;
      })
      .join("\n");
  }

  // 2. Learning Hours Rows XML
  let learningHoursRowsXml = "";
  if (includes.learningHours !== false && learningHours.length > 0) {
    learningHoursRowsXml = learningHours
      .map((r, index) => {
        const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";
        return `<Row>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.employee_id || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.name || r.employee_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.designation || r.role || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.total_hours || "0h")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.video_hours || "0h")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.practice_hours || "0h")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.active_days || "0 days")}</Data></Cell>
        </Row>`;
      })
      .join("\n");
  }

  // 3. Certifications Rows XML
  let certRowsXml = "";
  if (includes.certifications !== false && certifications.length > 0) {
    certRowsXml = certifications
      .map((r, index) => {
        const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";
        return `<Row>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.employee_id || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.name || r.employee_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.certification_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.certificate_type || r.provider || "Professional")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.issue_date || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.expiry_date || "Lifetime")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.status || "—")}</Data></Cell>
        </Row>`;
      })
      .join("\n");
  }

  // 4. Leaderboard Rows XML
  let lbRowsXml = "";
  if (includes.leaderboardRankings !== false && leaderboard.length > 0) {
    lbRowsXml = leaderboard
      .map((r, index) => {
        const styleId = index % 2 === 0 ? "EvenRow" : "OddRow";
        return `<Row>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.rank || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.employee_id || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.name || r.employee_name || "—")}</Data></Cell>
          <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(r.points || "0 pts")}</Data></Cell>
        </Row>`;
      })
      .join("\n");
  }

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="KpiLabel">
   <Font ss:FontName="Segoe UI" ss:Size="9" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValue">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#215EF8"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiValueGreen">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0EAB62"/>
   <Interior ss:Color="#EEFBF5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#215EF8" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderGreen">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0EAB62" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderPurple">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#8B5CF6" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderOrange">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#F59E0B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="EvenRow">
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="OddRow">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Team Overview &amp; Courses">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="130"/>
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">EMERGERE COMPUTING SOLUTIONS — ${escapeXml(title)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Subtitle"><Data ss:Type="String">Manager: ${escapeXml(managerName)} (${escapeXml(managerId)}) | Generated: ${formatCurrentDateTime()} | Date Range: ${escapeXml(dateRange)}</Data></Cell>
   </Row>
   <Row></Row>
   <Row>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Direct Reports</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="Number">${teamSize}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Active Learners</Data></Cell>
    <Cell ss:StyleID="KpiValueGreen"><Data ss:Type="Number">${activeLearners}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Total Hours</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="String">${escapeXml(totalHours)}</Data></Cell>
    <Cell ss:StyleID="KpiLabel"><Data ss:Type="String">Certificates</Data></Cell>
    <Cell ss:StyleID="KpiValue"><Data ss:Type="Number">${certsEarned}</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Emp ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Employee Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Designation</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Course Title</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Provider</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Progress</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Last Accessed</Data></Cell>
   </Row>
   ${courseProgressRowsXml}
  </Table>
 </Worksheet>

 ${includes.learningHours !== false && learningHours.length > 0
      ? `<Worksheet ss:Name="Learning Hours">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">Team Learning Hours &amp; Engagement</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Emp ID</Data></Cell>
    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Employee Name</Data></Cell>
    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Designation</Data></Cell>
    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Total Hours</Data></Cell>
    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Video Hours</Data></Cell>
    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Practice / Labs</Data></Cell>
    <Cell ss:StyleID="HeaderGreen"><Data ss:Type="String">Active Days</Data></Cell>
   </Row>
   ${learningHoursRowsXml}
  </Table>
 </Worksheet>`
      : ""
    }

 ${includes.certifications !== false && certifications.length > 0
      ? `<Worksheet ss:Name="Certifications">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="180"/>
   <Column ss:Width="130"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">Team Professional Certification</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Emp ID</Data></Cell>
    <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Employee Name</Data></Cell>
    <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Certification Title</Data></Cell>
    <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Provider / Type</Data></Cell>
    <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Issue Date</Data></Cell>
    <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Expiry Date</Data></Cell>
    <Cell ss:StyleID="HeaderPurple"><Data ss:Type="String">Status</Data></Cell>
   </Row>
   ${certRowsXml}
  </Table>
 </Worksheet>`
      : ""
    }

 ${includes.leaderboardRankings !== false && leaderboard.length > 0
      ? `<Worksheet ss:Name="Leaderboard">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="160"/>
   <Column ss:Width="120"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">Team Leaderboard Rankings</Data></Cell>
   </Row>
   <Row></Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderOrange"><Data ss:Type="String">Rank</Data></Cell>
    <Cell ss:StyleID="HeaderOrange"><Data ss:Type="String">Emp ID</Data></Cell>
    <Cell ss:StyleID="HeaderOrange"><Data ss:Type="String">Employee Name</Data></Cell>
    <Cell ss:StyleID="HeaderOrange"><Data ss:Type="String">Points</Data></Cell>
   </Row>
   ${lbRowsXml}
  </Table>
 </Worksheet>`
      : ""
    }
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const filename = `Team_Learning_Report_${formatCurrentDate()}.xls`;
  triggerDownload(blob, filename);
}

/**
 * Export Team Learning Report to PDF (Print-optimized browser preview with Emergere logo)
 */
export function exportTeamToPDF({
  title = "Team Learning & Analytics Report",
  managerName = "Suresh Menon",
  managerId = "EMP004",
  dateRange = "This Month",
  overview = {},
  courseProgress = [],
  learningHours = [],
  certifications = [],
  leaderboard = [],
  includes = {},
}) {
  const teamSize = overview.team_members ?? overview.teamSize ?? courseProgress.length ?? 0;
  const activeLearners = overview.active_learners ?? overview.activeLearners ?? 0;
  const totalHours = overview.learning_hours ?? overview.learningHours ?? "0h";
  const certsEarned = overview.certificates_earned ?? overview.certificatesEarned ?? certifications.length ?? 0;

  // Section 1: Course Progress Rows HTML
  let courseProgressSectionHtml = "";
  if (includes.courseProgress !== false && courseProgress.length > 0) {
    const cpRowsHtml = courseProgress
      .map((r) => {
        const progressNum = Math.min(100, Math.max(0, parseInt(String(r.progress || 0).replace("%", ""), 10) || 0));
        const status = r.status || "Assigned";
        const statusColor = status === "Completed" ? "#0EAB62" : status === "In Progress" ? "#215EF8" : status === "Overdue" ? "#EF4444" : "#64748B";
        const statusBg = status === "Completed" ? "#EEFBF5" : status === "In Progress" ? "#EEF4FF" : status === "Overdue" ? "#FEF2F2" : "#F1F5F9";

        return `
          <tr>
            <td style="font-weight:600; color:#215EF8;">${escapeXml(r.employee_id || "—")}</td>
            <td style="font-weight:600; color:#0F172A;">${escapeXml(r.name || r.employee_name || "—")}</td>
            <td>${escapeXml(r.designation || r.role || "—")}</td>
            <td style="font-weight:500;">${escapeXml(r.course_name || r.course_title || "—")}</td>
            <td>${escapeXml(r.provider || "—")}</td>
            <td style="color:#64748B;">${escapeXml(r.category || "General")}</td>
            <td style="text-align:center;">
              <div style="display:inline-block; width:55px; background:#E2E8F0; border-radius:4px; height:6px; vertical-align:middle; margin-right:4px;">
                <div style="width:${progressNum}%; background:#215EF8; height:6px; border-radius:4px;"></div>
              </div>
              <span style="font-size:9.5px; font-weight:600;">${escapeXml(r.progress || `${progressNum}%`)}</span>
            </td>
            <td style="text-align:center;">
              <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:9.5px; font-weight:600; background:${statusBg}; color:${statusColor};">
                ${escapeXml(status)}
              </span>
            </td>
            <td style="text-align:center; color:#64748B;">${escapeXml(r.last_accessed || "—")}</td>
          </tr>
        `;
      })
      .join("");

    courseProgressSectionHtml = `
      <div class="section-title">Team Course Progress (${courseProgress.length})</div>
      <table>
        <thead>
          <tr>
            <th>Emp ID</th>
            <th>Employee Name</th>
            <th>Designation</th>
            <th>Course Title</th>
            <th>Provider</th>
            <th>Category</th>
            <th style="text-align:center;">Progress</th>
            <th style="text-align:center;">Status</th>
            <th style="text-align:center;">Last Accessed</th>
          </tr>
        </thead>
        <tbody>
          ${cpRowsHtml}
        </tbody>
      </table>
    `;
  }

  // Section 2: Learning Hours Rows HTML
  let learningHoursSectionHtml = "";
  if (includes.learningHours !== false && learningHours.length > 0) {
    const lhRowsHtml = learningHours
      .map((r) => `
        <tr>
          <td style="font-weight:600; color:#215EF8;">${escapeXml(r.employee_id || "—")}</td>
          <td style="font-weight:600; color:#0F172A;">${escapeXml(r.name || r.employee_name || "—")}</td>
          <td>${escapeXml(r.designation || r.role || "—")}</td>
          <td style="text-align:center; font-weight:600; color:#0EAB62;">${escapeXml(r.total_hours || "0h")}</td>
          <td style="text-align:center;">${escapeXml(r.video_hours || "0h")}</td>
          <td style="text-align:center;">${escapeXml(r.practice_hours || "0h")}</td>
          <td style="text-align:center; font-weight:600; color:#215EF8;">${escapeXml(r.active_days || "0 days")}</td>
        </tr>
      `)
      .join("");

    learningHoursSectionHtml = `
      <div class="section-title">Team Learning Hours &amp; Engagement (${learningHours.length})</div>
      <table>
        <thead>
          <tr>
            <th>Emp ID</th>
            <th>Employee Name</th>
            <th>Designation</th>
            <th style="text-align:center;">Total Learning Hours</th>
            <th style="text-align:center;">Video Hours</th>
            <th style="text-align:center;">Practice / Labs</th>
            <th style="text-align:center;">Active Days</th>
          </tr>
        </thead>
        <tbody>
          ${lhRowsHtml}
        </tbody>
      </table>
    `;
  }

  // Section 3: Professional Certification Rows HTML
  let certSectionHtml = "";
  if (includes.certifications !== false && certifications.length > 0) {
    const certRowsHtml = certifications
      .map((r) => {
        const status = r.status || "—";
        const isExpiring = status === "Expiring Soon";
        const isExpired = status === "Expired";
        const statusColor = isExpiring ? "#D97706" : isExpired ? "#EF4444" : "#0EAB62";
        const statusBg = isExpiring ? "#FFFBEB" : isExpired ? "#FEF2F2" : "#EEFBF5";

        return `
          <tr>
            <td style="font-weight:600; color:#215EF8;">${escapeXml(r.employee_id || "—")}</td>
            <td style="font-weight:600; color:#0F172A;">${escapeXml(r.name || r.employee_name || "—")}</td>
            <td style="font-weight:500;">${escapeXml(r.certification_name || "—")}</td>
            <td>${escapeXml(r.certificate_type || r.provider || "Professional")}</td>
            <td style="text-align:center; color:#64748B;">${escapeXml(r.issue_date || "—")}</td>
            <td style="text-align:center; color:#64748B;">${escapeXml(r.expiry_date || "Lifetime")}</td>
            <td style="text-align:center;">
              <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:9.5px; font-weight:600; background:${statusBg}; color:${statusColor};">
                ${escapeXml(status)}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");

    certSectionHtml = `
      <div class="section-title">Professional Certification Earned (${certifications.length})</div>
      <table>
        <thead>
          <tr>
            <th>Emp ID</th>
            <th>Employee Name</th>
            <th>Certification Title</th>
            <th>Provider / Type</th>
            <th style="text-align:center;">Issue Date</th>
            <th style="text-align:center;">Expiry Date</th>
            <th style="text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${certRowsHtml}
        </tbody>
      </table>
    `;
  }

  // Section 4: Leaderboard Rows HTML
  let lbSectionHtml = "";
  if (includes.leaderboardRankings !== false && leaderboard.length > 0) {
    const lbRowsHtml = leaderboard
      .map((r, i) => {
        const rank = r.rank || `#${i + 1}`;
        const isTop3 = i < 3;
        const rankBg = i === 0 ? "#FEF3C7" : i === 1 ? "#E2E8F0" : i === 2 ? "#FED7AA" : "#F1F5F9";
        const rankColor = i === 0 ? "#B45309" : i === 1 ? "#475569" : i === 2 ? "#C2410C" : "#64748B";

        return `
          <tr>
            <td style="text-align:center;">
              <span style="display:inline-block; padding:2px 10px; border-radius:12px; font-size:10px; font-weight:700; background:${rankBg}; color:${rankColor};">
                ${escapeXml(rank)}
              </span>
            </td>
            <td style="font-weight:600; color:#215EF8;">${escapeXml(r.employee_id || "—")}</td>
            <td style="font-weight:600; color:#0F172A;">${escapeXml(r.name || r.employee_name || "—")}</td>
            <td style="text-align:right; font-weight:700; color:#F59E0B;">${escapeXml(r.points || "0 pts")}</td>
          </tr>
        `;
      })
      .join("");

    lbSectionHtml = `
      <div class="section-title">Team Leaderboard &amp; Points (${leaderboard.length})</div>
      <table>
        <thead>
          <tr>
            <th style="text-align:center; width:70px;">Rank</th>
            <th style="width:110px;">Emp ID</th>
            <th>Employee Name</th>
            <th style="text-align:right; width:130px;">Learning Points</th>
          </tr>
        </thead>
        <tbody>
          ${lbRowsHtml}
        </tbody>
      </table>
    `;
  }

  const logoUrl =
    typeof emergereLogo === "string" &&
      (emergereLogo.startsWith("http") || emergereLogo.startsWith("data:"))
      ? emergereLogo
      : `${window.location.origin}${emergereLogo.startsWith("/") ? "" : "/"}${emergereLogo}`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Popup blocked, fallback to CSV export
    exportTeamToCSV({
      title,
      managerName,
      managerId,
      dateRange,
      overview,
      courseProgress,
      learningHours,
      certifications,
      leaderboard,
      includes,
    });
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <base href="${window.location.origin}/" />
        <title>${escapeXml(title)} - Emergere</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm 10mm;
          }
          * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          body {
            margin: 0;
            padding: 16px 20px;
            color: #1E293B;
            background: #FFFFFF;
            font-size: 11px;
          }
          .report-header {
            border-bottom: 2px solid #215EF8;
            padding-bottom: 12px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .company-name {
            font-size: 15px;
            font-weight: 700;
            color: #0F172A;
            letter-spacing: 0.3px;
          }
          .report-title {
            font-size: 13px;
            color: #215EF8;
            font-weight: 600;
            margin-top: 2px;
          }
          .meta-info {
            text-align: right;
            font-size: 10px;
            color: #64748B;
            line-height: 1.5;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .kpi-card {
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 8px 12px;
            background: #F8FAFC;
          }
          .kpi-label {
            font-size: 9px;
            text-transform: uppercase;
            font-weight: 600;
            color: #64748B;
            letter-spacing: 0.5px;
          }
          .kpi-val {
            font-size: 17px;
            font-weight: 700;
            color: #215EF8;
            margin-top: 2px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 700;
            color: #0F172A;
            margin-top: 16px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #E2E8F0;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 14px;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th {
            background: #215EF8;
            color: #FFFFFF;
            font-weight: 600;
            text-align: left;
            padding: 6px 8px;
            font-size: 9.5px;
            letter-spacing: 0.3px;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid #E2E8F0;
            vertical-align: middle;
          }
          tr:nth-child(even) td {
            background: #F8FAFC;
          }
          .footer {
            margin-top: 18px;
            font-size: 9px;
            color: #94A3B8;
            text-align: center;
            border-top: 1px solid #E2E8F0;
            padding-top: 8px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div style="display:flex; align-items:center; gap:16px;">
            <img
              id="report-logo"
              src="${logoUrl}"
              alt="Emergere Technologies"
              style="height:38px; width:auto; max-width:190px; object-fit:contain; display:block;"
            />
            <div style="border-left:2px solid #CBD5E1; padding-left:14px;">
              <div class="company-name">EMERGERE COMPUTING SOLUTIONS</div>
              <div class="report-title">${escapeXml(title)}</div>
            </div>
          </div>
          <div class="meta-info">
            <div><strong>Manager:</strong> ${escapeXml(managerName)} (${escapeXml(managerId)})</div>
            <div><strong>Generated:</strong> ${formatCurrentDateTime()}</div>
            <div><strong>Date Range:</strong> ${escapeXml(dateRange)}</div>
            <div><strong>Direct Reports:</strong> ${teamSize}</div>
          </div>
        </div>

        <!-- Team Overview KPIs -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Direct Reports</div>
            <div class="kpi-val">${teamSize}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Active Learners</div>
            <div class="kpi-val" style="color:#0EAB62;">${activeLearners}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Learning Hours</div>
            <div class="kpi-val" style="color:#8B5CF6;">${escapeXml(totalHours)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Certificates Earned</div>
            <div class="kpi-val" style="color:#FE7356;">${certsEarned}</div>
          </div>
        </div>

        ${courseProgressSectionHtml}
        ${learningHoursSectionHtml}
        ${certSectionHtml}
        ${lbSectionHtml}

        <div class="footer">
          Confidential - Internal Team Learning &amp; Performance Report | Emergere Computing Solutions Pvt Ltd
        </div>

        <script>
          window.onload = function() {
            var logo = document.getElementById('report-logo');
            function triggerPrint() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
            if (logo && !logo.complete) {
              logo.onload = triggerPrint;
              logo.onerror = triggerPrint;
            } else {
              triggerPrint();
            }
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Unified Team Learning Report Export Entry Point
 */
export function exportTeamReport(payload) {
  const fmt = (payload?.exportFormat || "PDF").toUpperCase();
  if (fmt === "CSV") {
    exportTeamToCSV(payload);
  } else if (fmt === "EXCEL") {
    exportTeamToExcel(payload);
  } else {
    exportTeamToPDF(payload);
  }
}

