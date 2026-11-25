import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\rdiva\.gemini\antigravity\brain\78e04755-da2d-4ff2-be2d-76170b516d55"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Set up Reporting Manager user in localStorage
        page.add_init_script('''
            localStorage.setItem("lms_token", "dev-token-EMP004");
            localStorage.setItem("lms_user", JSON.stringify({
                id: 4,
                employee_id: "EMP004",
                name: "Suresh Menon",
                email: "suresh@emergere.com",
                role: "reporting_manager",
                is_profile_completed: true
            }));
            localStorage.setItem("lms_primary_role", "reporting_manager");
            localStorage.setItem("lms_current_mode", "PRIMARY");
            localStorage.setItem("lms_profile_completed", "true");
            localStorage.setItem("lms_active_employee_id", "EMP004");
        ''')

        print("=== 1. Testing Recommend Course Page (Video tab) ===")
        page.goto("http://localhost:3000/reporting-manager/recommend-course")
        page.wait_for_selector(".rm-btn-filter-toggle", timeout=15000)

        # Open filter
        page.locator(".rm-btn-filter-toggle").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")
        print("Video filter drawer opened.")

        # Capture screenshot
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_course_video_filter_open.png"))

        # Click outside on backdrop (coordinates 100, 200)
        page.mouse.click(100, 200)
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Drawer should NOT close on backdrop click!"
        print("PASS: Video drawer stayed open on backdrop click.")

        # Press Escape key
        page.keyboard.press("Escape")
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Drawer should NOT close on Escape key!"
        print("PASS: Video drawer stayed open on Escape key.")

        # Click X icon to close
        page.locator(".rm-filter-panel-close-btn").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="hidden")
        print("PASS: Video drawer closed successfully on X icon click.")

        print("=== 2. Testing Recommend Course Page (Resources tab) ===")
        page.locator("button.rm-tab-pill:has-text('Resources')").click()
        time.sleep(1)
        page.locator(".rm-btn-filter-toggle").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")
        print("Resources filter drawer opened.")

        # Capture screenshot
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_course_resources_filter_open.png"))

        # Click backdrop
        page.mouse.click(100, 200)
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Resources drawer should NOT close on backdrop click!"
        print("PASS: Resources drawer stayed open on backdrop click.")

        # Press Escape
        page.keyboard.press("Escape")
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Resources drawer should NOT close on Escape!"
        print("PASS: Resources drawer stayed open on Escape.")

        # Click X
        page.locator(".rm-filter-panel-close-btn").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="hidden")
        print("PASS: Resources drawer closed on X icon click.")

        print("=== 3. Testing Learning Records Page (Courses tab) ===")
        page.goto("http://localhost:3000/reporting-manager/learning-records")
        page.wait_for_selector(".rm-btn-filter-action", timeout=15000)

        # Open filter
        page.locator(".rm-btn-filter-action").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")
        print("Learning Records Courses filter drawer opened.")

        # Capture screenshot
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_learning_records_courses_filter_open.png"))

        # Click backdrop
        page.mouse.click(100, 200)
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Learning Records drawer should NOT close on backdrop click!"
        print("PASS: Learning records drawer stayed open on backdrop click.")

        # Press Escape
        page.keyboard.press("Escape")
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Learning records drawer should NOT close on Escape!"
        print("PASS: Learning records drawer stayed open on Escape.")

        # Click X
        page.locator(".rm-filter-panel-close-btn").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="hidden")
        print("PASS: Learning records drawer closed on X icon click.")

        print("=== 4. Testing Learning Records Page (Certification tab) ===")
        page.locator("button.rm-pill-tab-btn:has-text('Certification')").click()
        time.sleep(1)
        page.locator(".rm-btn-filter-action").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")
        print("Learning Records Certification filter drawer opened.")

        # Capture screenshot
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_learning_records_cert_filter_open.png"))

        # Click backdrop
        page.mouse.click(100, 200)
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Certifications drawer should NOT close on backdrop click!"
        print("PASS: Certifications drawer stayed open on backdrop click.")

        # Press Escape
        page.keyboard.press("Escape")
        time.sleep(0.5)
        assert page.locator(".rm-filter-drawer-panel").is_visible(), "Certifications drawer should NOT close on Escape!"
        print("PASS: Certifications drawer stayed open on Escape.")

        # Click X
        page.locator(".rm-filter-panel-close-btn").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="hidden")
        print("PASS: Certifications drawer closed on X icon click.")

        print("\n=============================================")
        print("ALL FILTER DRAWER PERSISTENCE TESTS PASSED!")
        print("=============================================")
        browser.close()

if __name__ == "__main__":
    run_test()
