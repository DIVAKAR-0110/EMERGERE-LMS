# LMS Learning Tracker & Auto-Login Browser Extension

Automated provider login with Microsoft Graph OTP and active learning hours tracker for Emergere LMS.

---

## 🔄 How to Reload the Extension in Chrome / Edge (After Updates)

1. Open your browser and go to:
   - **Google Chrome**: `chrome://extensions/`
   - **Microsoft Edge**: `edge://extensions/`
2. Find **"LMS Learning Tracker & Auto-Login"**.
3. Click the **Reload (🔄) button** on the extension card.
4. Refresh your LMS tab (`http://localhost:3000/employee/course-library`) with **F5**.

---

## ⚡ What was Updated & Fixed

1. **Fixed Backend 500 Error in `/api/extension/sync-learning`**:
   - Replaced unsupported `TRIM()` with `RTRIM(LTRIM())` for SQL Server 2008 compatibility.
   - Tested and verified HTTP 200 OK.

2. **Backend Console Printout on Watch & Tab Close**:
   - Whenever an active learning session is synced or the Udemy tab is closed, the backend terminal prints:
     ```
     ==========================================================================
     🎓 [LMS EXTENSION LEARNING SYNC] VIDEO WATCH SESSION RECORDED
     ==========================================================================
       👤 Employee Name    : Imran Khan (EMP019)
       📚 Course Name      : Microsoft Azure Fundamentals (AZ-900)
       ⏱️  Active Watch Time : 2m 25s (145 seconds)
       📊 Total Hours Log  : 180 hrs
       📅 Date Logged      : 2026-11-20
       📌 Status           : In Progress (Progress: 45.0%)
     ==========================================================================
     ```

3. **Active Video Tracker Enhancements**:
   - Shows live watch badge on Udemy video player: `🟢 LMS Logged: Xm Ys (Active)`.
   - Pausing, switching tabs, or closing the tab immediately triggers a sync to the LMS database.
